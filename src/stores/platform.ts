import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { hostApiFetch } from '@/lib/host-api';

// ── Constants ──

const LITELLM_PROXY_URL = 'https://garage-litellm.fly.dev';
const LITELLM_MASTER_KEY = 'garage';
const PLATFORM_PROVIDER_ACCOUNT_ID = 'garageclaw-platform-default';

// ── Types (inline, matching Supabase tables) ──

interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
  created_at: string | null;
  litellm_key: string | null;
}

interface CreditLedgerRow {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string | null;
  model: string | null;
  tokens_used: number | null;
}

interface AgentRow {
  id: string;
  name: string;
  description: string | null;
  model: string;
  pricing_type: string | null;
}

interface SkillRow {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  is_builtin: boolean;
}

// ── Store ──

interface PlatformState {
  user: User | null;
  loading: boolean;
  profile: ProfileRow | null;
  balance: number;
  litellmKey: string | null;
  availableModels: string[];
  history: CreditLedgerRow[];
  agents: AgentRow[];
  skills: SkillRow[];

  initAuth: () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  loadProfile: () => Promise<void>;
  loadCredits: () => Promise<void>;
  loadMarketplace: () => Promise<void>;
  ensureLitellmKey: () => Promise<void>;
  loadAvailableModels: () => Promise<void>;
}

async function createLitellmVirtualKey(userId: string, maxBudget: number): Promise<string | null> {
  try {
    const response = await fetch(`${LITELLM_PROXY_URL}/key/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LITELLM_MASTER_KEY}`,
      },
      body: JSON.stringify({
        user_id: userId,
        max_budget: maxBudget,
        key_alias: `garageclaw-${userId.slice(0, 8)}`,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { key?: string };
    return data.key ?? null;
  } catch {
    console.error('[Platform] Failed to create LiteLLM virtual key');
    return null;
  }
}

async function fetchLitellmModels(): Promise<string[]> {
  try {
    const response = await fetch(`${LITELLM_PROXY_URL}/models`, {
      headers: { 'Authorization': `Bearer ${LITELLM_MASTER_KEY}` },
    });
    if (!response.ok) return [];
    const data = await response.json() as { data?: Array<{ id: string }> };
    return (data.data ?? []).map((m) => m.id);
  } catch {
    return [];
  }
}

async function registerPlatformProvider(apiKey: string, model: string): Promise<void> {
  try {
    // Check if already registered
    const snapshot = await hostApiFetch<{
      success: boolean;
      accounts?: Array<{ id: string }>;
    }>('/api/provider-accounts');

    const exists = snapshot.accounts?.some((a) => a.id === PLATFORM_PROVIDER_ACCOUNT_ID);
    if (exists) {
      // Update key in case it changed
      await hostApiFetch('/api/provider-accounts/' + encodeURIComponent(PLATFORM_PROVIDER_ACCOUNT_ID), {
        method: 'PUT',
        body: JSON.stringify({
          account: {
            id: PLATFORM_PROVIDER_ACCOUNT_ID,
            vendorId: 'garageclaw-platform',
            label: 'GarageClaw Platform',
            authMode: 'api_key',
            model,
            enabled: true,
            isDefault: true,
          },
          apiKey,
        }),
      });
      return;
    }

    // Create new account
    await hostApiFetch('/api/provider-accounts', {
      method: 'POST',
      body: JSON.stringify({
        account: {
          id: PLATFORM_PROVIDER_ACCOUNT_ID,
          vendorId: 'garageclaw-platform',
          label: 'GarageClaw Platform',
          authMode: 'api_key',
          model,
          enabled: true,
          isDefault: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        apiKey,
      }),
    });

    // Set as default provider
    await hostApiFetch('/api/provider-accounts/default', {
      method: 'PUT',
      body: JSON.stringify({ accountId: PLATFORM_PROVIDER_ACCOUNT_ID }),
    });
  } catch (error) {
    console.error('[Platform] Failed to register provider:', error);
  }
}

export const usePlatformStore = create<PlatformState>((set, get) => ({
  user: null,
  loading: true,
  profile: null,
  balance: 0,
  litellmKey: null,
  availableModels: [],
  history: [],
  agents: [],
  skills: [],

  initAuth: () => {
    // Restore existing session
    supabase.auth.getUser().then(({ data: { user } }) => {
      set({ user, loading: false });
      if (user) {
        get().loadProfile().then(async () => {
          await get().ensureLitellmKey();
          get().loadAvailableModels();
        });
      }
    });

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      set({ user, loading: false });
      if (!user) {
        set({ profile: null, balance: 0, litellmKey: null, availableModels: [], history: [] });
      }
    });
  },

  signIn: async (email, password) => {
    set({ loading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ loading: false });
      return error.message;
    }
    const { data: { user } } = await supabase.auth.getUser();
    set({ user, loading: false });
    if (user) {
      await get().loadProfile();
      await get().ensureLitellmKey();
      get().loadAvailableModels();
    }
    return null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, balance: 0, litellmKey: null, availableModels: [], history: [] });
  },

  ensureLitellmKey: async () => {
    const { user, profile, balance } = get();
    if (!user || !profile) return;

    let key = profile.litellm_key;

    if (!key) {
      // Create new virtual key
      key = await createLitellmVirtualKey(user.id, balance);
      if (!key) return;

      // Save to Supabase
      await supabase
        .from('profiles')
        .update({ litellm_key: key })
        .eq('id', user.id);

      set({
        litellmKey: key,
        profile: { ...profile, litellm_key: key },
      });
    } else {
      set({ litellmKey: key });
    }

    // Auto-register provider with the key
    const models = await fetchLitellmModels();
    const defaultModel = models[0] || 'gpt-4o';
    await registerPlatformProvider(key, defaultModel);
  },

  loadAvailableModels: async () => {
    const models = await fetchLitellmModels();
    set({ availableModels: models });
  },

  loadProfile: async () => {
    const { user } = get();
    if (!user) return;

    const [profileResult, balanceResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, avatar_url, role, created_at, litellm_key')
        .eq('id', user.id)
        .maybeSingle(),
      supabase.rpc('get_balance', { p_user_id: user.id }),
    ]);

    const profile = profileResult.data ?? null;
    set({
      profile,
      balance: typeof balanceResult.data === 'number' ? balanceResult.data : 0,
      litellmKey: profile?.litellm_key ?? null,
    });
  },

  loadCredits: async () => {
    const { user } = get();
    if (!user) return;

    const { data } = await supabase
      .from('credit_ledger')
      .select('id, type, amount, balance_after, description, created_at, model, tokens_used')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    set({ history: data ?? [] });
  },

  loadMarketplace: async () => {
    const [agentsResult, skillsResult] = await Promise.all([
      supabase
        .from('agents')
        .select('id, name, description, model, pricing_type')
        .eq('is_public', true)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(12),
      supabase
        .from('skills')
        .select('id, name, description, category, is_builtin')
        .order('created_at', { ascending: false })
        .limit(16),
    ]);

    set({
      agents: agentsResult.data ?? [],
      skills: skillsResult.data ?? [],
    });
  },
}));

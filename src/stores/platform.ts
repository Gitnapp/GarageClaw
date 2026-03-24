import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// ── Constants ──

const LITELLM_PROXY_URL = 'https://garage-litellm.fly.dev';
const LITELLM_MASTER_KEY = 'garage';

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

export const usePlatformStore = create<PlatformState>((set, get) => ({
  user: null,
  loading: true,
  profile: null,
  balance: 0,
  litellmKey: null,
  history: [],
  agents: [],
  skills: [],

  initAuth: () => {
    // Restore existing session
    supabase.auth.getUser().then(({ data: { user } }) => {
      set({ user, loading: false });
      if (user) {
        get().loadProfile().then(() => get().ensureLitellmKey());
      }
    });

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      set({ user, loading: false });
      if (!user) {
        set({ profile: null, balance: 0, litellmKey: null, history: [] });
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
    }
    return null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, balance: 0, litellmKey: null, history: [] });
  },

  ensureLitellmKey: async () => {
    const { user, profile, balance } = get();
    if (!user || !profile) return;

    // Already have a key
    if (profile.litellm_key) {
      set({ litellmKey: profile.litellm_key });
      return;
    }

    // Create new virtual key
    const key = await createLitellmVirtualKey(user.id, balance);
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

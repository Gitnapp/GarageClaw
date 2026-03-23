import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// ── Types (inline, matching Supabase tables) ──

interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
  created_at: string | null;
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
  history: CreditLedgerRow[];
  agents: AgentRow[];
  skills: SkillRow[];

  initAuth: () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  loadProfile: () => Promise<void>;
  loadCredits: () => Promise<void>;
  loadMarketplace: () => Promise<void>;
}

export const usePlatformStore = create<PlatformState>((set, get) => ({
  user: null,
  loading: true,
  profile: null,
  balance: 0,
  history: [],
  agents: [],
  skills: [],

  initAuth: () => {
    // Restore existing session
    supabase.auth.getUser().then(({ data: { user } }) => {
      set({ user, loading: false });
      if (user) {
        get().loadProfile();
      }
    });

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      set({ user, loading: false });
      if (!user) {
        set({ profile: null, balance: 0, history: [] });
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
    // onAuthStateChange will update user; load profile now
    const { data: { user } } = await supabase.auth.getUser();
    set({ user, loading: false });
    if (user) {
      get().loadProfile();
    }
    return null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, balance: 0, history: [] });
  },

  loadProfile: async () => {
    const { user } = get();
    if (!user) return;

    const [profileResult, balanceResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, avatar_url, role, created_at')
        .eq('id', user.id)
        .maybeSingle(),
      supabase.rpc('get_balance', { p_user_id: user.id }),
    ]);

    set({
      profile: profileResult.data ?? null,
      balance: typeof balanceResult.data === 'number' ? balanceResult.data : 0,
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

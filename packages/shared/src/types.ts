export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "creator" | "user";
export type AgentPricingType = "credits" | "free";
export type AgentStatus = "active" | "draft" | "inactive";
export type LedgerType = "deduct" | "earning" | "refund" | "topup";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          role: UserRole | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole | null;
          created_at?: string | null;
        };
      };
      credit_ledger: {
        Row: {
          id: string;
          user_id: string;
          type: LedgerType;
          amount: number;
          balance_after: number;
          description: string | null;
          created_at: string | null;
          model: string | null;
          tokens_used: number | null;
          agent_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: LedgerType;
          amount: number;
          balance_after: number;
          description?: string | null;
          created_at?: string | null;
          model?: string | null;
          tokens_used?: number | null;
          agent_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: LedgerType;
          amount?: number;
          balance_after?: number;
          description?: string | null;
          created_at?: string | null;
          model?: string | null;
          tokens_used?: number | null;
          agent_id?: string | null;
        };
      };
      agents: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          model: string;
          pricing_type: AgentPricingType | null;
          status: AgentStatus;
          is_public: boolean;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          model: string;
          pricing_type?: AgentPricingType | null;
          status?: AgentStatus;
          is_public?: boolean;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          model?: string;
          pricing_type?: AgentPricingType | null;
          status?: AgentStatus;
          is_public?: boolean;
          created_at?: string | null;
        };
      };
      skills: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: string | null;
          is_builtin: boolean;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          category?: string | null;
          is_builtin?: boolean;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          category?: string | null;
          is_builtin?: boolean;
          created_at?: string | null;
        };
      };
      api_tokens: {
        Row: {
          id: string;
          user_id: string;
          name: string | null;
          token_hash: string;
          token_preview: string;
          created_at: string | null;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string | null;
          token_hash: string;
          token_preview: string;
          created_at?: string | null;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string | null;
          token_hash?: string;
          token_preview?: string;
          created_at?: string | null;
          expires_at?: string | null;
        };
      };
    };
    Functions: {
      get_balance: {
        Args: { p_user_id: string };
        Returns: number;
      };
    };
    Enums: {
      user_role: UserRole;
      agent_pricing_type: AgentPricingType;
      agent_status: AgentStatus;
      ledger_type: LedgerType;
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Inserts<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Updates<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

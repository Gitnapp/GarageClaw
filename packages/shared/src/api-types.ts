import type { SupportedModel } from "./constants";

export type ApiErrorCode =
  | "agent_not_found"
  | "agent_not_installed"
  | "insufficient_credits"
  | "internal_error"
  | "invalid_request"
  | "llm_unavailable"
  | "rate_limited"
  | "unauthorized";

export interface ApiErrorResponse {
  error: ApiErrorCode;
  message?: string;
}

export interface CreateApiTokenRequest {
  name?: string;
  expires_at?: string | null;
}

export interface CreateApiTokenResponse {
  id: string;
  token: string;
  token_preview: string;
  created_at: string;
  expires_at: string | null;
}

export interface AuthenticatedActor {
  avatar_url?: string | null;
  display_name?: string | null;
  email: string | null;
  id: string;
  role?: "admin" | "creator" | "user" | null;
  source: "api_token" | "session";
  token_id?: string;
  token_name?: string | null;
}

export interface CreditBalanceResponse {
  balance: number;
  currency: "credits";
}

export interface CreditHistoryItem {
  agent_id: string | null;
  amount: number;
  balance_after: number;
  created_at: string | null;
  description: string | null;
  id: string;
  model: string | null;
  tokens_used: number | null;
  type: "deduct" | "earning" | "refund" | "topup";
}

export interface PlatformAuthStatus {
  base_url: string;
  connected: boolean;
  credits_url: string;
  login_url: string;
  marketplace_url: string;
  profile_url: string;
  user: ProfileSummary | null;
}

export interface ProfileSummary extends AuthenticatedActor {}

export interface AgentMessage {
  content: string;
  role: "assistant" | "system" | "user";
}

export interface InvokeAgentRequest {
  context?: {
    channel?: "api" | "feishu" | "telegram" | "web" | "wechat";
    group_id?: string;
    message_id?: string;
  };
  messages: AgentMessage[];
  stream?: boolean;
}

export interface InvokeAgentResponse {
  agent_id: string;
  content: string;
  model: SupportedModel | string;
  usage: {
    credits_charged: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

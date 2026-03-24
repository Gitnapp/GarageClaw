export type SupportedModel =
  | "claude-3-5-sonnet-20241022"
  | "claude-3-5-haiku-20241022"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "deepseek-chat";

export const MODEL_OPTIONS: { label: string; value: SupportedModel }[] = [
  { label: "Claude 3.5 Sonnet", value: "claude-3-5-sonnet-20241022" },
  { label: "Claude 3.5 Haiku", value: "claude-3-5-haiku-20241022" },
  { label: "GPT-4o", value: "gpt-4o" },
  { label: "GPT-4o Mini", value: "gpt-4o-mini" },
  { label: "DeepSeek Chat", value: "deepseek-chat" },
];

export const DEFAULT_AGENT_MODEL: SupportedModel = "claude-3-5-sonnet-20241022";
export const DEFAULT_AGENT_MAX_TOKENS = 4096;
export const DEFAULT_AGENT_TEMPERATURE = 0.7;
export const DEFAULT_AGENT_TOKEN_MARKUP = 1.0;

export const TOKEN_COSTS: Record<SupportedModel, { input: number; output: number }> = {
  "claude-3-5-sonnet-20241022": { input: 0.003, output: 0.015 },
  "claude-3-5-haiku-20241022": { input: 0.001, output: 0.005 },
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "deepseek-chat": { input: 0.0014, output: 0.0028 },
};

export const CREDIT_LIMITS = {
  freeBalance: 100,
  maxTopup: 10000,
  minTopup: 10,
} as const;

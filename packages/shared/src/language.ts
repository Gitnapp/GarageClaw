export type LanguageCode = "en" | "ja" | "zh-CN";

export const SUPPORTED_LANGUAGE_CODES: LanguageCode[] = ["en", "ja", "zh-CN"];

export function resolveSupportedLanguage(
  locale: string | null | undefined,
): LanguageCode {
  if (!locale) return "en";
  const lower = locale.toLowerCase();
  if (lower.startsWith("zh")) return "zh-CN";
  if (lower.startsWith("ja")) return "ja";
  return "en";
}

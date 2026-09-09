import type { TranslationKey } from "@/lib/translations";

/** Prefer a stable errorKey from the API, else fall back to English/message. */
export function resolveApiError(
  payload: { error?: string; errorKey?: string } | null | undefined,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
  fallbackKey: TranslationKey,
): string {
  const key = payload?.errorKey;
  if (typeof key === "string" && key.startsWith("error.")) {
    return t(key as TranslationKey);
  }
  if (payload?.error) return payload.error;
  return t(fallbackKey);
}

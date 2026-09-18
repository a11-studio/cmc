import { AiDecisionError } from "@/lib/ai/errors";

export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

export const DEFAULT_GEMINI_FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
] as const;

type EnvLike = Record<string, string | undefined>;

export function getGeminiApiKey(env: EnvLike = process.env): string {
  const key = env.GEMINI_API_KEY?.trim();

  if (!key) {
    throw new AiDecisionError("GEMINI_API_KEY is not configured", "MISSING_API_KEY");
  }

  return key;
}

export function resolveGeminiModel(env: EnvLike = process.env): string {
  const configured = env.GEMINI_MODEL?.trim();
  return configured || DEFAULT_GEMINI_MODEL;
}

export function resolveGeminiModels(env: EnvLike = process.env): string[] {
  const primary = resolveGeminiModel(env);
  const configuredFallbacks = env.GEMINI_FALLBACK_MODELS;

  const fallbacks =
    configuredFallbacks == null
      ? [...DEFAULT_GEMINI_FALLBACK_MODELS]
      : configuredFallbacks
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);

  return [...new Set([primary, ...fallbacks])];
}

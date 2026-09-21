import { generateTradeDecision } from "@/lib/ai/decision";
import { resolveGeminiModels } from "@/lib/ai/config";
import { AiDecisionError, isRetryableGeminiError, mapGeminiError } from "@/lib/ai/errors";
import type { DecisionContext, GenerateTradeDecisionOptions, TradeDecision } from "@/lib/ai/types";

export type GenerateTradeDecisionWithFallbackOptions = GenerateTradeDecisionOptions & {
  models?: string[];
  /** Max attempts on the same model when rate-limited (other failures switch model immediately). */
  rateLimitAttemptsPerModel?: number;
  delaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_DELAYS_MS = [400, 1200];

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function maxAttemptsOnModel(error: AiDecisionError): number {
  return error.code === "GEMINI_RATE_LIMIT" ? 2 : 1;
}

export async function generateTradeDecisionWithFallback(
  context: DecisionContext,
  options: GenerateTradeDecisionWithFallbackOptions
): Promise<TradeDecision> {
  const models = (
    options.models?.length ? options.models : [options.model?.trim() || resolveGeminiModels()[0]!]
  ).filter((model) => model.trim());

  if (models.length === 0) {
    throw new AiDecisionError("No Gemini models configured", "MODEL_UNAVAILABLE");
  }

  const rateLimitAttemptsPerModel = Math.max(1, options.rateLimitAttemptsPerModel ?? 2);
  const delaysMs = options.delaysMs ?? DEFAULT_DELAYS_MS;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: AiDecisionError | undefined;

  for (const [modelIndex, model] of models.entries()) {
    let attempt = 0;
    let maxAttempts = 1;

    while (attempt < maxAttempts) {
      try {
        return await generateTradeDecision(context, {
          generateContent: options.generateContent,
          model,
        });
      } catch (error) {
        const mapped = mapGeminiError(error);
        lastError = mapped;

        if (!isRetryableGeminiError(mapped)) {
          throw mapped;
        }

        maxAttempts = Math.min(
          maxAttemptsOnModel(mapped),
          mapped.code === "GEMINI_RATE_LIMIT" ? rateLimitAttemptsPerModel : 1
        );

        const lastModel = modelIndex === models.length - 1;
        const canRetryModel = attempt < maxAttempts - 1;

        if (canRetryModel) {
          const delay = delaysMs[Math.min(attempt, delaysMs.length - 1)] ?? 0;
          attempt += 1;

          if (delay > 0) {
            await sleep(delay);
          }

          continue;
        }

        if (lastModel) {
          throw mapped;
        }

        break;
      }
    }
  }

  throw lastError ?? new AiDecisionError("Gemini request failed", "GEMINI_UNAVAILABLE");
}

import { generateTradeDecision } from "@/lib/ai/decision";
import { resolveGeminiModels } from "@/lib/ai/config";
import { isRetryableGeminiError, mapGeminiError } from "@/lib/ai/errors";
import type { DecisionContext, GenerateTradeDecisionOptions, TradeDecision } from "@/lib/ai/types";

export type GenerateTradeDecisionWithFallbackOptions = GenerateTradeDecisionOptions & {
  models?: string[];
  attemptsPerModel?: number;
  delaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_DELAYS_MS = [400, 1200];

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function generateTradeDecisionWithFallback(
  context: DecisionContext,
  options: GenerateTradeDecisionWithFallbackOptions
): Promise<TradeDecision> {
  const models = (options.models?.length ? options.models : [options.model?.trim() || resolveGeminiModels()[0]!]).filter(
    (model) => model.trim()
  );
  const attemptsPerModel = Math.max(1, options.attemptsPerModel ?? 2);
  const delaysMs = options.delaysMs ?? DEFAULT_DELAYS_MS;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;

  for (const [modelIndex, model] of models.entries()) {
    for (let attempt = 0; attempt < attemptsPerModel; attempt += 1) {
      try {
        return await generateTradeDecision(context, {
          generateContent: options.generateContent,
          model,
        });
      } catch (error) {
        lastError = mapGeminiError(error);
        const lastAttempt = attempt === attemptsPerModel - 1 && modelIndex === models.length - 1;

        if (!isRetryableGeminiError(lastError) || lastAttempt) {
          throw lastError;
        }

        const delay = delaysMs[Math.min(attempt, delaysMs.length - 1)] ?? 0;

        if (delay > 0) {
          await sleep(delay);
        }
      }
    }
  }

  throw mapGeminiError(lastError);
}

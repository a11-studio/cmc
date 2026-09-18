import "server-only";

import { createGeminiClient } from "@/lib/ai/client";
import { getGeminiApiKey, resolveGeminiModels } from "@/lib/ai/config";
import { generateTradeDecisionWithFallback } from "@/lib/ai/retry";
import type { DecisionContext, TradeDecision } from "@/lib/ai/types";

export function createGeminiDecisionEngine() {
  const generateContent = createGeminiClient(getGeminiApiKey());
  const models = resolveGeminiModels();

  return {
    model: models[0]!,
    models,
    generateTradeDecision(context: DecisionContext): Promise<TradeDecision> {
      return generateTradeDecisionWithFallback(context, { generateContent, models });
    },
  };
}

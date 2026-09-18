import "server-only";

export { createGeminiDecisionEngine } from "@/lib/ai/provider";
export { generateTradeDecision, createDecisionContext, validateTradeDecision } from "@/lib/ai/decision";
export { generateTradeDecisionWithFallback } from "@/lib/ai/retry";
export { createGeminiClient } from "@/lib/ai/client";
export { getGeminiApiKey, resolveGeminiModel, resolveGeminiModels, DEFAULT_GEMINI_MODEL } from "@/lib/ai/config";
export { AiDecisionError, isAiDecisionError, isRetryableGeminiError } from "@/lib/ai/errors";
export { MOMENTUM_ALPHA_STRATEGY, MOMENTUM_ALPHA_SYSTEM_PROMPT, buildDecisionSystemPrompt } from "@/lib/ai/prompts";
export type {
  DecisionContext,
  DecisionPortfolioContext,
  DecisionPositionContext,
  GenerateTradeDecisionOptions,
  GeminiGenerateContent,
  TradeDecision,
} from "@/lib/ai/types";

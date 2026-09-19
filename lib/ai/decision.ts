import { isSupportedSymbol, normalizeSymbol, supportedSymbolsList } from "@/lib/market/symbols";
import { AiDecisionError, mapGeminiError } from "@/lib/ai/errors";
import { findAgentDefinition } from "@/lib/agents/registry";
import { loadAgentSkill } from "@/lib/agents/skills";
import {
  MOMENTUM_ALPHA_STRATEGY,
  TRADE_DECISION_JSON_SCHEMA,
  buildDecisionSystemPrompt,
  buildDecisionUserPrompt,
} from "@/lib/ai/prompts";
import { resolveGeminiModel } from "@/lib/ai/config";
import type {
  DecisionContext,
  DecisionPortfolioContext,
  GenerateTradeDecisionOptions,
  TradeDecision,
} from "@/lib/ai/types";
import type { TimeHorizon, TradeAction } from "@/lib/paper/types";
import { SUPPORTED_SYMBOLS } from "@/lib/market/symbols";
import type { RiskConstraints } from "@/lib/risk/constraints";
import { computeTradingHeadroom } from "@/lib/risk/headroom";

const ACTIONS: readonly TradeAction[] = ["BUY", "SELL", "HOLD", "SHORT"];
const HORIZONS: readonly TimeHorizon[] = ["SHORT", "MEDIUM", "LONG"];
const MAX_LIST_ITEMS = 5;
const MAX_ITEM_LENGTH = 240;

export function createDecisionContext(input: {
  agentId: string;
  agentName?: string;
  strategyName?: string;
  skill?: string;
  snapshot: DecisionContext["snapshot"];
  portfolio: DecisionPortfolioContext;
  constraints?: Partial<RiskConstraints>;
}): DecisionContext {
  if (!input.agentId.trim()) {
    throw new AiDecisionError("Decision context requires agentId", "INVALID_CONTEXT");
  }

  if (!input.snapshot?.cycleId || !input.snapshot.timestamp) {
    throw new AiDecisionError("Decision context requires a MarketSnapshot with cycleId and timestamp", "INVALID_CONTEXT");
  }

  const definition = findAgentDefinition(input.agentId);
  const skill = input.skill?.trim() || (definition ? loadAgentSkill(definition.skillPath) : "");

  if (!skill) {
    throw new AiDecisionError("Decision context requires a strategy skill", "INVALID_CONTEXT");
  }

  return {
    agentId: input.agentId,
    agentName: input.agentName?.trim() || definition?.displayName || input.agentId,
    strategyName: input.strategyName?.trim() || definition?.strategyName || MOMENTUM_ALPHA_STRATEGY.strategyName,
    skill,
    cycleId: input.snapshot.cycleId,
    snapshotTimestamp: input.snapshot.timestamp,
    snapshot: input.snapshot,
    portfolio: input.portfolio,
    headroom: computeTradingHeadroom({
      portfolio: input.portfolio,
      symbols: SUPPORTED_SYMBOLS,
      constraints: input.constraints,
    }),
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new AiDecisionError("Gemini returned an empty response", "EMPTY_RESPONSE");
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() || trimmed;
}

function parseDecisionPayload(text: string | null | undefined): unknown {
  if (text == null || text.trim() === "") {
    throw new AiDecisionError("Gemini returned an empty response", "EMPTY_RESPONSE");
  }

  try {
    return JSON.parse(extractJsonText(text)) as unknown;
  } catch (cause) {
    throw new AiDecisionError("Gemini returned malformed JSON", "MALFORMED_RESPONSE", { cause });
  }
}

function readNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AiDecisionError(`${field} must be a finite number`, "SCHEMA_VALIDATION");
  }

  return value;
}

function readPercent(value: unknown, field: string): number {
  const amount = readNumber(value, field);

  if (amount < 0 || amount > 100) {
    throw new AiDecisionError(`${field} must be between 0 and 100`, "SCHEMA_VALIDATION");
  }

  return amount;
}

function readOptionalPercent(value: unknown, field: string): number | undefined {
  if (value == null) {
    return undefined;
  }

  return readPercent(value, field);
}

function readStringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new AiDecisionError(`${field} must be an array of strings`, "SCHEMA_VALIDATION");
  }

  if (value.length > MAX_LIST_ITEMS) {
    throw new AiDecisionError(`${field} supports at most ${MAX_LIST_ITEMS} items`, "SCHEMA_VALIDATION");
  }

  return value.map((item, index) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new AiDecisionError(`${field}[${index}] must be a non-empty string`, "SCHEMA_VALIDATION");
    }

    const text = item.trim();

    if (text.length > MAX_ITEM_LENGTH) {
      throw new AiDecisionError(`${field}[${index}] is too long`, "SCHEMA_VALIDATION");
    }

    return text;
  });
}

export function validateTradeDecision(payload: unknown): TradeDecision {
  if (!isRecord(payload)) {
    throw new AiDecisionError("TradeDecision must be an object", "SCHEMA_VALIDATION");
  }

  if (typeof payload.action !== "string" || !ACTIONS.includes(payload.action as TradeAction)) {
    throw new AiDecisionError("action must be BUY, SELL, SHORT, or HOLD", "SCHEMA_VALIDATION");
  }

  if (typeof payload.symbol !== "string") {
    throw new AiDecisionError("symbol is required", "SCHEMA_VALIDATION");
  }

  const symbol = normalizeSymbol(payload.symbol);

  if (!isSupportedSymbol(symbol)) {
    throw new AiDecisionError(`symbol must be ${supportedSymbolsList()}`, "SCHEMA_VALIDATION");
  }

  if (typeof payload.timeHorizon !== "string" || !HORIZONS.includes(payload.timeHorizon as TimeHorizon)) {
    throw new AiDecisionError("timeHorizon must be SHORT, MEDIUM, or LONG", "SCHEMA_VALIDATION");
  }

  const action = payload.action as TradeAction;
  const allocationPercent = readPercent(payload.allocationPercent, "allocationPercent");
  const confidence = readPercent(payload.confidence, "confidence");

  if (action === "HOLD" && allocationPercent !== 0) {
    throw new AiDecisionError("HOLD allocationPercent must be 0", "SCHEMA_VALIDATION");
  }

  const decision: TradeDecision = {
    action,
    symbol,
    allocationPercent,
    confidence,
    timeHorizon: payload.timeHorizon as TimeHorizon,
    reasons: readStringList(payload.reasons, "reasons"),
    riskFactors: readStringList(payload.riskFactors, "riskFactors"),
  };

  const stopLossPercent = readOptionalPercent(payload.stopLossPercent, "stopLossPercent");
  const takeProfitPercent = readOptionalPercent(payload.takeProfitPercent, "takeProfitPercent");

  if (stopLossPercent != null) {
    decision.stopLossPercent = stopLossPercent;
  }

  if (takeProfitPercent != null) {
    decision.takeProfitPercent = takeProfitPercent;
  }

  return decision;
}

function assertValidContext(context: DecisionContext) {
  if (!context.agentId?.trim()) {
    throw new AiDecisionError("Decision context requires agentId", "INVALID_CONTEXT");
  }

  if (!context.strategyName?.trim()) {
    throw new AiDecisionError("Decision context requires strategyName", "INVALID_CONTEXT");
  }

  if (!context.skill?.trim()) {
    throw new AiDecisionError("Decision context requires a strategy skill", "INVALID_CONTEXT");
  }

  if (!context.snapshot) {
    throw new AiDecisionError("Decision context requires an immutable MarketSnapshot", "INVALID_CONTEXT");
  }

  if (!context.portfolio || !Number.isFinite(context.portfolio.cash) || !Number.isFinite(context.portfolio.equity)) {
    throw new AiDecisionError("Decision context requires readonly portfolio cash and equity", "INVALID_CONTEXT");
  }
}

export async function generateTradeDecision(
  context: DecisionContext,
  options: GenerateTradeDecisionOptions
): Promise<TradeDecision> {
  assertValidContext(context);

  const snapshot = cloneJson(context.snapshot);
  const portfolio = cloneJson(context.portfolio);
  const model = options.model?.trim() || resolveGeminiModel();

  const payload = {
    agentId: context.agentId,
    agentName: context.agentName,
    strategyName: context.strategyName,
    skill: context.skill,
    cycleId: context.cycleId || snapshot.cycleId,
    snapshotTimestamp: context.snapshotTimestamp || snapshot.timestamp,
    snapshot,
    portfolio,
    ...(context.headroom ? { headroom: cloneJson(context.headroom) } : {}),
  };

  let response: { text?: string | null };

  try {
    response = await options.generateContent({
      model,
      contents: buildDecisionUserPrompt(payload),
      systemInstruction: buildDecisionSystemPrompt({
        agentName: context.agentName || context.agentId,
        strategyName: context.strategyName,
        skill: context.skill,
      }),
      responseJsonSchema: TRADE_DECISION_JSON_SCHEMA,
    });
  } catch (error) {
    throw mapGeminiError(error);
  }

  return validateTradeDecision(parseDecisionPayload(response.text));
}

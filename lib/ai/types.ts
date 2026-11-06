import type { MarketSnapshot, SupportedSymbol } from "@/lib/market/types";
import type { TimeHorizon, TradeAction, TradeDecision } from "@/lib/paper/types";
import type { TradingHeadroom } from "@/lib/risk/headroom";

export type DecisionPositionContext = {
  symbol: SupportedSymbol;
  quantity: number;
  averageEntryPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  allocationPercent: number;
};

export type DecisionPortfolioContext = {
  cash: number;
  equity: number;
  drawdownPercent?: number;
  positions: readonly DecisionPositionContext[];
};

export type DecisionFloorMessage = {
  from: string;
  kind: "admin" | "take" | "question" | "reply";
  body: string;
  directedAtYou: boolean;
};

export type DecisionContext = {
  agentId: string;
  agentName: string;
  strategyName: string;
  skill: string;
  cycleId: string;
  snapshotTimestamp: string;
  snapshot: MarketSnapshot;
  portfolio: DecisionPortfolioContext;
  headroom?: TradingHeadroom;
  floorChat?: readonly DecisionFloorMessage[];
  /** Present when a deterministic rule core proposed this cycle's trade and the model only reviews it. */
  ruleProposal?: DecisionRuleProposal;
};

export type DecisionRuleProposal = {
  decision: TradeDecision;
  basis: readonly string[];
  instruction: string;
  /** False for exits and trims: the model may comment but not block them. */
  vetoAllowed: boolean;
};

export type GeminiGenerateContentRequest = {
  model: string;
  contents: string;
  systemInstruction: string;
  responseJsonSchema: unknown;
};

export type GeminiGenerateContentResponse = {
  text?: string | null;
};

export type GeminiGenerateContent = (
  request: GeminiGenerateContentRequest
) => Promise<GeminiGenerateContentResponse>;

export type GenerateTradeDecisionOptions = {
  generateContent: GeminiGenerateContent;
  model?: string;
};

export type { TradeAction, TradeDecision, TimeHorizon, MarketSnapshot, SupportedSymbol };

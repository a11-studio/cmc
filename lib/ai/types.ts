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
  positions: readonly DecisionPositionContext[];
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

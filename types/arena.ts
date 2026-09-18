import type { SupportedSymbol } from "@/lib/market/types";

export type AgentStatus = "ACTIVE" | "PAUSED" | "ERROR";
export type TradeAction = "BUY" | "SELL" | "HOLD" | "SHORT";
export type { SupportedSymbol };
export type TimeHorizon = "SHORT" | "MEDIUM" | "LONG";
export type ActivityEventType =
  | "ANALYZING"
  | "SIGNAL"
  | "NEWS"
  | "DECISION"
  | "RISK_CHECK"
  | "TRADE_EXECUTED"
  | "TRADE_REJECTED"
  | "ERROR";
export type AgentMark =
  | "momentum"
  | "news"
  | "contrarian"
  | "macro"
  | "turtle"
  | "trend"
  | "speculator"
  | "jones"
  | "quant"
  | "burry"
  | "hayes";

export type MarketTickerQuote = {
  symbol: SupportedSymbol;
  price?: number;
  change24h?: number;
};

export type MarketSource = "sample" | "live" | "unavailable";

export type MarketQuote = {
  symbol: SupportedSymbol;
  name: string;
  price: number;
  change1h?: number;
  change24h?: number;
  change7d?: number;
  volume24h?: number;
  marketCap?: number;
  rsi?: number;
  macd?: string;
  ema20?: number;
  ema50?: number;
  emaBias?: "Bullish" | "Bearish" | "Neutral";
};

export type DataSource = "live" | "sample" | "roster";
export type AgentRuntimeStatus = "LIVE" | "READY" | "SIMULATION";

export type EquityCurvePoint = {
  equity: number;
  at?: string;
  label?: string;
};

export type LeaderboardAgent = {
  id: string;
  name: string;
  strategy: string;
  description: string;
  status: AgentStatus;
  mark: AgentMark;
  equity: number;
  returnPercent: number;
  drawdownPercent: number;
  winRatePercent: number;
  trades: number;
  initialCapital: number;
  cash: number;
  coins: number;
  dataSource: DataSource;
  runtimeStatus?: AgentRuntimeStatus;
};

export type PositionRow = {
  symbol: SupportedSymbol;
  quantity: number;
  averageEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  allocationPercent: number;
};

export type TradeRow = {
  id: string;
  symbol: SupportedSymbol;
  side: Exclude<TradeAction, "HOLD">;
  notional: number;
  quantity: number;
  price: number;
  createdAt: string;
  decisionId?: string;
  realizedPnl?: number;
};

export type ActivityEvent = {
  id: string;
  agentId: string;
  agentName: string;
  type: ActivityEventType;
  title: string;
  description: string;
  createdAt: string;
};

export type DecisionRecord = {
  id: string;
  agentId: string;
  agentName: string;
  action: TradeAction;
  symbol: SupportedSymbol;
  notional: number;
  quantity: number;
  price: number;
  allocationPercent: number;
  confidence: number;
  timeHorizon: TimeHorizon;
  status: "Executed" | "Rejected" | "Held" | "Blocked" | "Failed" | "Constrained";
  stopLossPercent?: number;
  takeProfitPercent?: number;
  reasons: string[];
  riskFactors: string[];
  market: MarketQuote;
  riskCheck: string;
  createdAt?: string;
  dataSource: DataSource;
  strategyName?: string;
  skillName?: string;
  cycleId?: string;
  cycleStatus?: string;
  riskVerdict?: "APPROVED" | "CONSTRAINED" | "BLOCKED";
  requestedAllocationPercent?: number;
  allowedAllocationPercent?: number;
  resultingEquity?: number;
  resultingQuantity?: number;
  failureMessage?: string;
  events?: ActivityEvent[];
};

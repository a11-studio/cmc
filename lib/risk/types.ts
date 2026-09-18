import type { MarketSnapshot, SupportedSymbol } from "@/lib/market/types";
import type { TradeDecision } from "@/lib/paper/types";
import type { RiskConstraints } from "@/lib/risk/constraints";

export type RiskVerdict = "APPROVED" | "CONSTRAINED" | "BLOCKED";

export type RiskCheckCode =
  | "APPROVED"
  | "ALLOCATION_CONSTRAINED"
  | "INVALID_ACTION"
  | "UNSUPPORTED_SYMBOL"
  | "INVALID_ALLOCATION"
  | "INVALID_SNAPSHOT"
  | "MISSING_PRICE"
  | "AGENT_PAUSED"
  | "MAX_TRADE_EXCEEDED"
  | "MAX_POSITION_EXCEEDED"
  | "MIN_CASH_BREACH"
  | "MAX_OPEN_POSITIONS"
  | "DAILY_LOSS_LIMIT"
  | "DRAWDOWN_LIMIT"
  | "INSUFFICIENT_POSITION"
  | "SHORTING_FORBIDDEN"
  | "LEVERAGE_FORBIDDEN";

export type AgentRiskStatus = "ACTIVE" | "PAUSED" | "ERROR";

export type RiskPosition = {
  symbol: SupportedSymbol;
  quantity: number;
  marketValue: number;
  allocationPercent: number;
};

export type RiskPortfolioState = {
  cash: number;
  equity: number;
  drawdownPercent: number;
  dayStartEquity: number;
  positions: readonly RiskPosition[];
};

export type RiskCheck = {
  code: RiskCheckCode;
  passed: boolean;
  detail: string;
};

export type RiskInput = {
  decision: TradeDecision;
  snapshot: MarketSnapshot;
  portfolio: RiskPortfolioState;
  agentStatus?: AgentRiskStatus;
  constraints?: Partial<RiskConstraints>;
};

export type RiskResult = {
  verdict: RiskVerdict;
  approved: boolean;
  executable: boolean;
  code: RiskCheckCode;
  reason: string;
  decision: TradeDecision;
  allowedDecision?: TradeDecision;
  adjustedAllocationPercent?: number;
  checks: RiskCheck[];
};

export type { MarketSnapshot, SupportedSymbol, TradeDecision };

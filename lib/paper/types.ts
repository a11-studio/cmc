import type { MarketSnapshot } from "@/lib/market/types";
import type { SupportedSymbol } from "@/lib/market/types";

export type TradeAction = "BUY" | "SELL" | "HOLD" | "SHORT";
export type TimeHorizon = "SHORT" | "MEDIUM" | "LONG";

export type TradeDecision = {
  action: TradeAction;
  symbol: SupportedSymbol;
  allocationPercent: number;
  confidence: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  timeHorizon: TimeHorizon;
  reasons: string[];
  riskFactors: string[];
};

export type Position = {
  symbol: SupportedSymbol;
  quantity: number;
  averageEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  allocationPercent: number;
};

export type Portfolio = {
  cash: number;
  equity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  returnPercent: number;
  drawdownPercent: number;
};

export type Trade = {
  id: string;
  symbol: SupportedSymbol;
  side: Exclude<TradeAction, "HOLD">;
  quantity: number;
  price: number;
  notional: number;
  realizedPnl?: number;
  cycleId: string;
  createdAt: string;
};

export type OpenPosition = {
  symbol: SupportedSymbol;
  quantity: number;
  averageEntryPrice: number;
};

export type PaperAccount = {
  initialCapital: number;
  cash: number;
  peakEquity: number;
  realizedPnl: number;
  positions: readonly OpenPosition[];
  trades: readonly Trade[];
};

export type PaperValuation = {
  portfolio: Portfolio;
  positions: Position[];
};

export type PaperExecution =
  | {
      ok: true;
      action: TradeAction;
      trade?: Trade;
      account: PaperAccount;
      valuation: PaperValuation;
    }
  | {
      ok: false;
      action: TradeAction;
      code: PaperTradingErrorCode;
      reason: string;
      account: PaperAccount;
      valuation?: PaperValuation;
    };

export type ExecutePaperDecisionOptions = {
  now?: () => Date;
  createTradeId?: () => string;
};

export type PaperTradingErrorCode =
  | "INVALID_ACTION"
  | "UNSUPPORTED_SYMBOL"
  | "INVALID_ALLOCATION"
  | "INSUFFICIENT_CASH"
  | "INSUFFICIENT_POSITION"
  | "MISSING_PRICE"
  | "INVALID_SNAPSHOT";

export type { MarketSnapshot, SupportedSymbol };

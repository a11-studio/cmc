export { createPaperAccount, markToMarket, INITIAL_CAPITAL } from "@/lib/paper/portfolio";
export { executePaperDecision, replayPaperAccountFromTrades } from "@/lib/paper/engine";
export { PaperTradingError, isPaperTradingError } from "@/lib/paper/errors";
export type {
  TradeDecision,
  TradeAction,
  TimeHorizon,
  Portfolio,
  Position,
  Trade,
  PaperAccount,
  PaperExecution,
  PaperValuation,
  ExecutePaperDecisionOptions,
} from "@/lib/paper/types";

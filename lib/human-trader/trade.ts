import { toRiskPortfolio } from "@/lib/agent/context";
import { executePaperDecision } from "@/lib/paper/engine";
import { findPosition, markToMarket, requirePrice, snapshotPrices } from "@/lib/paper/portfolio";
import type {
  ExecutePaperDecisionOptions,
  PaperAccount,
  PaperExecution,
  PaperValuation,
  TradeAction,
  TradeDecision,
} from "@/lib/paper/types";
import type { MarketSnapshot, SupportedSymbol } from "@/lib/paper/types";
import { SUPPORTED_SYMBOLS } from "@/lib/market/symbols";
import { computeTradingHeadroom } from "@/lib/risk/headroom";
import { evaluateRisk } from "@/lib/risk/evaluate";
import type { RiskResult } from "@/lib/risk/types";

export type HumanTradeAction = "BUY" | "SELL" | "SHORT";

export type HumanNotionalTradeInput = {
  action: HumanTradeAction;
  symbol: SupportedSymbol;
  dollarAmount: number;
};

function baseDecision(
  action: TradeAction,
  symbol: SupportedSymbol,
  allocationPercent: number
): TradeDecision {
  return {
    action,
    symbol,
    allocationPercent,
    confidence: 1,
    timeHorizon: "SHORT",
    reasons: ["Human paper trade"],
    riskFactors: [],
  };
}

function valuationFor(account: PaperAccount, snapshot: MarketSnapshot): PaperValuation {
  return markToMarket(account, snapshot);
}

function headroomPortfolio(valuation: PaperValuation) {
  return {
    cash: valuation.portfolio.cash,
    equity: valuation.portfolio.equity,
    positions: valuation.positions.map((position) => ({
      symbol: position.symbol,
      quantity: position.quantity,
      marketValue: position.marketValue,
      allocationPercent: position.allocationPercent,
    })),
  };
}

export function maxHumanTradeNotional(
  account: PaperAccount,
  snapshot: MarketSnapshot,
  input: Pick<HumanNotionalTradeInput, "action" | "symbol">
): number {
  const valuation = valuationFor(account, snapshot);
  const equity = valuation.portfolio.equity;

  if (!(equity > 0)) {
    return 0;
  }

  const headroom = computeTradingHeadroom({
    portfolio: headroomPortfolio(valuation),
    symbols: SUPPORTED_SYMBOLS,
  });

  const entry = headroom.perSymbol.find((row) => row.symbol === input.symbol);

  if (!entry) {
    return 0;
  }

  if (input.action === "BUY") {
    return (entry.maxBuyPercentOfEquity / 100) * equity;
  }

  if (input.action === "SHORT") {
    return (entry.maxShortPercentOfEquity / 100) * equity;
  }

  const existing = findPosition(account.positions, input.symbol);

  if (!existing || existing.quantity <= 0) {
    return 0;
  }

  const prices = snapshotPrices(snapshot);
  const price = requirePrice(prices, input.symbol);
  const positionNotional = existing.quantity * price;

  return (entry.maxSellPercentOfPosition / 100) * positionNotional;
}

export function buildHumanTradeDecision(
  account: PaperAccount,
  snapshot: MarketSnapshot,
  input: HumanNotionalTradeInput
): TradeDecision | null {
  if (!(input.dollarAmount > 0) || !Number.isFinite(input.dollarAmount)) {
    return null;
  }

  const valuation = valuationFor(account, snapshot);
  const equity = valuation.portfolio.equity;

  if (input.action === "BUY" || input.action === "SHORT") {
    if (!(equity > 0)) {
      return null;
    }

    const allocationPercent = (input.dollarAmount / equity) * 100;
    return baseDecision(input.action, input.symbol, allocationPercent);
  }

  const existing = findPosition(account.positions, input.symbol);

  if (!existing || existing.quantity <= 0) {
    return null;
  }

  const prices = snapshotPrices(snapshot);
  const price = requirePrice(prices, input.symbol);
  const maxNotional = existing.quantity * price;
  const notional = Math.min(input.dollarAmount, maxNotional);
  const sellAllocation = (notional / (existing.quantity * price)) * 100;

  return baseDecision("SELL", input.symbol, sellAllocation);
}

function evaluateHumanTrade(
  account: PaperAccount,
  snapshot: MarketSnapshot,
  decision: TradeDecision
): RiskResult {
  const valuation = valuationFor(account, snapshot);

  return evaluateRisk({
    decision,
    snapshot,
    portfolio: toRiskPortfolio(valuation, account.initialCapital),
    agentStatus: "ACTIVE",
  });
}

function rejectFromRisk(
  account: PaperAccount,
  snapshot: MarketSnapshot,
  action: TradeAction,
  risk: RiskResult
): PaperExecution {
  return {
    ok: false,
    action,
    code: "INVALID_ALLOCATION",
    reason: risk.reason,
    account,
    valuation: valuationFor(account, snapshot),
  };
}

export function estimateHumanTradeQuantity(
  account: PaperAccount,
  snapshot: MarketSnapshot,
  input: HumanNotionalTradeInput
): number | null {
  const decision = buildHumanTradeDecision(account, snapshot, input);

  if (!decision) {
    return null;
  }

  const risk = evaluateHumanTrade(account, snapshot, decision);

  if (!risk.executable) {
    return null;
  }

  const effective = risk.allowedDecision ?? decision;

  try {
    const prices = snapshotPrices(snapshot);
    const price = requirePrice(prices, input.symbol);
    const valuation = valuationFor(account, snapshot);
    const equity = valuation.portfolio.equity;

    if (effective.action === "BUY" || effective.action === "SHORT") {
      const notional = equity * (effective.allocationPercent / 100);
      const qty = notional / price;

      if (effective.action === "BUY") {
        const existing = findPosition(account.positions, input.symbol);

        if (existing && existing.quantity < 0) {
          return Math.min(qty, Math.abs(existing.quantity));
        }
      }

      return qty;
    }

    const existing = findPosition(account.positions, input.symbol);

    if (!existing || existing.quantity <= 0) {
      return null;
    }

    return existing.quantity * (effective.allocationPercent / 100);
  } catch {
    return null;
  }
}

export function executeHumanNotionalTrade(
  account: PaperAccount,
  snapshot: MarketSnapshot,
  input: HumanNotionalTradeInput,
  options: ExecutePaperDecisionOptions = {}
): PaperExecution {
  const decision = buildHumanTradeDecision(account, snapshot, input);

  if (!decision) {
    return executePaperDecision(
      account,
      baseDecision(input.action, input.symbol, 0),
      snapshot,
      options
    );
  }

  const risk = evaluateHumanTrade(account, snapshot, decision);

  if (!risk.executable) {
    return rejectFromRisk(account, snapshot, decision.action, risk);
  }

  const executable = risk.allowedDecision ?? decision;

  return executePaperDecision(account, executable, snapshot, options);
}

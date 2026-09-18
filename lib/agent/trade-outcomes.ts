import type { AgentCycleResult } from "@/lib/agent/types";
import type { Trade, TradeAction } from "@/lib/paper/types";
import type { SupportedSymbol } from "@/lib/market/types";

export type TradeCheckKind = "fill" | "hold" | "blocked";

export type TradeCheck = {
  tradeId: string;
  symbol: SupportedSymbol;
  side: TradeAction;
  fillPrice: number | null;
  checkPrice: number | null;
  createdAt: string;
  checkedAt: string | null;
  win: boolean | null;
  kind: TradeCheckKind;
};

export function scoreTradeCheck(side: Trade["side"], fillPrice: number, checkPrice: number): boolean | null {
  if (!(fillPrice > 0) || !(checkPrice > 0) || fillPrice === checkPrice) {
    return null;
  }

  const rose = checkPrice > fillPrice;

  if (side === "BUY") {
    return rose;
  }

  return !rose;
}

function snapshotPrice(cycle: AgentCycleResult, symbol: SupportedSymbol): number | undefined {
  const price = cycle.snapshot?.assets.find((asset) => asset.symbol === symbol)?.price;
  return price != null && price > 0 ? price : undefined;
}

function fillCheck(trade: Trade, checkPrice: number | null, checkedAt: string | null): TradeCheck {
  return {
    tradeId: trade.id,
    symbol: trade.symbol,
    side: trade.side,
    fillPrice: trade.price,
    checkPrice,
    createdAt: trade.createdAt,
    checkedAt,
    win: checkPrice != null ? scoreTradeCheck(trade.side, trade.price, checkPrice) : null,
    kind: "fill",
  };
}

export function scoreTradesAgainstNextCheck(
  trades: readonly Trade[],
  cycles: readonly AgentCycleResult[]
): TradeCheck[] {
  const orderedCycles = [...cycles].sort(
    (left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt)
  );
  const checks: TradeCheck[] = [];

  for (const trade of trades) {
    const origin = orderedCycles.find((cycle) => cycle.cycleId === trade.cycleId);
    const after = Date.parse(origin?.completedAt ?? trade.createdAt);

    if (!Number.isFinite(after)) {
      continue;
    }

    const next = orderedCycles.find((cycle) => {
      const completed = Date.parse(cycle.completedAt);
      return completed > after && snapshotPrice(cycle, trade.symbol) != null;
    });
    const checkPrice = next ? snapshotPrice(next, trade.symbol) : undefined;

    if (!next || checkPrice == null) {
      checks.push(fillCheck(trade, null, null));
      continue;
    }

    checks.push(fillCheck(trade, checkPrice, next.completedAt));
  }

  return checks;
}

export function scoreBookTradeChecks(
  trades: readonly Trade[],
  cycles: readonly AgentCycleResult[]
): TradeCheck[] {
  const fills = scoreTradesAgainstNextCheck(trades, cycles);
  const filledCycleIds = new Set(trades.map((trade) => trade.cycleId));
  const extras: TradeCheck[] = [];

  for (const cycle of cycles) {
    const decision = cycle.decision;

    if (!decision || filledCycleIds.has(cycle.cycleId)) {
      continue;
    }

    if (cycle.status === "SKIPPED_DUPLICATE" || cycle.status === "SKIPPED_PAUSED") {
      continue;
    }

    const blocked = cycle.status === "BLOCKED" || cycle.riskResult?.verdict === "BLOCKED";

    extras.push({
      tradeId: cycle.cycleId,
      symbol: decision.symbol,
      side: decision.action,
      fillPrice: null,
      checkPrice: null,
      createdAt: cycle.completedAt,
      checkedAt: null,
      win: null,
      kind: blocked ? "blocked" : "hold",
    });
  }

  return [...fills, ...extras].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
}

import type { AgentCycleResult } from "@/lib/agent/types";
import type { Trade, TradeAction } from "@/lib/paper/types";
import type { SupportedSymbol } from "@/lib/market/types";

export type TradeCheckKind = "fill" | "hold" | "blocked";

const HOUR_MS = 60 * 60 * 1000;

/**
 * One hourly cycle of one agent, scored one cycle later.
 *
 * A cycle that traded is a "fill": it is judged by the price at the agent's next
 * cycle (normally an hour later). HOLD and blocked cycles are shown but not scored.
 */
export type TradeCheck = {
  tradeId: string;
  cycleId: string;
  /** Start of the UTC hour the cycle ran in. */
  hourStart: string;
  symbol: SupportedSymbol;
  side: TradeAction;
  fillPrice: number | null;
  checkPrice: number | null;
  createdAt: string;
  checkedAt: string | null;
  win: boolean | null;
  kind: TradeCheckKind;
  /** Fills in this cycle, protective exits included. */
  fills: number;
};

/**
 * Whether the fill was right one check later. `profitsFromRise` is true for a BUY
 * and for a SELL that covered a short; false for a SHORT and a SELL that closed a long.
 */
export function scoreTradeCheck(
  side: Trade["side"],
  fillPrice: number,
  checkPrice: number,
  coversShort = false
): boolean | null {
  if (!(fillPrice > 0) || !(checkPrice > 0) || fillPrice === checkPrice) {
    return null;
  }

  const rose = checkPrice > fillPrice;
  const profitsFromRise = side === "BUY" || (side === "SELL" && coversShort);

  return profitsFromRise ? rose : !rose;
}

/** Trade ids of SELL fills that bought back a short (replayed from a flat start). */
function shortCoverIds(trades: readonly Trade[]): Set<string> {
  const ordered = [...trades].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  const net = new Map<SupportedSymbol, number>();
  const covers = new Set<string>();

  for (const trade of ordered) {
    const held = net.get(trade.symbol) ?? 0;
    const quantity = Math.abs(trade.quantity);

    if (trade.side === "BUY") {
      net.set(trade.symbol, held + quantity);
    } else if (trade.side === "SHORT") {
      net.set(trade.symbol, held - quantity);
    } else if (held < 0) {
      covers.add(trade.id);
      net.set(trade.symbol, Math.min(0, held + quantity));
    } else {
      net.set(trade.symbol, Math.max(0, held - quantity));
    }
  }

  return covers;
}

function snapshotPrice(cycle: AgentCycleResult, symbol: SupportedSymbol): number | undefined {
  const price = cycle.snapshot?.assets.find((asset) => asset.symbol === symbol)?.price;
  return price != null && price > 0 ? price : undefined;
}

export function hourStartIso(at: string): string | null {
  const time = Date.parse(at);
  return Number.isFinite(time) ? new Date(Math.floor(time / HOUR_MS) * HOUR_MS).toISOString() : null;
}

function isSkipped(cycle: AgentCycleResult): boolean {
  return cycle.status === "SKIPPED_DUPLICATE" || cycle.status === "SKIPPED_PAUSED";
}

/** The fill that carries the agent's decision; a protective exit only when nothing else filled. */
function primaryFill(fills: readonly Trade[], cycle: AgentCycleResult | undefined): Trade {
  const decision = cycle?.decision;
  const matching = decision
    ? fills.filter((fill) => fill.symbol === decision.symbol && fill.side === decision.action)
    : [];

  return (matching.at(-1) ?? fills.at(-1))!;
}

/**
 * One check per hourly cycle. A cycle with fills is scored against the price at the
 * next cycle; HOLD and blocked cycles stay unscored and never count as trades.
 */
export function scoreBookTradeChecks(
  trades: readonly Trade[],
  cycles: readonly AgentCycleResult[]
): TradeCheck[] {
  const ordered = cycles
    .filter((cycle) => !isSkipped(cycle))
    .sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt));
  const cycleById = new Map(ordered.map((cycle) => [cycle.cycleId, cycle]));
  const covers = shortCoverIds(trades);
  const fillsByCycle = new Map<string, Trade[]>();

  for (const trade of trades) {
    const list = fillsByCycle.get(trade.cycleId) ?? [];
    list.push(trade);
    fillsByCycle.set(trade.cycleId, list);
  }

  const nextPrice = (after: number, symbol: SupportedSymbol) => {
    const next = ordered.find((cycle) => Date.parse(cycle.completedAt) > after && snapshotPrice(cycle, symbol) != null);
    return next ? { price: snapshotPrice(next, symbol)!, at: next.completedAt } : null;
  };

  const checks: TradeCheck[] = [];

  for (const [cycleId, fills] of fillsByCycle) {
    const cycle = cycleById.get(cycleId);
    const fill = primaryFill(fills, cycle);
    const createdAt = cycle?.completedAt ?? fill.createdAt;
    const hourStart = hourStartIso(cycle?.startedAt ?? fill.createdAt);

    if (!hourStart) {
      continue;
    }

    const check = nextPrice(Date.parse(createdAt), fill.symbol);

    checks.push({
      tradeId: fill.id,
      cycleId,
      hourStart,
      symbol: fill.symbol,
      side: fill.side,
      fillPrice: fill.price,
      checkPrice: check?.price ?? null,
      createdAt,
      checkedAt: check?.at ?? null,
      win: check ? scoreTradeCheck(fill.side, fill.price, check.price, covers.has(fill.id)) : null,
      kind: "fill",
      fills: fills.length,
    });
  }

  for (const cycle of ordered) {
    const decision = cycle.decision;
    const hourStart = hourStartIso(cycle.startedAt || cycle.completedAt);

    if (!decision || !hourStart || fillsByCycle.has(cycle.cycleId)) {
      continue;
    }

    const blocked = cycle.status === "BLOCKED" || cycle.riskResult?.verdict === "BLOCKED";

    checks.push({
      tradeId: cycle.cycleId,
      cycleId: cycle.cycleId,
      hourStart,
      symbol: decision.symbol,
      side: decision.action,
      fillPrice: null,
      checkPrice: null,
      createdAt: cycle.completedAt,
      checkedAt: null,
      win: null,
      kind: blocked ? "blocked" : "hold",
      fills: 0,
    });
  }

  return checks.sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
}

import { isClosedQuantity } from "@/lib/paper/portfolio";
import type { Position, TradeDecision } from "@/lib/paper/types";
import type { MarketSnapshot } from "@/lib/market/types";
import type { RiskConstraints } from "@/lib/risk/constraints";
import { findSnapshotAsset, trendRegime } from "@/lib/risk/trend";

export type ProtectiveExitKind = "STOP" | "TREND";

export type ProtectiveExitPlan = {
  kind: ProtectiveExitKind;
  reason: string;
  decision: TradeDecision;
};

const PERCENT_EPSILON = 1e-6;

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function exitDecision(position: Position, allocationPercent: number, reason: string): TradeDecision {
  return {
    action: "SELL",
    symbol: position.symbol,
    allocationPercent: Math.min(100, round(allocationPercent, 4)),
    confidence: 100,
    timeHorizon: "SHORT",
    reasons: [reason],
    riskFactors: [],
  };
}

/**
 * Deterministic exits the Risk Engine applies before the agent decides.
 *
 * The agents propose stop-losses but nothing ever executed them, and in the
 * Sep–Nov 2026 arena they kept 33–47% net long through every drop. Running the
 * same trades with these two rules turned each agent's result 2–4 points better.
 *
 * - STOP: price moved protectiveStopAtr × ATR20 against the average entry → close fully.
 * - TREND: position sits on the wrong side of the trend-filter SMA → trim to
 *   trendExitMaxAllocationPercent of equity (0 closes it).
 *
 * Exits are SELLs (SELL on a short covers it), so they only ever reduce risk.
 */
export function planProtectiveExits(input: {
  snapshot: MarketSnapshot;
  positions: readonly Position[];
  constraints: RiskConstraints;
}): ProtectiveExitPlan[] {
  const { snapshot, positions, constraints } = input;
  const plans: ProtectiveExitPlan[] = [];

  for (const position of positions) {
    if (isClosedQuantity(position.quantity)) {
      continue;
    }

    const asset = findSnapshotAsset(snapshot, position.symbol);
    const price = asset?.price;

    if (!asset || !(price && price > 0)) {
      continue;
    }

    const isLong = position.quantity > 0;
    const side = isLong ? "long" : "short";
    const atr = asset.trend?.atr20;

    if (constraints.protectiveStopAtr > 0 && atr && atr > 0 && position.averageEntryPrice > 0) {
      const distance = constraints.protectiveStopAtr * atr;
      const stopPrice = isLong ? position.averageEntryPrice - distance : position.averageEntryPrice + distance;
      const hit = isLong ? price <= stopPrice : price >= stopPrice;

      if (hit) {
        plans.push({
          kind: "STOP",
          reason: `Protective stop: ${position.symbol} ${side} from ${round(position.averageEntryPrice, 4)} hit ${constraints.protectiveStopAtr}×ATR20 stop at ${round(stopPrice, 4)} (price ${round(price, 4)}).`,
          decision: exitDecision(position, 100, `Protective stop hit at ${round(stopPrice, 4)}`),
        });
        continue;
      }
    }

    const regime = trendRegime(snapshot, position.symbol, constraints.trendFilterSma);
    const againstTrend = (isLong && regime === "DOWN") || (!isLong && regime === "UP");

    if (!againstTrend) {
      continue;
    }

    const allocation = Math.abs(position.allocationPercent);
    const keep = Math.max(0, constraints.trendExitMaxAllocationPercent);

    if (allocation <= keep + PERCENT_EPSILON) {
      continue;
    }

    const closePercent = keep > 0 ? ((allocation - keep) / allocation) * 100 : 100;
    const where = regime === "DOWN" ? "below" : "above";
    const target = keep > 0 ? `trimmed to ${keep}% of equity` : "closed";

    plans.push({
      kind: "TREND",
      reason: `Trend exit: ${position.symbol} ${side} is ${where} its ${constraints.trendFilterSma}-day average; ${target}.`,
      decision: exitDecision(position, closePercent, `${position.symbol} ${where} ${constraints.trendFilterSma}-day average`),
    });
  }

  return plans;
}

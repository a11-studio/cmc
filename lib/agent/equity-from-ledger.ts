import { latestEquityHistoryRows } from "@/lib/agent/equity-history-rows";
import { replayPaperAccountFromTrades } from "@/lib/paper/engine";
import { markToMarket } from "@/lib/paper/portfolio";
import type { MarketSnapshot } from "@/lib/market/types";
import type { PaperValuation } from "@/lib/paper/types";
import type { Trade } from "@/lib/paper/types";
import type { EquityCurvePoint } from "@/types/arena";

export type EquityHistoryAnchor = {
  timestamp: string;
  cycleId: string;
};

export type PortfolioSnapshotAnchorRow = {
  timestamp: string;
  cycle_id: string | null;
};

export function parseMarketSnapshotPayload(cycleId: string, payload: unknown): MarketSnapshot | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as MarketSnapshot;

  if (!Array.isArray(candidate.assets) || candidate.assets.length === 0) {
    return null;
  }

  return {
    ...candidate,
    cycleId: typeof candidate.cycleId === "string" ? candidate.cycleId : cycleId,
    timestamp: typeof candidate.timestamp === "string" ? candidate.timestamp : "",
    market: candidate.market ?? {},
  };
}

export function marketSnapshotFromPrices(
  cycleId: string,
  prices: Readonly<Record<string, number>>,
  timestamp?: string
): MarketSnapshot {
  return {
    cycleId,
    timestamp: timestamp ?? new Date().toISOString(),
    assets: Object.entries(prices).map(([symbol, price]) => ({ symbol, price })),
    market: {},
  };
}

export function anchorsFromPortfolioSnapshotRows(
  rows: readonly PortfolioSnapshotAnchorRow[],
  limit: number
): EquityHistoryAnchor[] {
  return latestEquityHistoryRows(rows, limit).flatMap((row) => {
    if (typeof row.timestamp !== "string" || typeof row.cycle_id !== "string" || !row.cycle_id) {
      return [];
    }

    return [{ timestamp: row.timestamp, cycleId: row.cycle_id }];
  });
}

/**
 * Equity curve from the trades ledger + archived market snapshots at each cycle.
 * Ignores stored portfolio_snapshots.equity (may be wrong after cash/position drift).
 */
export function equityCurveFromTradeLedger(
  initialCapital: number,
  trades: readonly Trade[],
  anchors: readonly EquityHistoryAnchor[],
  snapshotByCycleId: ReadonlyMap<string, MarketSnapshot>
): EquityCurvePoint[] {
  if (anchors.length === 0) {
    return [];
  }

  const sortedAnchors = [...anchors].sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp)
  );
  const sortedTrades = [...trades].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)
  );

  let tradeIndex = 0;
  let lastSnapshot: MarketSnapshot | undefined;
  const points: EquityCurvePoint[] = [];

  for (const anchor of sortedAnchors) {
    const anchorMs = Date.parse(anchor.timestamp);

    if (!Number.isFinite(anchorMs)) {
      continue;
    }

    while (tradeIndex < sortedTrades.length) {
      const tradeMs = Date.parse(sortedTrades[tradeIndex].createdAt);

      if (!Number.isFinite(tradeMs) || tradeMs > anchorMs) {
        break;
      }

      tradeIndex += 1;
    }

    const snapshot = snapshotByCycleId.get(anchor.cycleId) ?? lastSnapshot;

    if (!snapshot) {
      continue;
    }

    if (snapshotByCycleId.has(anchor.cycleId)) {
      lastSnapshot = snapshot;
    }

    const applied = sortedTrades.slice(0, tradeIndex);
    const account = replayPaperAccountFromTrades(initialCapital, applied);

    try {
      const { portfolio } = markToMarket(account, snapshot);
      points.push({
        equity: portfolio.equity,
        at: anchor.timestamp,
        label: anchor.cycleId,
      });
    } catch {
      continue;
    }
  }

  return points;
}

export function valuationFromTradeLedger(
  initialCapital: number,
  trades: readonly Trade[],
  prices: Readonly<Record<string, number>>
): PaperValuation {
  const account = replayPaperAccountFromTrades(initialCapital, trades);
  return markToMarket(account, marketSnapshotFromPrices("live", prices));
}

import { describe, expect, it } from "vitest";
import {
  equityCurveFromTradeLedger,
  marketSnapshotFromPrices,
  valuationFromTradeLedger,
} from "@/lib/agent/equity-from-ledger";
import type { MarketSnapshot } from "@/lib/market/types";
import type { Trade } from "@/lib/paper/types";

function trade(overrides: Partial<Trade> & Pick<Trade, "side" | "symbol" | "quantity" | "price">): Trade {
  return {
    id: overrides.id ?? "t1",
    cycleId: overrides.cycleId ?? "cycle-1",
    notional: overrides.notional ?? overrides.quantity * overrides.price,
    createdAt: overrides.createdAt ?? "2026-10-19T12:00:00.000Z",
    ...overrides,
  };
}

function snap(cycleId: string, prices: Record<string, number>, timestamp: string): MarketSnapshot {
  return marketSnapshotFromPrices(cycleId, prices, timestamp);
}

describe("equity-from-ledger", () => {
  it("values open long as cash plus mark-to-market", () => {
    const trades = [
      trade({
        id: "buy-1",
        side: "BUY",
        symbol: "BTC",
        quantity: 0.1,
        price: 80_000,
        createdAt: "2026-10-19T10:00:00.000Z",
      }),
    ];
    const anchors = [{ timestamp: "2026-10-19T11:00:00.000Z", cycleId: "a-1" }];
    const snapshots = new Map([
      ["a-1", snap("a-1", { BTC: 82_000 }, anchors[0].timestamp)],
    ]);

    const points = equityCurveFromTradeLedger(10_000, trades, anchors, snapshots);

    expect(points).toHaveLength(1);
    expect(points[0]?.equity).toBeCloseTo(10_000 - 8_000 + 0.1 * 82_000, 4);
  });

  it("does not double-count when flipping short to flat then buying", () => {
    const trades = [
      trade({
        id: "short-1",
        side: "SHORT",
        symbol: "BTC",
        quantity: 0.1,
        price: 80_000,
        createdAt: "2026-10-19T17:00:00.000Z",
        cycleId: "c-short",
      }),
      trade({
        id: "buy-1",
        side: "BUY",
        symbol: "BTC",
        quantity: 0.1,
        price: 80_000,
        createdAt: "2026-10-19T21:00:00.000Z",
        cycleId: "c-buy",
      }),
    ];
    const anchors = [
      { timestamp: "2026-10-19T18:00:00.000Z", cycleId: "c-after-short" },
      { timestamp: "2026-10-19T22:00:00.000Z", cycleId: "c-after-buy" },
    ];
    const price = 80_000;
    const snapshots = new Map([
      ["c-after-short", snap("c-after-short", { BTC: price }, anchors[0].timestamp)],
      ["c-after-buy", snap("c-after-buy", { BTC: price }, anchors[1].timestamp)],
    ]);

    const points = equityCurveFromTradeLedger(10_000, trades, anchors, snapshots);

    expect(points[0]?.equity).toBeCloseTo(10_000, 2);
    expect(points[1]?.equity).toBeCloseTo(10_000, 2);
  });

  it("valuationFromTradeLedger matches mark-to-market at live prices", () => {
    const trades = [
      trade({
        side: "BUY",
        symbol: "SOL",
        quantity: 10,
        price: 100,
        createdAt: "2026-10-15T00:00:00.000Z",
      }),
    ];
    const valuation = valuationFromTradeLedger(10_000, trades, { SOL: 110 });

    expect(valuation.portfolio.cash).toBeCloseTo(9_000, 4);
    expect(valuation.portfolio.equity).toBeCloseTo(10_100, 4);
  });
});

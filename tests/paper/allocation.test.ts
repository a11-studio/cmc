import { describe, expect, it } from "vitest";
import { buildAllocationSlices } from "@/components/arena/agent-allocation-card";
import {
  cashAllocationPercent,
  unallocatedCashFromEquity,
} from "@/lib/paper/allocation";
import type { MomentumAlphaView } from "@/lib/agent/view";

describe("portfolio allocation helpers", () => {
  it("caps cash allocation at 100% when shorts inflate ledger cash", () => {
    const equity = 10_000;
    const positions = [{ marketValue: -8_000 }];

    expect(unallocatedCashFromEquity(equity, positions)).toBe(2_000);
    expect(cashAllocationPercent(equity, positions)).toBe(20);
  });

  it("arena cash slice stays at or below 100% with short exposure", () => {
    const book: MomentumAlphaView = {
      agent: {
        id: "btc-liquidation-signal",
        name: "BTC",
        strategy: "Signal",
        description: "",
        status: "ACTIVE",
        mark: "momentum",
        equity: 10_000,
        returnPercent: 0,
        drawdownPercent: 0,
        winRatePercent: 0,
        trades: 1,
        initialCapital: 10_000,
        cash: 18_000,
        coins: 8_000,
        dataSource: "live",
        runtimeStatus: "LIVE",
      },
      cash: 18_000,
      cashAllocationPercent: 20,
      realizedPnl: 0,
      unrealizedPnl: 0,
      dayStartEquity: 10_000,
      positions: [
        {
          symbol: "BTC",
          quantity: -0.1,
          averageEntryPrice: 80_000,
          currentPrice: 80_000,
          marketValue: -8_000,
          unrealizedPnl: 0,
          allocationPercent: 80,
        },
      ],
      trades: [],
      decisions: [],
      events: [],
      cycles: [],
      equityCurve: [],
      equitySeries: [],
      latestCycle: null,
      hasCycles: false,
      tradeChecks: [],
    };

    const slices = buildAllocationSlices([book]);
    const cashSlice = slices.find((slice) => slice.id === "cash");

    expect(cashSlice?.percent).toBeCloseTo(20, 4);
    expect(slices.reduce((sum, slice) => sum + slice.percent, 0)).toBeCloseTo(100, 4);
  });
});

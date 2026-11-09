import { describe, expect, it } from "vitest";
import {
  buildHourlyCheckGrid,
  sortTradeChecks,
  summarizeTradeChecks,
  tradeCheckMovePercent,
  tradeCheckTone,
} from "@/lib/charts/trade-heatmap";
import type { TradeCheck } from "@/lib/agent/trade-outcomes";

function check(overrides: Partial<TradeCheck>): TradeCheck {
  return {
    tradeId: "t1",
    cycleId: "c1",
    hourStart: "2026-11-06T08:00:00.000Z",
    symbol: "SOL",
    side: "BUY",
    fillPrice: 100,
    checkPrice: 110,
    createdAt: "2026-11-06T08:02:00.000Z",
    checkedAt: "2026-11-06T09:02:00.000Z",
    win: true,
    kind: "fill",
    fills: 1,
    ...overrides,
  };
}

describe("trade check tones", () => {
  it("orders checks oldest to newest", () => {
    const later = check({ tradeId: "t2", createdAt: "2026-11-06T10:02:00.000Z" });
    const earlier = check({ tradeId: "t1", createdAt: "2026-11-06T09:02:00.000Z" });

    expect(sortTradeChecks([later, earlier]).map((item) => item.tradeId)).toEqual(["t1", "t2"]);
  });

  it("maps next-cycle outcomes to tones", () => {
    expect(tradeCheckTone(check({ win: true }))).toBe("win");
    expect(tradeCheckTone(check({ win: false }))).toBe("loss");
    expect(tradeCheckTone(check({ win: null }))).toBe("pending");
    expect(tradeCheckTone(check({ kind: "hold", win: null, fillPrice: null }))).toBe("hold");
    expect(tradeCheckTone(check({ kind: "blocked", win: null, fillPrice: null }))).toBe("blocked");
    expect(tradeCheckMovePercent(100, 104)).toBeCloseTo(4);
    expect(tradeCheckMovePercent(100, null)).toBeNull();
  });
});

describe("hourly check grid", () => {
  it("lays out one UTC day per row with 24 hour slots", () => {
    const rows = buildHourlyCheckGrid([
      check({ tradeId: "a", hourStart: "2026-11-06T09:00:00.000Z" }),
      check({ tradeId: "b", hourStart: "2026-11-08T23:00:00.000Z", createdAt: "2026-11-08T23:02:00.000Z" }),
    ]);

    expect(rows.map((row) => row.date)).toEqual(["2026-11-06", "2026-11-07", "2026-11-08"]);
    expect(rows.map((row) => row.label)).toEqual(["Fri 6", "Sat 7", "Sun 8"]);
    expect(rows.every((row) => row.hours.length === 24)).toBe(true);
    expect(rows[0]?.hours[9]?.tradeId).toBe("a");
    expect(rows[2]?.hours[23]?.tradeId).toBe("b");
    expect(rows[1]?.hours.every((slot) => slot === null)).toBe(true);
  });

  it("keeps only the last seven days", () => {
    const rows = buildHourlyCheckGrid([
      check({ tradeId: "old", hourStart: "2026-11-01T08:00:00.000Z", createdAt: "2026-11-01T08:02:00.000Z" }),
      check({ tradeId: "new", hourStart: "2026-11-10T08:00:00.000Z", createdAt: "2026-11-10T08:02:00.000Z" }),
    ]);

    expect(rows).toHaveLength(7);
    expect(rows[0]?.date).toBe("2026-11-04");
  });

  it("is empty without checks", () => {
    expect(buildHourlyCheckGrid([])).toEqual([]);
  });
});

describe("summarizeTradeChecks", () => {
  it("counts trades only, never HOLD or blocked hours", () => {
    const summary = summarizeTradeChecks([
      check({ win: true }),
      check({ win: true }),
      check({ win: false }),
      check({ win: null }),
      check({ kind: "hold", win: null, fillPrice: null }),
      check({ kind: "blocked", win: null, fillPrice: null }),
    ]);

    expect(summary).toEqual({
      trades: 4,
      confirmed: 2,
      against: 1,
      pending: 1,
      held: 1,
      blocked: 1,
      hitRatePercent: (2 / 3) * 100,
    });
  });
});

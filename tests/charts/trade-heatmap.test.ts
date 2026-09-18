import { describe, expect, it } from "vitest";
import {
  groupTradeChecksByDay,
  sortTradeChecks,
  tradeCheckMovePercent,
  tradeCheckTone,
} from "@/lib/charts/trade-heatmap";
import type { TradeCheck } from "@/lib/agent/trade-outcomes";

function check(overrides: Partial<TradeCheck>): TradeCheck {
  return {
    tradeId: "t1",
    symbol: "SOL",
    side: "BUY",
    fillPrice: 100,
    checkPrice: 110,
    createdAt: "2026-09-18T08:00:00.000Z",
    checkedAt: "2026-09-18T08:15:00.000Z",
    win: true,
    kind: "fill",
    ...overrides,
  };
}

describe("trade check strip", () => {
  it("orders fills oldest to newest and groups them by local day", () => {
    const later = check({
      tradeId: "t2",
      createdAt: new Date(2026, 8, 18, 10).toISOString(),
      win: false,
    });
    const earlier = check({
      tradeId: "t1",
      createdAt: new Date(2026, 8, 17, 10).toISOString(),
      win: true,
    });

    expect(sortTradeChecks([later, earlier]).map((item) => item.tradeId)).toEqual(["t1", "t2"]);

    const groups = groupTradeChecksByDay([later, earlier]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.checks.map((item) => item.tradeId)).toEqual(["t1"]);
    expect(groups[1]?.checks.map((item) => item.tradeId)).toEqual(["t2"]);
  });

  it("maps next-check outcomes to strip tones", () => {
    expect(tradeCheckTone(check({ win: true }))).toBe("win");
    expect(tradeCheckTone(check({ win: false }))).toBe("loss");
    expect(tradeCheckTone(check({ win: null }))).toBe("pending");
    expect(tradeCheckTone(check({ kind: "hold", win: null, fillPrice: null }))).toBe("hold");
    expect(tradeCheckTone(check({ kind: "blocked", win: null, fillPrice: null }))).toBe("blocked");
    expect(tradeCheckMovePercent(100, 104)).toBeCloseTo(4);
    expect(tradeCheckMovePercent(100, null)).toBeNull();
  });
});

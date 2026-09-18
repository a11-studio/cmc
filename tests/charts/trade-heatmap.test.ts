import { describe, expect, it } from "vitest";
import { buildTradeHeatmap, cellTone, heatmapLevel, HEATMAP_WEEKS } from "@/lib/charts/trade-heatmap";
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
    ...overrides,
  };
}

describe("trade heatmap", () => {
  it("uses GitHub-style intensity buckets", () => {
    expect(heatmapLevel(0)).toBe(0);
    expect(heatmapLevel(1)).toBe(1);
    expect(heatmapLevel(4)).toBe(4);
    expect(cellTone(2, 0)).toBe("win");
    expect(cellTone(0, 2)).toBe("loss");
    expect(cellTone(1, 1)).toBe("mixed");
  });

  it("builds 53 Monday-first weeks and colors the trade day", () => {
    const now = new Date(2026, 8, 18);
    const heatmap = buildTradeHeatmap(
      [
        check({ createdAt: new Date(2026, 8, 18, 10).toISOString(), win: true }),
        check({ tradeId: "t2", createdAt: new Date(2026, 8, 16, 10).toISOString(), win: false }),
      ],
      now
    );

    expect(heatmap.weeks).toHaveLength(HEATMAP_WEEKS);
    expect(heatmap.weeks[0]).toHaveLength(7);
    expect(heatmap.confirmed).toBe(1);
    expect(heatmap.against).toBe(1);

    const cells = heatmap.weeks.flat();
    expect(cells.find((cell) => cell.date === "2026-09-18")).toMatchObject({ tone: "win", level: 1 });
    expect(cells.find((cell) => cell.date === "2026-09-16")).toMatchObject({ tone: "loss", level: 1 });
  });
});

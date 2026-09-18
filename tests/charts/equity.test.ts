import { describe, expect, it } from "vitest";
import {
  equityChange,
  equityIndexAtSvgX,
  nearestEquityIndex,
  normalizeEquityPoints,
} from "@/lib/charts/equity";

describe("equity chart helpers", () => {
  it("normalizes numeric points", () => {
    expect(normalizeEquityPoints([10_000, { equity: 10_120, label: "BUY BTC" }])).toEqual([
      { equity: 10_000 },
      { equity: 10_120, label: "BUY BTC" },
    ]);
  });

  it("snaps the cursor to the nearest point", () => {
    expect(nearestEquityIndex(0, 5)).toBe(0);
    expect(nearestEquityIndex(1, 5)).toBe(4);
    expect(nearestEquityIndex(0.5, 5)).toBe(2);
    expect(nearestEquityIndex(-1, 5)).toBe(0);
  });

  it("selects the first and last points at the plot edges", () => {
    expect(equityIndexAtSvgX(8, 5, 8, 656)).toBe(0);
    expect(equityIndexAtSvgX(20, 5, 8, 656)).toBe(0);
    expect(equityIndexAtSvgX(664, 5, 8, 656)).toBe(4);
    expect(equityIndexAtSvgX(650, 5, 8, 656)).toBe(4);
    expect(equityIndexAtSvgX(8 + 656 / 2, 5, 8, 656)).toBe(2);
  });

  it("computes change versus start", () => {
    expect(equityChange(11_000, 10_000)).toEqual({ amount: 1_000, percent: 10 });
    expect(equityChange(9_500, 10_000)).toEqual({ amount: -500, percent: -5 });
  });
});

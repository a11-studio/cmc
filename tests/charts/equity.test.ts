import { describe, expect, it } from "vitest";
import {
  combineEquitySeries,
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

describe("combineEquitySeries", () => {
  it("sums last-known equity across agents and drops trade labels", () => {
    const combined = combineEquitySeries([
      {
        equitySeries: [
          { equity: 10_000, label: "Start" },
          { equity: 9_000, at: "2026-09-18T08:00:00.000Z", label: "BUY BTC" },
          { equity: 9_100, at: "2026-09-18T08:15:00.000Z", label: "HOLD BTC" },
        ],
      },
      {
        equitySeries: [
          { equity: 10_000, label: "Start" },
          { equity: 11_000, at: "2026-09-18T08:00:02.000Z", label: "BUY SOL" },
        ],
      },
    ]);

    expect(combined).toEqual([
      { equity: 20_000 },
      { equity: 19_000, at: "2026-09-18T08:00:00.000Z" },
      { equity: 20_000, at: "2026-09-18T08:00:02.000Z" },
      { equity: 20_100, at: "2026-09-18T08:15:00.000Z" },
    ]);
  });

  it("keeps a book at starting equity until it has a timed point", () => {
    expect(
      combineEquitySeries([
        { equitySeries: [{ equity: 10_000 }] },
        {
          equitySeries: [
            { equity: 10_000 },
            { equity: 10_200, at: "2026-09-18T09:00:00.000Z" },
          ],
        },
      ])
    ).toEqual([
      { equity: 20_000 },
      { equity: 20_200, at: "2026-09-18T09:00:00.000Z" },
    ]);
  });
});

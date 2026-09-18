import { describe, expect, it } from "vitest";
import { rankShares } from "@/lib/market/shares";

describe("rankShares", () => {
  it("keeps the largest slices and rolls the rest into Others", () => {
    const slices = rankShares(
      [
        { name: "Binance", value: 40 },
        { name: "OKX", value: 30 },
        { name: "Bybit", value: 20 },
        { name: "Bitget", value: 6 },
        { name: "Gate", value: 4 },
      ],
      ["#1", "#2", "#3", "#4", "#5"],
      4
    );

    expect(slices.map((slice) => slice.label)).toEqual(["Binance", "OKX", "Bybit", "Bitget", "Others"]);
    expect(slices.at(-1)?.percent).toBe(4);
    expect(slices[0]?.percent).toBe(40);
  });

  it("returns nothing when every value is missing or zero", () => {
    expect(rankShares([{ name: "Binance", value: 0 }])).toEqual([]);
  });
});

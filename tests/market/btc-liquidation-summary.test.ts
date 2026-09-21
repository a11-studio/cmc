import { describe, expect, it } from "vitest";

import {
  buildBtcLiquidationSignalRead,
  normalizeBtcLiquidationSummaryPayload,
} from "@/lib/market/btc-liquidation-summary";

describe("BTC liquidation summary", () => {
  it("normalizes CMC cryptocurrency liquidation windows", () => {
    const summary = normalizeBtcLiquidationSummaryPayload({
      status: { error_code: 0 },
      data: {
        cryptocurrencies: [
          {
            symbol: "BTC",
            crypto_id: 1,
            quotes: [
              {
                symbol: "USD",
                total_liquidations_1h: 1_000_000,
                long_liquidations_1h: 200_000,
                short_liquidations_1h: 800_000,
                total_liquidations_4h: 4_000_000,
                long_liquidations_4h: 1_000_000,
                short_liquidations_4h: 3_000_000,
                total_liquidations_24h: 40_000_000,
                long_liquidations_24h: 10_000_000,
                short_liquidations_24h: 30_000_000,
                last_updated: "2026-09-21T08:00:00.000Z",
              },
            ],
          },
        ],
      },
    });

    expect(summary?.windows).toHaveLength(3);
    expect(summary?.read.signal).toBe("bullish");
    expect(summary?.read.basedOn).toBe("4h");
  });

  it("builds a neutral signal when flows are balanced", () => {
    const read = buildBtcLiquidationSignalRead([
      {
        label: "4h",
        totalUsd: 2_000_000,
        longUsd: 990_000,
        shortUsd: 1_010_000,
        longSharePercent: 49.5,
        shortSharePercent: 50.5,
        dominantSide: "even",
      },
    ]);

    expect(read.signal).toBe("neutral");
  });

  it("marks long-heavy 4h liquidations as bearish", () => {
    const read = buildBtcLiquidationSignalRead([
      {
        label: "4h",
        totalUsd: 5_000_000,
        longUsd: 3_500_000,
        shortUsd: 1_500_000,
        longSharePercent: 70,
        shortSharePercent: 30,
        dominantSide: "long",
      },
    ]);

    expect(read.signal).toBe("bearish");
  });
});

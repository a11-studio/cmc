import { describe, expect, it } from "vitest";

import {
  blendedLiquidationSkew,
  buildBtcLiquidationSignalRead,
  formatLiquidationSignalLabel,
  liquidationSignalStrength,
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
    expect(summary?.read.signalLabel).toBe("Strongly bullish");
    expect(summary?.read.basedOn).toBe("blend");
  });

  it("builds a neutral signal when blended flows are balanced", () => {
    const read = buildBtcLiquidationSignalRead([
      {
        label: "1h",
        totalUsd: 2_000_000,
        longUsd: 990_000,
        shortUsd: 1_010_000,
        longSharePercent: 49.5,
        shortSharePercent: 50.5,
        dominantSide: "even",
      },
      {
        label: "4h",
        totalUsd: 2_000_000,
        longUsd: 990_000,
        shortUsd: 1_010_000,
        longSharePercent: 49.5,
        shortSharePercent: 50.5,
        dominantSide: "even",
      },
      {
        label: "24h",
        totalUsd: 2_000_000,
        longUsd: 990_000,
        shortUsd: 1_010_000,
        longSharePercent: 49.5,
        shortSharePercent: 50.5,
        dominantSide: "even",
      },
    ]);

    expect(read.signal).toBe("neutral");
    expect(read.basedOn).toBe("blend");
  });

  it("marks long-heavy 4h liquidations as bearish when it is the only window", () => {
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
    expect(read.signalLabel).toBe("Strongly bearish");
    expect(read.strength).toBe("strong");
  });

  it("labels a modest long skew as slightly bearish", () => {
    const read = buildBtcLiquidationSignalRead([
      {
        label: "4h",
        totalUsd: 2_000_000,
        longUsd: 1_120_000,
        shortUsd: 880_000,
        longSharePercent: 54,
        shortSharePercent: 46,
        dominantSide: "long",
      },
    ]);

    expect(read.signal).toBe("bearish");
    expect(read.strength).toBe("slight");
    expect(read.signalLabel).toBe("Slightly bearish");
  });

  it("softens bearish strength when 1h is short-heavy but 4h/24h are long-heavy", () => {
    const windows = [
      {
        label: "1h" as const,
        totalUsd: 800_000,
        longUsd: 160_000,
        shortUsd: 640_000,
        longSharePercent: 20,
        shortSharePercent: 80,
        dominantSide: "short" as const,
      },
      {
        label: "4h" as const,
        totalUsd: 3_400_000,
        longUsd: 2_550_000,
        shortUsd: 850_000,
        longSharePercent: 75,
        shortSharePercent: 25,
        dominantSide: "long" as const,
      },
      {
        label: "24h" as const,
        totalUsd: 109_600_000,
        longUsd: 76_720_000,
        shortUsd: 32_880_000,
        longSharePercent: 70,
        shortSharePercent: 30,
        dominantSide: "long" as const,
      },
    ];

    const skew = blendedLiquidationSkew(windows);
    expect(skew).toBeCloseTo(9, 0);

    const read = buildBtcLiquidationSignalRead(windows);
    expect(read.signal).toBe("bearish");
    expect(read.signalLabel).toBe("Slightly bearish");
    expect(read.reason).toContain("1h short");
    expect(read.reason).toContain("4h long");
  });

  it("maps imbalance bands to strength tiers", () => {
    expect(liquidationSignalStrength(8)).toBe("slight");
    expect(liquidationSignalStrength(16)).toBe("moderate");
    expect(liquidationSignalStrength(30)).toBe("strong");
    expect(formatLiquidationSignalLabel("bullish", "moderate")).toBe("Bullish");
  });
});

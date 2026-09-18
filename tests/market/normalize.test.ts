import { describe, expect, it } from "vitest";
import { MarketDataError } from "@/lib/market/errors";
import {
  normalizeDerivativesExchanges,
  normalizeFearGreed,
  normalizeGlobalMetrics,
  normalizeLiquidations,
  normalizeQuotesResponse,
} from "@/lib/market/normalize";
import { parseSupportedSymbols } from "@/lib/market/symbols";
import {
  sparseQuotesFixture,
  v1QuotesFixture,
  v3QuotesFixture,
} from "@/tests/market/fixtures";

const meta = {
  cycleId: "cycle-test",
  timestamp: "2026-09-17T00:00:00.000Z",
};

describe("parseSupportedSymbols", () => {
  it("maps the supported arena symbols", () => {
    expect(parseSupportedSymbols(["btc", "ETH", "SOL", "bnb", "xrp"])).toEqual([
      "BTC",
      "ETH",
      "SOL",
      "BNB",
      "XRP",
    ]);
  });

  it("rejects unsupported symbols", () => {
    expect(() => parseSupportedSymbols(["BTC", "DOGE"])).toThrow(MarketDataError);
    expect(() => parseSupportedSymbols(["BTC", "DOGE"])).toThrow(/Unsupported symbol: DOGE/);
  });

  it("rejects an empty list", () => {
    expect(() => parseSupportedSymbols([])).toThrow(/At least one symbol/);
  });
});

describe("normalizeQuotesResponse", () => {
  it("normalizes a v3 CMC response for the supported arena symbols", () => {
    const snapshot = normalizeQuotesResponse(
      v3QuotesFixture,
      ["BTC", "ETH", "SOL", "BNB", "XRP"],
      meta
    );

    expect(snapshot.assets.map((asset) => asset.symbol)).toEqual([
      "BTC",
      "ETH",
      "SOL",
      "BNB",
      "XRP",
    ]);
    expect(snapshot.assets[0]).toMatchObject({
      symbol: "BTC",
      price: 97420.12,
      marketCap: 1_920_000_000_000,
      volume24h: 28_400_000_000,
      change1h: 0.4,
      change24h: 1.8,
      change7d: 4.6,
    });
    expect(snapshot.assets[0]?.rsi).toBeUndefined();
    expect(snapshot.assets[0]?.macd).toBeUndefined();
    expect(snapshot.timestamp).toBe("2026-09-17T08:00:00.000Z");
  });

  it("normalizes a v1 keyed-object response", () => {
    const snapshot = normalizeQuotesResponse(v1QuotesFixture, ["ETH", "BTC"], meta);

    expect(snapshot.assets).toEqual([
      expect.objectContaining({ symbol: "ETH", price: 4000 }),
      expect.objectContaining({ symbol: "BTC", price: 100000 }),
    ]);
  });

  it("omits missing optional fields instead of inventing them", () => {
    const snapshot = normalizeQuotesResponse(
      sparseQuotesFixture,
      ["BTC", "ETH", "SOL", "BNB", "XRP"],
      meta
    );
    const btc = snapshot.assets.find((asset) => asset.symbol === "BTC");
    const eth = snapshot.assets.find((asset) => asset.symbol === "ETH");

    expect(btc?.price).toBe(50000);
    expect(btc?.change24h).toBeUndefined();
    expect(btc?.marketCap).toBeUndefined();
    expect(eth?.change24h).toBeUndefined();
    expect(eth?.marketCap).toBeUndefined();
    expect(eth?.rsi).toBeUndefined();
    expect(eth?.ema20).toBeUndefined();
    expect(eth?.sentiment).toBeUndefined();
  });

  it("treats a string error_code of 0 as success", () => {
    const snapshot = normalizeQuotesResponse(
      {
        status: { error_code: "0", error_message: "" },
        data: [
          { id: 1, symbol: "BTC", quote: [{ symbol: "USD", price: 1 }] },
          { id: 1027, symbol: "ETH", quote: [{ symbol: "USD", price: 2 }] },
          { id: 5426, symbol: "SOL", quote: [{ symbol: "USD", price: 3 }] },
          { id: 1839, symbol: "BNB", quote: [{ symbol: "USD", price: 4 }] },
          { id: 52, symbol: "XRP", quote: [{ symbol: "USD", price: 5 }] },
        ],
      },
      ["BTC", "ETH", "SOL", "BNB", "XRP"],
      meta
    );

    expect(snapshot.assets.map((asset) => asset.price)).toEqual([1, 2, 3, 4, 5]);
  });

  it("rejects a malformed payload", () => {
    expect(() => normalizeQuotesResponse("not-json-object", ["BTC"], meta)).toThrow(
      /malformed payload/
    );
  });

  it("rejects a CMC error status", () => {
    expect(() =>
      normalizeQuotesResponse(
        { status: { error_code: 1001, error_message: "Invalid API key" }, data: {} },
        ["BTC"],
        meta
      )
    ).toThrow(MarketDataError);
  });

  it("rejects a response that is missing a requested asset", () => {
    expect(() =>
      normalizeQuotesResponse(
        {
          status: { error_code: 0 },
          data: {
            "1": {
              id: 1,
              symbol: "BTC",
              quote: [{ symbol: "USD", price: 1 }],
            },
          },
        },
        ["BTC", "ETH"],
        meta
      )
    ).toThrow(/did not return ETH/);
  });
});

describe("normalizeGlobalMetrics", () => {
  it("returns optional market aggregates when present", () => {
    expect(
      normalizeGlobalMetrics({
        status: { error_code: 0 },
        data: {
          btc_dominance: 54.2,
          btc_dominance_24h_percentage_change: -0.3,
          quote: {
            USD: {
              total_market_cap: 2_500_000_000_000,
              total_volume_24h: 80_000_000_000,
              total_market_cap_yesterday_percentage_change: 1.4,
              total_volume_24h_yesterday_percentage_change: -8.1,
            },
          },
        },
      })
    ).toEqual({
      totalMarketCap: 2_500_000_000_000,
      totalVolume24h: 80_000_000_000,
      btcDominance: 54.2,
      marketCapChange24h: 1.4,
      volumeChange24h: -8.1,
      btcDominanceChange24h: -0.3,
    });
  });

  it("derives 24h change from yesterday levels when CMC omits the percentage", () => {
    expect(
      normalizeGlobalMetrics({
        status: { error_code: 0 },
        data: {
          btc_dominance: 58.5,
          btc_dominance_yesterday: 57.0,
          quote: {
            USD: {
              total_market_cap: 2_200,
              total_market_cap_yesterday: 2_000,
              total_volume_24h: 90,
              total_volume_24h_yesterday: 100,
            },
          },
        },
      })
    ).toEqual(
      expect.objectContaining({
        marketCapChange24h: 10,
        volumeChange24h: -10,
        btcDominanceChange24h: expect.closeTo((58.5 - 57) / 57 * 100),
      })
    );
  });

  it("keeps optional derivatives volume when CoinMarketCap includes it", () => {
    expect(
      normalizeGlobalMetrics({
        status: { error_code: 0 },
        data: {
          derivatives_volume_24h: 120_000_000_000,
          quote: { USD: { total_market_cap: 1 } },
        },
      }).derivativesVolume24h
    ).toBe(120_000_000_000);
  });

  it("returns an empty market object when the payload is unusable", () => {
    expect(normalizeGlobalMetrics(null)).toEqual({});
    expect(
      normalizeGlobalMetrics({ status: { error_code: 403, error_message: "plan" } })
    ).toEqual({});
  });
});

describe("normalizeFearGreed", () => {
  it("reads the latest CMC Fear and Greed value", () => {
    expect(
      normalizeFearGreed({
        status: { error_code: 0 },
        data: {
          value: 40,
          value_classification: "Neutral",
          update_time: "2024-09-19T02:54:56.017Z",
        },
      })
    ).toEqual({
      fearGreed: 40,
      fearGreedLabel: "Neutral",
    });
  });

  it("does not invent a classification when CoinMarketCap omits it", () => {
    expect(
      normalizeFearGreed({
        status: { error_code: 0 },
        data: { value: "72" },
      })
    ).toEqual({ fearGreed: 72 });
  });
});

describe("normalizeDerivativesExchanges", () => {
  it("sums open interest and 24h derivative volume across venues", () => {
    expect(
      normalizeDerivativesExchanges({
        status: { error_code: 0 },
        data: {
          exchanges: [
            {
              exchange_name: "Binance",
              quotes: [
                {
                  convert_symbol: "USD",
                  open_interest_usd: 20_000_000_000,
                  derivative_volume_usd: 60_000_000_000,
                },
              ],
            },
            {
              exchange_name: "Bybit",
              quotes: [
                {
                  convert_symbol: "USD",
                  open_interest: 10_000_000_000,
                  derivative_volume: 15_000_000_000,
                },
              ],
            },
          ],
        },
      })
    ).toEqual({
      openInterest: 30_000_000_000,
      derivativesVolume24h: 75_000_000_000,
      derivativesVenueCount: 2,
      openInterestVenues: [
        { name: "Binance", value: 20_000_000_000 },
        { name: "Bybit", value: 10_000_000_000 },
      ],
      derivativesVolumeVenues: [
        { name: "Binance", value: 60_000_000_000 },
        { name: "Bybit", value: 15_000_000_000 },
      ],
    });
  });

  it("returns nothing when the payload is unusable", () => {
    expect(normalizeDerivativesExchanges(null)).toEqual({});
    expect(
      normalizeDerivativesExchanges({ status: { error_code: 403 }, data: { exchanges: [] } })
    ).toEqual({});
  });
});

describe("normalizeLiquidations", () => {
  it("reads 24h long and short liquidations", () => {
    expect(
      normalizeLiquidations({
        status: { error_code: 0 },
        data: {
          quotes: [
            {
              symbol: "USD",
              total_liquidations_24h: 520_000_000,
              long_liquidations_24h: 400_000_000,
              short_liquidations_24h: 120_000_000,
            },
          ],
        },
      })
    ).toEqual({
      liquidations24h: 520_000_000,
      longLiquidations24h: 400_000_000,
      shortLiquidations24h: 120_000_000,
    });
  });
});

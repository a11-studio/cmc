import { describe, expect, it, vi } from "vitest";
import { fetchDailyCandles, loadDailyCandles } from "@/lib/market/daily-candles";
import { computeAssetTrend, type DailyCandle } from "@/lib/market/trend";

const DAY = 86_400_000;
const NOW = new Date("2026-11-06T10:00:00.000Z");
const TODAY = Date.UTC(2026, 10, 6);

/** `count` completed days ending yesterday, close = 100 + index, high/low ±2. */
function rampCandles(count: number): DailyCandle[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index;
    return { dayStart: TODAY - (count - index) * DAY, open: close - 1, high: close + 2, low: close - 2, close };
  });
}

describe("computeAssetTrend", () => {
  it("computes averages, channels and ATR from completed days only", () => {
    const candles = [...rampCandles(220), { dayStart: TODAY, open: 1, high: 9_999, low: 1, close: 9_999 }];
    const trend = computeAssetTrend({ candles, price: 330, source: "binance", now: NOW });

    // Closes of the last 50 completed days run 270..319.
    expect(trend?.sma50).toBeCloseTo(294.5, 6);
    expect(trend?.sma200).toBeCloseTo(219.5, 6);
    // Today's partial candle (high 9 999) is excluded from the channel.
    expect(trend?.high20).toBe(321);
    expect(trend?.low20).toBe(298);
    // Every true range is 4 (high-low), previous-close gaps are smaller.
    expect(trend?.atr20).toBe(4);
    expect(trend?.asOfDay).toBe("2026-11-05");
    expect(trend?.priceVsSma50Percent).toBeCloseTo((330 / 294.5 - 1) * 100, 1);
    expect(trend?.return30dPercent).toBeCloseTo((330 / 289 - 1) * 100, 1);
  });

  it("omits indicators that need more history than is available", () => {
    const trend = computeAssetTrend({ candles: rampCandles(30), price: 140, source: "coinbase", now: NOW });

    expect(trend?.high20).toBeDefined();
    expect(trend?.sma50).toBeUndefined();
    expect(trend?.high55).toBeUndefined();
    expect(trend?.return30dPercent).toBeUndefined();
  });

  it("returns undefined without any completed day", () => {
    expect(computeAssetTrend({ candles: [], price: 100, source: "binance", now: NOW })).toBeUndefined();
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("daily candle sources", () => {
  it("falls back to Coinbase when Binance refuses the request", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("binance.vision")) {
        return jsonResponse({ msg: "restricted location" }, 451);
      }

      // Coinbase: [time s, low, high, open, close, volume], newest first.
      return jsonResponse([
        [(TODAY - DAY) / 1000, 98, 104, 100, 103, 1],
        [(TODAY - 2 * DAY) / 1000, 95, 101, 96, 100, 1],
      ]);
    });

    const series = await fetchDailyCandles("BTC", fetchImpl);

    expect(series?.source).toBe("coinbase");
    expect(series?.candles).toContainEqual({ dayStart: TODAY - DAY, open: 100, high: 104, low: 98, close: 103 });
  });

  it("returns null when every source fails", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 500));

    expect(await fetchDailyCandles("ETH", fetchImpl)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("fetches each symbol once per UTC day", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([[TODAY - DAY, "1", "2", "0.5", "1.5"]]));
    const now = new Date("2031-01-02T03:00:00.000Z");

    await loadDailyCandles(["XRP"], { fetchImpl, now });
    await loadDailyCandles(["XRP"], { fetchImpl, now: new Date("2031-01-02T20:00:00.000Z") });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

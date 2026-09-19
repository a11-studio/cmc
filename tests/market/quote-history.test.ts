import { describe, expect, it, beforeEach } from "vitest";
import {
  lookupPriorMarketMetric,
  lookupPriorQuote,
  rememberQuotePoint,
  rememberSnapshot,
  resetQuoteHistory,
} from "@/lib/market/quote-history";
import type { MarketSnapshot } from "@/lib/market/types";

const NOW = "2026-09-17T14:30:00.000Z";

function snapshot(timestamp: string, prices: Record<string, number>): MarketSnapshot {
  return {
    cycleId: timestamp,
    timestamp,
    assets: Object.entries(prices).map(([symbol, price]) => ({ symbol, price })),
    market: {},
  };
}

describe("quote history", () => {
  beforeEach(() => {
    resetQuoteHistory();
  });

  it("returns the snapshot closest to one hour ago", () => {
    rememberSnapshot(snapshot("2026-09-17T13:00:00.000Z", { BTC: 100 }));
    rememberSnapshot(snapshot("2026-09-17T13:30:00.000Z", { BTC: 110 }));
    rememberSnapshot(snapshot("2026-09-17T14:29:00.000Z", { BTC: 120 }));

    const prior = lookupPriorQuote("BTC", 121, NOW);

    expect(prior?.price).toBe(110);
    expect(prior?.at).toBe("2026-09-17T13:30:00.000Z");
    expect(prior?.ageMinutes).toBe(60);
    expect(prior?.changePercent).toBeCloseTo((121 - 110) / 110 * 100, 6);
  });

  it("does not treat a two-minute-old quote as the hourly prior", () => {
    rememberQuotePoint({
      timestamp: "2026-09-17T14:28:00.000Z",
      prices: { BTC: 100 },
    });

    expect(lookupPriorQuote("BTC", 101, NOW)).toBeUndefined();
  });

  it("uses the observation time, not CoinMarketCap last_updated", () => {
    rememberSnapshot(snapshot("2026-09-17T14:30:00.000Z", { BTC: 99 }), "2026-09-17T13:30:00.000Z");

    const prior = lookupPriorQuote("BTC", 110, NOW);

    expect(prior?.price).toBe(99);
    expect(prior?.at).toBe("2026-09-17T13:30:00.000Z");
  });

  it("returns nothing when history is missing", () => {
    expect(lookupPriorQuote("ETH", 2_500, NOW)).toBeUndefined();
  });

  it("compares current open interest to the hourly prior", () => {
    rememberQuotePoint({
      timestamp: "2026-09-17T13:30:00.000Z",
      prices: { BTC: 100 },
      openInterest: 200,
    });

    const prior = lookupPriorMarketMetric("openInterest", 220, NOW);

    expect(prior?.value).toBe(200);
    expect(prior?.ageMinutes).toBe(60);
    expect(prior?.changePercent).toBeCloseTo(10, 6);
  });

  it("keeps one quote per minute so a burst of fetches cannot evict the hourly prior", () => {
    rememberQuotePoint({
      timestamp: "2026-09-17T13:30:01.000Z",
      prices: { BTC: 110 },
    });
    rememberQuotePoint({
      timestamp: "2026-09-17T13:30:59.000Z",
      prices: { BTC: 111 },
    });

    const prior = lookupPriorQuote("BTC", 121, NOW);

    expect(prior?.price).toBe(111);
    expect(prior?.at).toBe("2026-09-17T13:30:00.000Z");
  });
});


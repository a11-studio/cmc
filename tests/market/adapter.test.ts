import { describe, expect, it, vi } from "vitest";
import { CoinMarketCapProvider } from "@/lib/market/cmc/adapter";
import {
  CMC_DERIVATIVES_EXCHANGES_PATH,
  CMC_FEAR_GREED_PATH,
  CMC_LIQUIDATIONS_PATH,
  CMC_QUOTES_PATH,
} from "@/lib/market/cmc/client";
import { MarketDataError } from "@/lib/market/errors";
import { v3QuotesFixture } from "@/tests/market/fixtures";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("CoinMarketCapProvider", () => {
  it("bounds every request with a timeout", async () => {
    // A stalled connection here once held an agent cycle open for 62 minutes.
    const signals: (AbortSignal | null | undefined)[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      signals.push(init?.signal);

      return url.includes(CMC_QUOTES_PATH)
        ? jsonResponse(v3QuotesFixture)
        : jsonResponse({ status: { error_code: 0 }, data: {} });
    });

    const provider = new CoinMarketCapProvider({
      apiKey: "test-secret-key",
      fetchImpl,
      createCycleId: () => "cycle-1",
      now: () => new Date("2026-09-17T00:00:00.000Z"),
    });

    await provider.getMarketSnapshot(["BTC", "ETH", "SOL", "BNB", "XRP"]);

    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((signal) => signal instanceof AbortSignal)).toBe(true);
  });

  it("sends the API key in a header and never in the URL", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).not.toContain("test-secret-key");
      expect(url).not.toContain("CMC_API_KEY");
      expect(new Headers(init?.headers).get("X-CMC_PRO_API_KEY")).toBe("test-secret-key");

      if (url.includes(CMC_QUOTES_PATH)) {
        return jsonResponse(v3QuotesFixture);
      }

      return jsonResponse({ status: { error_code: 0 }, data: {} });
    });

    const provider = new CoinMarketCapProvider({
      apiKey: "test-secret-key",
      fetchImpl,
      createCycleId: () => "cycle-1",
      now: () => new Date("2026-09-17T00:00:00.000Z"),
    });

    const snapshot = await provider.getMarketSnapshot(["BTC", "ETH", "SOL", "BNB", "XRP"]);

    expect(snapshot.cycleId).toBe("cycle-1");
    expect(snapshot.assets).toHaveLength(5);
    expect(snapshot.assets.map((asset) => asset.symbol)).toEqual([
      "BTC",
      "ETH",
      "SOL",
      "BNB",
      "XRP",
    ]);
    expect(fetchImpl).toHaveBeenCalled();
    const quotesUrl = String(fetchImpl.mock.calls.find(([url]) => String(url).includes(CMC_QUOTES_PATH))?.[0]);
    expect(quotesUrl).toContain("id=");
    expect(decodeURIComponent(quotesUrl)).toContain("id=1,1027,5426,1839,52");
    expect(fetchImpl.mock.calls.some(([url]) => String(url).includes(CMC_FEAR_GREED_PATH))).toBe(true);
    expect(fetchImpl.mock.calls.some(([url]) => String(url).includes(CMC_DERIVATIVES_EXCHANGES_PATH))).toBe(true);
  });

  it("attaches optional Fear and Greed and derivatives aggregates", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes(CMC_QUOTES_PATH)) {
        return jsonResponse(v3QuotesFixture);
      }

      if (url.includes(CMC_FEAR_GREED_PATH)) {
        return jsonResponse({
          status: { error_code: 0 },
          data: { value: 28, value_classification: "Fear" },
        });
      }

      if (url.includes(CMC_DERIVATIVES_EXCHANGES_PATH)) {
        return jsonResponse({
          status: { error_code: 0 },
          data: {
            exchanges: [
              {
                quotes: [{ convert_symbol: "USD", open_interest_usd: 5, derivative_volume_usd: 9 }],
              },
            ],
          },
        });
      }

      if (url.includes(CMC_LIQUIDATIONS_PATH)) {
        return jsonResponse({
          status: { error_code: 0 },
          data: {
            quotes: [
              {
                symbol: "USD",
                total_liquidations_24h: 12,
                long_liquidations_24h: 8,
                short_liquidations_24h: 4,
              },
            ],
          },
        });
      }

      return jsonResponse({ status: { error_code: 0 }, data: {} });
    });

    const snapshot = await new CoinMarketCapProvider({
      apiKey: "test-secret-key",
      fetchImpl,
    }).getMarketSnapshot(["BTC", "ETH", "SOL", "BNB", "XRP"]);

    expect(snapshot.market).toMatchObject({
      fearGreed: 28,
      fearGreedLabel: "Fear",
      openInterest: 5,
      derivativesVolume24h: 9,
      derivativesVenueCount: 1,
      liquidations24h: 12,
      longLiquidations24h: 8,
      shortLiquidations24h: 4,
    });
  });

  it("does not call CMC for unsupported symbols", async () => {
    const fetchImpl = vi.fn();
    const provider = new CoinMarketCapProvider({ apiKey: "test-secret-key", fetchImpl });

    await expect(provider.getMarketSnapshot(["DOGE"])).rejects.toMatchObject({
      code: "UNSUPPORTED_SYMBOL",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("surfaces HTTP failures without fabricating quotes", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: { error_code: 0 } }, 503));
    const provider = new CoinMarketCapProvider({ apiKey: "test-secret-key", fetchImpl });

    await expect(provider.getMarketSnapshot(["BTC"])).rejects.toBeInstanceOf(MarketDataError);
    await expect(provider.getMarketSnapshot(["BTC"])).rejects.toMatchObject({
      code: "CMC_UNAVAILABLE",
    });
  });

  it("rejects a missing API key", () => {
    expect(() => new CoinMarketCapProvider({ apiKey: "   " })).toThrow(/CMC_API_KEY is not configured/);
  });
});

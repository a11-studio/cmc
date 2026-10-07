import "server-only";

import { randomUUID } from "node:crypto";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { marketQuotes } from "@/lib/mock-data";
import { cmcGetJson, CMC_QUOTES_PATH } from "@/lib/market/cmc/client";
import { normalizeQuotesResponse } from "@/lib/market/normalize";
import { snapshotToTickers } from "@/lib/market/tickers";
import { ASSET_CATALOG, SUPPORTED_SYMBOLS } from "@/lib/market/symbols";
import type { MarketSource, MarketTickerQuote } from "@/types/arena";

export type ShellMarket = {
  quotes: MarketTickerQuote[];
  source: MarketSource;
};

function cmcApiKey(): string {
  return process.env.CMC_API_KEY?.trim() ?? "";
}

function sampleShellQuotes(): MarketTickerQuote[] {
  return marketQuotes.map((quote) => ({
    symbol: quote.symbol,
    price: quote.price,
    change24h: quote.change24h,
  }));
}

const getCachedLiveQuotes = unstable_cache(
  async () => {
    const apiKey = cmcApiKey();

    if (!apiKey) {
      throw new Error("CMC_API_KEY is not configured");
    }

    const ids = SUPPORTED_SYMBOLS.map((symbol) => String(ASSET_CATALOG[symbol].cmcId)).join(",");
    const payload = await cmcGetJson({
      apiKey,
      path: CMC_QUOTES_PATH,
      params: { id: ids, convert: "USD" },
      fetchImpl: fetch,
      required: true,
    });
    const snapshot = normalizeQuotesResponse(payload, [...SUPPORTED_SYMBOLS], {
      cycleId: randomUUID(),
      timestamp: new Date().toISOString(),
    });

    return snapshotToTickers({ ...snapshot, market: snapshot.market ?? {} });
  },
  ["shell-market-quotes"],
  { revalidate: 30 }
);

export const getShellMarket = cache(async (): Promise<ShellMarket> => {
  const apiKey = cmcApiKey();

  if (!apiKey) {
    return {
      source: "sample",
      quotes: sampleShellQuotes(),
    };
  }

  try {
    return {
      source: "live",
      quotes: await getCachedLiveQuotes(),
    };
  } catch {
    // Keep the ticker readable when CMC is down, rate-limited, or misconfigured.
    return {
      source: "sample",
      quotes: sampleShellQuotes(),
    };
  }
});

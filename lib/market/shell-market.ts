import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { marketQuotes } from "@/lib/mock-data";
import { createMarketDataProvider } from "@/lib/market/provider";
import { snapshotToTickers } from "@/lib/market/tickers";
import { SUPPORTED_SYMBOLS } from "@/lib/market/symbols";
import { hasServerEnv } from "@/lib/env.server";
import type { MarketSource, MarketTickerQuote } from "@/types/arena";

export type ShellMarket = {
  quotes: MarketTickerQuote[];
  source: MarketSource;
};

const getCachedLiveQuotes = unstable_cache(
  async () => {
    const snapshot = await createMarketDataProvider().getMarketSnapshot([...SUPPORTED_SYMBOLS]);
    return snapshotToTickers(snapshot);
  },
  ["shell-market-quotes"],
  { revalidate: 30 }
);

export const getShellMarket = cache(async (): Promise<ShellMarket> => {
  if (!hasServerEnv("CMC_API_KEY")) {
    return {
      source: "sample",
      quotes: marketQuotes.map((quote) => ({
        symbol: quote.symbol,
        price: quote.price,
        change24h: quote.change24h,
      })),
    };
  }

  try {
    return {
      source: "live",
      quotes: await getCachedLiveQuotes(),
    };
  } catch {
    return {
      source: "unavailable",
      quotes: SUPPORTED_SYMBOLS.map((symbol) => ({ symbol })),
    };
  }
});

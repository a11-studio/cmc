import "server-only";

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

export async function getShellMarket(): Promise<ShellMarket> {
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
    const snapshot = await createMarketDataProvider().getMarketSnapshot([...SUPPORTED_SYMBOLS]);

    return {
      source: "live",
      quotes: snapshotToTickers(snapshot),
    };
  } catch {
    return {
      source: "unavailable",
      quotes: SUPPORTED_SYMBOLS.map((symbol) => ({ symbol })),
    };
  }
}

import type { MarketSnapshot } from "@/lib/market/types";
import type { MarketTickerQuote } from "@/types/arena";

export function marketSnapshotFromQuotes(quotes: readonly MarketTickerQuote[]): MarketSnapshot {
  const assets = quotes.flatMap((quote) => {
    if (typeof quote.price !== "number" || !Number.isFinite(quote.price) || quote.price <= 0) {
      return [];
    }

    return [
      {
        symbol: quote.symbol,
        price: quote.price,
        change24h: quote.change24h,
      },
    ];
  });

  return {
    cycleId: "human-trader",
    timestamp: new Date().toISOString(),
    assets,
    market: {},
  };
}

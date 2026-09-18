import { SUPPORTED_SYMBOLS } from "@/lib/market/symbols";
import type { MarketSnapshot } from "@/lib/market/types";
import type { MarketTickerQuote, SupportedSymbol } from "@/types/arena";

export function snapshotToTickers(snapshot: MarketSnapshot): MarketTickerQuote[] {
  const bySymbol = new Map(
    snapshot.assets.map((asset) => [asset.symbol.toUpperCase(), asset] as const)
  );

  return SUPPORTED_SYMBOLS.map((symbol) => {
    const asset = bySymbol.get(symbol);

    return {
      symbol: symbol as SupportedSymbol,
      price: asset?.price,
      change24h: asset?.change24h,
    };
  });
}

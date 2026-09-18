import "server-only";

export { createMarketDataProvider } from "@/lib/market/provider";
export { CoinMarketCapProvider } from "@/lib/market/cmc/adapter";
export { MarketDataError, isMarketDataError } from "@/lib/market/errors";
export { parseSupportedSymbols, SUPPORTED_SYMBOLS, ASSET_CATALOG } from "@/lib/market/symbols";
export type { MarketDataProvider, MarketSnapshot, AssetSnapshot } from "@/lib/market/types";

import "server-only";

import { CoinMarketCapProvider } from "@/lib/market/cmc/adapter";
import { MarketDataError } from "@/lib/market/errors";
import { hasServerEnv } from "@/lib/env.server";
import type { MarketDataProvider } from "@/lib/market/types";

export function createMarketDataProvider(): MarketDataProvider {
  if (!hasServerEnv("CMC_API_KEY")) {
    throw new MarketDataError("CMC_API_KEY is not configured", "MISSING_API_KEY");
  }

  return new CoinMarketCapProvider({
    apiKey: process.env.CMC_API_KEY ?? "",
  });
}

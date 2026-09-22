import "server-only";

import { unstable_cache } from "next/cache";
import { fetchBtcLiquidationSummary, type BtcLiquidationSummary } from "@/lib/market/btc-liquidation-summary";

async function loadBtcLiquidationSummaryFromEnv(): Promise<BtcLiquidationSummary | null> {
  const apiKey = process.env.CMC_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  return fetchBtcLiquidationSummary({ apiKey });
}

const readCached = unstable_cache(
  loadBtcLiquidationSummaryFromEnv,
  ["arena-btc-liquidation-summary"],
  { revalidate: 60 },
);

/**
 * Research UI only — shares one CMC liquidations-by-crypto request per minute per region.
 * Agent cycles call `fetchBtcLiquidationSummary` directly inside the hourly snapshot build.
 */
export async function getCachedBtcLiquidationSummary(): Promise<BtcLiquidationSummary | null> {
  return readCached();
}

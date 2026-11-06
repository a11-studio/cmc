import { normalizeSymbol } from "@/lib/market/symbols";
import type { AssetSnapshot, AssetTrend, MarketSnapshot } from "@/lib/market/types";

export type TrendRegime = "UP" | "DOWN";

function trendSma(trend: AssetTrend | undefined, length: number): number | undefined {
  if (!trend) {
    return undefined;
  }

  if (length === 50) {
    return trend.sma50;
  }

  if (length === 100) {
    return trend.sma100;
  }

  if (length === 200) {
    return trend.sma200;
  }

  return undefined;
}

export function findSnapshotAsset(snapshot: MarketSnapshot, symbol: string): AssetSnapshot | undefined {
  const wanted = normalizeSymbol(symbol);
  return snapshot.assets.find((asset) => normalizeSymbol(asset.symbol) === wanted);
}

/**
 * UP when the live price is above the configured daily SMA, DOWN when below.
 * Undefined when the filter is off or the snapshot has no trend data for the
 * symbol, in which case nothing is blocked on trend grounds.
 */
export function trendRegime(snapshot: MarketSnapshot, symbol: string, smaLength: number): TrendRegime | undefined {
  if (!(smaLength > 0)) {
    return undefined;
  }

  const asset = findSnapshotAsset(snapshot, symbol);
  const sma = trendSma(asset?.trend, smaLength);

  if (!asset || !(sma && sma > 0) || !(asset.price > 0)) {
    return undefined;
  }

  return asset.price >= sma ? "UP" : "DOWN";
}

export function trendFilterDetail(symbol: string, regime: TrendRegime, smaLength: number): string {
  return regime === "DOWN"
    ? `${symbol} is below its ${smaLength}-day average (downtrend): no new long exposure`
    : `${symbol} is above its ${smaLength}-day average (uptrend): no new short exposure`;
}

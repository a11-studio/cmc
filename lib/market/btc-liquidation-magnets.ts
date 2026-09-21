import type { LiquidationSignal } from "@/lib/market/btc-liquidation-summary";

/** Round-dollar band around spot shown on Research (e.g. 81,962 → 80,962 / 82,962). */
export const BTC_LIQUIDATION_MAGNET_OFFSET_USD = 1_000;

export type BtcLiquidationMagnetLevel = {
  price: number;
  side: "below" | "above";
  offsetUsd: number;
  distancePercent: number;
  /** Long liqs below spot vs short liqs above — which cluster the level represents. */
  liquidationBias: "long" | "short";
  /** Stronger pull given the current liquidation flow signal. */
  emphasized: boolean;
};

export type BtcLiquidationMagnetBands = {
  spotPrice: number;
  below: BtcLiquidationMagnetLevel;
  above: BtcLiquidationMagnetLevel;
};

export function buildBtcLiquidationMagnetBands(
  spotPrice: number,
  signal: LiquidationSignal
): BtcLiquidationMagnetBands | null {
  if (!(spotPrice > 0)) {
    return null;
  }

  const offsetUsd = BTC_LIQUIDATION_MAGNET_OFFSET_USD;
  const belowPrice = spotPrice - offsetUsd;
  const abovePrice = spotPrice + offsetUsd;

  const belowDistancePercent = ((belowPrice - spotPrice) / spotPrice) * 100;
  const aboveDistancePercent = ((abovePrice - spotPrice) / spotPrice) * 100;

  const emphasizeBelow = signal === "bearish";
  const emphasizeAbove = signal === "bullish";

  return {
    spotPrice,
    below: {
      price: belowPrice,
      side: "below",
      offsetUsd,
      distancePercent: belowDistancePercent,
      liquidationBias: "long",
      emphasized: emphasizeBelow,
    },
    above: {
      price: abovePrice,
      side: "above",
      offsetUsd,
      distancePercent: aboveDistancePercent,
      liquidationBias: "short",
      emphasized: emphasizeAbove,
    },
  };
}

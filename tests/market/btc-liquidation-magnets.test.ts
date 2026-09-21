import { describe, expect, it } from "vitest";

import {
  BTC_LIQUIDATION_MAGNET_OFFSET_USD,
  buildBtcLiquidationMagnetBands,
} from "@/lib/market/btc-liquidation-magnets";

describe("BTC liquidation magnet bands", () => {
  it("places magnets $1,000 below and above spot", () => {
    const spot = 81_962.64;
    const bands = buildBtcLiquidationMagnetBands(spot, "neutral");

    expect(bands?.below.price).toBe(spot - BTC_LIQUIDATION_MAGNET_OFFSET_USD);
    expect(bands?.above.price).toBe(spot + BTC_LIQUIDATION_MAGNET_OFFSET_USD);
  });

  it("emphasizes the below band on bearish flow", () => {
    const bands = buildBtcLiquidationMagnetBands(81_962.64, "bearish");

    expect(bands?.below.emphasized).toBe(true);
    expect(bands?.above.emphasized).toBe(false);
    expect(bands?.below.liquidationBias).toBe("long");
  });

  it("emphasizes the above band on bullish flow", () => {
    const bands = buildBtcLiquidationMagnetBands(81_962.64, "bullish");

    expect(bands?.above.emphasized).toBe(true);
    expect(bands?.below.emphasized).toBe(false);
    expect(bands?.above.liquidationBias).toBe("short");
  });
});

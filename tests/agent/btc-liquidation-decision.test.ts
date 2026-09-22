import { describe, expect, it } from "vitest";
import { createDecisionContext } from "@/lib/ai/decision";
import { tradeDecisionFromBtcLiquidationSignal } from "@/lib/agent/btc-liquidation-decision";
import type { MarketSnapshot } from "@/lib/market/types";

function contextWithSignal(signal: "bullish" | "bearish" | "neutral", reason = "test") {
  const snapshot: MarketSnapshot = {
    cycleId: "cycle-liq",
    timestamp: "2026-09-22T09:00:00.000Z",
    assets: [
      { symbol: "BTC", price: 80_000 },
      { symbol: "ETH", price: 2_500 },
      { symbol: "SOL", price: 100 },
      { symbol: "BNB", price: 600 },
      { symbol: "XRP", price: 2 },
    ],
    market: {
      btcLiquidation: {
        signal,
        reason,
        basedOn: "4h",
      },
    },
  };

  return createDecisionContext({
    agentId: "btc-liquidation-signal",
    snapshot,
    portfolio: { cash: 10_000, equity: 10_000, positions: [] },
  });
}

describe("tradeDecisionFromBtcLiquidationSignal", () => {
  it("HOLDs on neutral signal", () => {
    const decision = tradeDecisionFromBtcLiquidationSignal(contextWithSignal("neutral"));
    expect(decision.action).toBe("HOLD");
    expect(decision.symbol).toBe("BTC");
    expect(decision.allocationPercent).toBe(0);
  });

  it("SHORTs BTC on bearish signal within headroom", () => {
    const decision = tradeDecisionFromBtcLiquidationSignal(contextWithSignal("bearish", "long flush"));
    expect(decision.action).toBe("SHORT");
    expect(decision.symbol).toBe("BTC");
    expect(decision.allocationPercent).toBeGreaterThan(0);
    expect(decision.allocationPercent).toBeLessThanOrEqual(15);
  });

  it("BUYs BTC on bullish signal within headroom", () => {
    const decision = tradeDecisionFromBtcLiquidationSignal(contextWithSignal("bullish", "short squeeze"));
    expect(decision.action).toBe("BUY");
    expect(decision.symbol).toBe("BTC");
    expect(decision.allocationPercent).toBeGreaterThan(0);
  });

  it("HOLDs when liquidation read is missing", () => {
    const snapshot: MarketSnapshot = {
      cycleId: "c",
      timestamp: "2026-09-22T09:00:00.000Z",
      assets: [{ symbol: "BTC", price: 80_000 }],
      market: {},
    };

    const decision = tradeDecisionFromBtcLiquidationSignal(
      createDecisionContext({
        agentId: "btc-liquidation-signal",
        snapshot,
        portfolio: { cash: 10_000, equity: 10_000, positions: [] },
      })
    );

    expect(decision.action).toBe("HOLD");
  });
});

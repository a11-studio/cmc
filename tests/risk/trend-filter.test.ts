import { describe, expect, it } from "vitest";
import { resolveRiskConstraints } from "@/lib/risk/agent-constraints";
import { DEFAULT_RISK_CONSTRAINTS } from "@/lib/risk/constraints";
import { evaluateRisk } from "@/lib/risk/evaluate";
import { computeTradingHeadroom } from "@/lib/risk/headroom";
import { planProtectiveExits } from "@/lib/risk/protective-exits";
import type { AssetTrend, MarketSnapshot } from "@/lib/market/types";
import type { Position, TradeDecision } from "@/lib/paper/types";
import type { RiskPortfolioState } from "@/lib/risk/types";

function trend(overrides: Partial<AssetTrend>): AssetTrend {
  return { source: "binance", asOfDay: "2026-11-05", ...overrides };
}

/** ETH below its 50-day average (downtrend), SOL above it (uptrend), BTC without trend data. */
function snapshot(): MarketSnapshot {
  return {
    cycleId: "cycle-trend",
    timestamp: "2026-11-06T10:00:00.000Z",
    assets: [
      { symbol: "BTC", price: 76_000 },
      { symbol: "ETH", price: 2_200, trend: trend({ sma50: 2_500, sma200: 2_150, atr20: 100 }) },
      { symbol: "SOL", price: 120, trend: trend({ sma50: 100, sma200: 90, atr20: 6 }) },
    ],
    market: {},
  };
}

function decision(overrides: Partial<TradeDecision>): TradeDecision {
  return {
    action: "BUY",
    symbol: "ETH",
    allocationPercent: 10,
    confidence: 70,
    timeHorizon: "SHORT",
    reasons: [],
    riskFactors: [],
    ...overrides,
  };
}

function portfolio(overrides: Partial<RiskPortfolioState> = {}): RiskPortfolioState {
  return { cash: 10_000, equity: 10_000, drawdownPercent: 0, dayStartEquity: 10_000, positions: [], ...overrides };
}

describe("trend filter in the Risk Engine", () => {
  it("blocks a new long below the 50-day average", () => {
    const result = evaluateRisk({ decision: decision({}), snapshot: snapshot(), portfolio: portfolio() });

    expect(result.executable).toBe(false);
    expect(result.code).toBe("TREND_FILTER");
    expect(result.reason).toContain("below its 50-day average");
  });

  it("blocks a new short above the 50-day average", () => {
    const result = evaluateRisk({
      decision: decision({ action: "SHORT", symbol: "SOL" }),
      snapshot: snapshot(),
      portfolio: portfolio(),
    });

    expect(result.code).toBe("TREND_FILTER");
  });

  it("lets a BUY cover an open short in a downtrend, but not flip it long", () => {
    const result = evaluateRisk({
      decision: decision({ allocationPercent: 12 }),
      snapshot: snapshot(),
      portfolio: portfolio({
        cash: 15_000,
        positions: [{ symbol: "ETH", quantity: -2.2727, marketValue: -5_000, allocationPercent: -5 }],
      }),
    });

    expect(result.verdict).toBe("CONSTRAINED");
    expect(result.adjustedAllocationPercent).toBe(5);
  });

  it("allows trades in the trend direction and on symbols without trend data", () => {
    const withTrend = evaluateRisk({ decision: decision({ action: "SHORT" }), snapshot: snapshot(), portfolio: portfolio() });
    const noTrend = evaluateRisk({ decision: decision({ symbol: "BTC" }), snapshot: snapshot(), portfolio: portfolio() });

    expect(withTrend.verdict).toBe("APPROVED");
    expect(noTrend.verdict).toBe("APPROVED");
  });

  it("is off when trendFilterSma is 0", () => {
    const result = evaluateRisk({
      decision: decision({}),
      snapshot: snapshot(),
      portfolio: portfolio(),
      constraints: { trendFilterSma: 0 },
    });

    expect(result.verdict).toBe("APPROVED");
  });

  it("shows the same limits in the headroom the agent receives", () => {
    const headroom = computeTradingHeadroom({
      portfolio: { cash: 10_000, equity: 10_000, positions: [] },
      symbols: ["BTC", "ETH", "SOL"],
      snapshot: snapshot(),
    });
    const eth = headroom.perSymbol.find((entry) => entry.symbol === "ETH");
    const sol = headroom.perSymbol.find((entry) => entry.symbol === "SOL");

    expect(eth).toMatchObject({ trend: "DOWN", maxBuyPercentOfEquity: 0, maxShortPercentOfEquity: 15 });
    expect(sol).toMatchObject({ trend: "UP", maxBuyPercentOfEquity: 15, maxShortPercentOfEquity: 0 });
    expect(headroom.notes.join(" ")).toContain("Trend filter (50-day average)");
  });
});

function position(symbol: Position["symbol"], quantity: number, averageEntryPrice: number, price: number, equity = 10_000): Position {
  const marketValue = quantity * price;
  return {
    symbol,
    quantity,
    averageEntryPrice,
    currentPrice: price,
    marketValue,
    unrealizedPnl: (price - averageEntryPrice) * quantity,
    allocationPercent: (marketValue / equity) * 100,
  };
}

describe("protective exits", () => {
  it("closes a long that hit its ATR stop", () => {
    const plans = planProtectiveExits({
      snapshot: snapshot(),
      // SOL long from 140, stop 2.5 × 6 = 15 below → 125; price 120.
      positions: [position("SOL", 10, 140, 120)],
      constraints: DEFAULT_RISK_CONSTRAINTS,
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ kind: "STOP", decision: { action: "SELL", symbol: "SOL", allocationPercent: 100 } });
  });

  it("closes a long that sits below its 50-day average", () => {
    const plans = planProtectiveExits({
      snapshot: snapshot(),
      positions: [position("ETH", 1, 2_250, 2_200)],
      constraints: DEFAULT_RISK_CONSTRAINTS,
    });

    expect(plans).toEqual([expect.objectContaining({ kind: "TREND", decision: expect.objectContaining({ allocationPercent: 100 }) })]);
  });

  it("covers a short that sits above its 50-day average", () => {
    const plans = planProtectiveExits({
      snapshot: snapshot(),
      positions: [position("SOL", -5, 119, 120)],
      constraints: DEFAULT_RISK_CONSTRAINTS,
    });

    expect(plans[0]).toMatchObject({ kind: "TREND", decision: { action: "SELL", symbol: "SOL" } });
  });

  it("leaves positions alone in the trend direction and without trend data", () => {
    const plans = planProtectiveExits({
      snapshot: snapshot(),
      positions: [position("SOL", 10, 118, 120), position("BTC", 0.05, 90_000, 76_000), position("ETH", -1, 2_210, 2_200)],
      constraints: DEFAULT_RISK_CONSTRAINTS,
    });

    expect(plans).toEqual([]);
  });

  it("trims Buffett's core to 30% under the 200-day average, once", () => {
    const constraints = resolveRiskConstraints("warren-buffett");
    const below200: MarketSnapshot = {
      ...snapshot(),
      assets: [{ symbol: "ETH", price: 2_000, trend: trend({ sma50: 2_500, sma200: 2_150, atr20: 100 }) }],
    };

    const fullPosition = planProtectiveExits({ snapshot: below200, positions: [position("ETH", 4, 2_300, 2_000)], constraints });
    const alreadyTrimmed = planProtectiveExits({ snapshot: below200, positions: [position("ETH", 1.5, 2_300, 2_000)], constraints });

    // 80% of equity → keep 30%: close 62.5% of the position.
    expect(fullPosition[0]).toMatchObject({ kind: "TREND", decision: { allocationPercent: 62.5 } });
    expect(alreadyTrimmed).toEqual([]);
  });
});

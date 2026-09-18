import { describe, expect, it } from "vitest";
import type { MarketSnapshot } from "@/lib/market/types";
import {
  createPaperAccount,
  executePaperDecision,
  INITIAL_CAPITAL,
  markToMarket,
} from "@/lib/paper";
import type { TradeDecision } from "@/lib/paper";

function snapshot(prices: Record<string, number>, cycleId = "cycle-1"): MarketSnapshot {
  return {
    cycleId,
    timestamp: "2026-09-17T00:00:00.000Z",
    assets: Object.entries(prices).map(([symbol, price]) => ({ symbol, price })),
    market: {},
  };
}

function decision(
  overrides: Partial<TradeDecision> & Pick<TradeDecision, "action" | "symbol" | "allocationPercent">
): TradeDecision {
  return {
    confidence: 80,
    timeHorizon: "SHORT",
    reasons: ["Manual test decision"],
    riskFactors: [],
    ...overrides,
  };
}

describe("paper trading engine", () => {
  it("starts with $10,000 cash and no positions", () => {
    const account = createPaperAccount();
    const valuation = markToMarket(account, snapshot({ BTC: 100_000, ETH: 4_000, SOL: 180 }));

    expect(account.initialCapital).toBe(INITIAL_CAPITAL);
    expect(account.cash).toBe(10_000);
    expect(account.positions).toEqual([]);
    expect(account.trades).toEqual([]);
    expect(valuation.portfolio.equity).toBe(10_000);
    expect(valuation.portfolio.realizedPnl).toBe(0);
    expect(valuation.portfolio.unrealizedPnl).toBe(0);
    expect(valuation.portfolio.returnPercent).toBe(0);
    expect(valuation.portfolio.drawdownPercent).toBe(0);
  });

  it("BUY BTC reduces cash correctly", () => {
    const result = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "BTC", allocationPercent: 10 }),
      snapshot({ BTC: 100_000 })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.account.cash).toBeCloseTo(9_000, 8);
    expect(result.trade?.notional).toBeCloseTo(1_000, 8);
  });

  it("BUY creates the correct quantity from snapshot price", () => {
    const result = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "BTC", allocationPercent: 10 }),
      snapshot({ BTC: 50_000 })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.trade?.price).toBe(50_000);
    expect(result.trade?.quantity).toBeCloseTo(0.02, 10);
    expect(result.valuation.positions[0]?.quantity).toBeCloseTo(0.02, 10);
    expect(result.valuation.positions[0]?.averageEntryPrice).toBe(50_000);
  });

  it("multiple BUYs calculate average entry price correctly", () => {
    const first = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "BTC", allocationPercent: 10 }),
      snapshot({ BTC: 100 }, "cycle-a")
    );

    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const second = executePaperDecision(
      first.account,
      decision({ action: "BUY", symbol: "BTC", allocationPercent: 10 }),
      snapshot({ BTC: 200 }, "cycle-b")
    );

    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }

    const position = second.valuation.positions[0];
    expect(position?.quantity).toBeCloseTo(15.5, 8);
    expect(position?.averageEntryPrice).toBeCloseTo(2100 / 15.5, 8);
  });

  it("SELL increases cash", () => {
    const bought = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "ETH", allocationPercent: 50 }),
      snapshot({ ETH: 100 })
    );

    expect(bought.ok).toBe(true);
    if (!bought.ok) {
      return;
    }

    const sold = executePaperDecision(
      bought.account,
      decision({ action: "SELL", symbol: "ETH", allocationPercent: 100 }),
      snapshot({ ETH: 100 })
    );

    expect(sold.ok).toBe(true);
    if (!sold.ok) {
      return;
    }

    expect(sold.account.cash).toBeCloseTo(10_000, 8);
    expect(sold.trade?.notional).toBeCloseTo(5_000, 8);
  });

  it("SELL calculates realized P&L correctly", () => {
    const bought = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "ETH", allocationPercent: 50 }),
      snapshot({ ETH: 100 }, "buy")
    );

    expect(bought.ok).toBe(true);
    if (!bought.ok) {
      return;
    }

    const sold = executePaperDecision(
      bought.account,
      decision({ action: "SELL", symbol: "ETH", allocationPercent: 100 }),
      snapshot({ ETH: 110 }, "sell")
    );

    expect(sold.ok).toBe(true);
    if (!sold.ok) {
      return;
    }

    expect(sold.trade?.realizedPnl).toBeCloseTo(500, 8);
    expect(sold.account.realizedPnl).toBeCloseTo(500, 8);
    expect(sold.account.cash).toBeCloseTo(10_500, 8);
  });

  it("partial SELL works", () => {
    const bought = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "SOL", allocationPercent: 50 }),
      snapshot({ SOL: 100 })
    );

    expect(bought.ok).toBe(true);
    if (!bought.ok) {
      return;
    }

    const sold = executePaperDecision(
      bought.account,
      decision({ action: "SELL", symbol: "SOL", allocationPercent: 40 }),
      snapshot({ SOL: 100 })
    );

    expect(sold.ok).toBe(true);
    if (!sold.ok) {
      return;
    }

    expect(sold.trade?.quantity).toBeCloseTo(20, 8);
    expect(sold.valuation.positions[0]?.quantity).toBeCloseTo(30, 8);
    expect(sold.account.cash).toBeCloseTo(7_000, 8);
  });

  it("BUY BNB and XRP are valid arena symbols", () => {
    const bnb = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "BNB", allocationPercent: 10 }),
      snapshot({ BNB: 600 })
    );
    const xrp = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "XRP", allocationPercent: 10 }),
      snapshot({ XRP: 2 })
    );

    expect(bnb.ok).toBe(true);
    expect(xrp.ok).toBe(true);
    if (!bnb.ok || !xrp.ok) {
      return;
    }

    expect(bnb.trade?.symbol).toBe("BNB");
    expect(xrp.trade?.symbol).toBe("XRP");
    expect(bnb.account.cash).toBeCloseTo(9_000, 8);
    expect(xrp.account.cash).toBeCloseTo(9_000, 8);
  });

  it("full SELL closes the position", () => {
    const bought = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "BTC", allocationPercent: 25 }),
      snapshot({ BTC: 25_000 })
    );

    expect(bought.ok).toBe(true);
    if (!bought.ok) {
      return;
    }

    const sold = executePaperDecision(
      bought.account,
      decision({ action: "SELL", symbol: "BTC", allocationPercent: 100 }),
      snapshot({ BTC: 25_000 })
    );

    expect(sold.ok).toBe(true);
    if (!sold.ok) {
      return;
    }

    expect(sold.account.positions).toEqual([]);
    expect(sold.valuation.positions).toEqual([]);
  });

  it("HOLD creates no trade", () => {
    const bought = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "BTC", allocationPercent: 10 }),
      snapshot({ BTC: 100_000 }, "buy")
    );

    expect(bought.ok).toBe(true);
    if (!bought.ok) {
      return;
    }

    const held = executePaperDecision(
      bought.account,
      decision({ action: "HOLD", symbol: "BTC", allocationPercent: 0 }),
      snapshot({ BTC: 110_000 }, "hold")
    );

    expect(held.ok).toBe(true);
    if (!held.ok) {
      return;
    }

    expect(held.trade).toBeUndefined();
    expect(held.account.trades).toHaveLength(1);
    expect(held.account.cash).toBe(bought.account.cash);
    expect(held.account.positions[0]?.quantity).toBe(bought.account.positions[0]?.quantity);
  });

  it("equity equals cash plus market value of positions", () => {
    const result = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "BTC", allocationPercent: 20 }),
      snapshot({ BTC: 40_000 })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const marketValue = result.valuation.positions.reduce((sum, position) => sum + position.marketValue, 0);
    expect(result.valuation.portfolio.equity).toBeCloseTo(result.account.cash + marketValue, 8);
    expect(result.valuation.portfolio.equity).toBeCloseTo(10_000, 8);
  });

  it("unrealized P&L is (current price - average entry) × quantity", () => {
    const bought = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "ETH", allocationPercent: 50 }),
      snapshot({ ETH: 100 }, "buy")
    );

    expect(bought.ok).toBe(true);
    if (!bought.ok) {
      return;
    }

    const marked = markToMarket(bought.account, snapshot({ ETH: 130 }, "mark"));
    expect(marked.positions[0]?.unrealizedPnl).toBeCloseTo(1_500, 8);
    expect(marked.portfolio.unrealizedPnl).toBeCloseTo(1_500, 8);
  });

  it("return % compares equity with initial capital", () => {
    const bought = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "ETH", allocationPercent: 50 }),
      snapshot({ ETH: 100 }, "buy")
    );

    expect(bought.ok).toBe(true);
    if (!bought.ok) {
      return;
    }

    const marked = markToMarket(bought.account, snapshot({ ETH: 120 }, "mark"));
    expect(marked.portfolio.equity).toBeCloseTo(11_000, 8);
    expect(marked.portfolio.returnPercent).toBeCloseTo(10, 8);
  });

  it("drawdown is calculated from peak equity", () => {
    const bought = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "BTC", allocationPercent: 50 }),
      snapshot({ BTC: 100 }, "buy")
    );

    expect(bought.ok).toBe(true);
    if (!bought.ok) {
      return;
    }

    const peak = executePaperDecision(
      bought.account,
      decision({ action: "HOLD", symbol: "BTC", allocationPercent: 0 }),
      snapshot({ BTC: 200 }, "peak")
    );

    expect(peak.ok).toBe(true);
    if (!peak.ok) {
      return;
    }

    expect(peak.valuation.portfolio.equity).toBeCloseTo(15_000, 8);
    expect(peak.valuation.portfolio.drawdownPercent).toBeCloseTo(0, 8);

    const drawdown = executePaperDecision(
      peak.account,
      decision({ action: "HOLD", symbol: "BTC", allocationPercent: 0 }),
      snapshot({ BTC: 150 }, "dd")
    );

    expect(drawdown.ok).toBe(true);
    if (!drawdown.ok) {
      return;
    }

    expect(drawdown.valuation.portfolio.equity).toBeCloseTo(12_500, 8);
    expect(drawdown.valuation.portfolio.drawdownPercent).toBeCloseTo((15_000 - 12_500) / 15_000 * 100, 8);
  });

  it("rejects an invalid symbol", () => {
    const result = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "DOGE" as TradeDecision["symbol"], allocationPercent: 10 }),
      snapshot({ BTC: 100_000 })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.code).toBe("UNSUPPORTED_SYMBOL");
    expect(result.account.cash).toBe(10_000);
    expect(result.account.trades).toEqual([]);
  });

  it("rejects a BUY without sufficient cash", () => {
    const first = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "BTC", allocationPercent: 80 }),
      snapshot({ BTC: 100_000 }, "buy-1")
    );

    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const second = executePaperDecision(
      first.account,
      decision({ action: "BUY", symbol: "ETH", allocationPercent: 50 }),
      snapshot({ BTC: 100_000, ETH: 4_000 }, "buy-2")
    );

    expect(second.ok).toBe(false);
    if (second.ok) {
      return;
    }

    expect(second.code).toBe("INSUFFICIENT_CASH");
    expect(second.account).toBe(first.account);
    expect(second.account.trades).toHaveLength(1);
  });

  it("rejects a SELL without a sufficient position", () => {
    const result = executePaperDecision(
      createPaperAccount(),
      decision({ action: "SELL", symbol: "BTC", allocationPercent: 100 }),
      snapshot({ BTC: 100_000 })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.code).toBe("INSUFFICIENT_POSITION");
    expect(result.account.cash).toBe(10_000);
    expect(result.account.trades).toEqual([]);
  });

  it("never uses a price from the decision, only the snapshot", () => {
    const result = executePaperDecision(
      createPaperAccount(),
      {
        ...decision({ action: "BUY", symbol: "BTC", allocationPercent: 10 }),
        // @ts-expect-error execution price is not part of TradeDecision
        price: 1,
      },
      snapshot({ BTC: 80_000 })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.trade?.price).toBe(80_000);
    expect(result.trade?.quantity).toBeCloseTo(1_000 / 80_000, 10);
  });

  it("SHORT opens a negative quantity and credits cash", () => {
    const result = executePaperDecision(
      createPaperAccount(),
      decision({ action: "SHORT", symbol: "BTC", allocationPercent: 10 }),
      snapshot({ BTC: 100_000 })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.trade?.side).toBe("SHORT");
    expect(result.trade?.quantity).toBeCloseTo(0.01, 10);
    expect(result.account.cash).toBeCloseTo(11_000, 8);
    expect(result.account.positions[0]?.quantity).toBeCloseTo(-0.01, 10);
    expect(result.valuation.portfolio.equity).toBeCloseTo(10_000, 8);
    expect(result.valuation.positions[0]?.allocationPercent).toBeCloseTo(-10, 8);
  });

  it("SHORT profits when price falls", () => {
    const opened = executePaperDecision(
      createPaperAccount(),
      decision({ action: "SHORT", symbol: "ETH", allocationPercent: 20 }),
      snapshot({ ETH: 100 }, "open")
    );

    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }

    const marked = markToMarket(opened.account, snapshot({ ETH: 80 }, "mark"));
    expect(marked.positions[0]?.unrealizedPnl).toBeCloseTo(400, 8);
    expect(marked.portfolio.equity).toBeCloseTo(10_400, 8);
  });

  it("BUY covers a short and realizes P&L", () => {
    const opened = executePaperDecision(
      createPaperAccount(),
      decision({ action: "SHORT", symbol: "ETH", allocationPercent: 10 }),
      snapshot({ ETH: 100 }, "short")
    );

    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }

    const marked = markToMarket(opened.account, snapshot({ ETH: 90 }, "mark"));
    const coverAllocation = (Math.abs(marked.positions[0]?.marketValue ?? 0) / marked.portfolio.equity) * 100;
    const covered = executePaperDecision(
      opened.account,
      decision({ action: "BUY", symbol: "ETH", allocationPercent: coverAllocation }),
      snapshot({ ETH: 90 }, "cover")
    );

    expect(covered.ok).toBe(true);
    if (!covered.ok) {
      return;
    }

    expect(covered.trade?.side).toBe("BUY");
    expect(covered.trade?.realizedPnl).toBeCloseTo(100, 8);
    expect(covered.account.realizedPnl).toBeCloseTo(100, 8);
    expect(covered.account.positions).toEqual([]);
    expect(covered.account.cash).toBeCloseTo(10_100, 8);
  });

  it("BUY leftover after covering a short opens a long", () => {
    const opened = executePaperDecision(
      createPaperAccount(),
      decision({ action: "SHORT", symbol: "SOL", allocationPercent: 10 }),
      snapshot({ SOL: 100 }, "short")
    );

    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }

    const flipped = executePaperDecision(
      opened.account,
      decision({ action: "BUY", symbol: "SOL", allocationPercent: 15 }),
      snapshot({ SOL: 100 }, "flip")
    );

    expect(flipped.ok).toBe(true);
    if (!flipped.ok) {
      return;
    }

    expect(flipped.account.positions[0]?.quantity).toBeCloseTo(5, 8);
    expect(flipped.account.positions[0]?.averageEntryPrice).toBeCloseTo(100, 8);
    expect(flipped.trade?.realizedPnl).toBeCloseTo(0, 8);
  });

  it("SHORT leftover after reducing a long opens a short", () => {
    const bought = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "SOL", allocationPercent: 10 }),
      snapshot({ SOL: 100 }, "buy")
    );

    expect(bought.ok).toBe(true);
    if (!bought.ok) {
      return;
    }

    const flipped = executePaperDecision(
      bought.account,
      decision({ action: "SHORT", symbol: "SOL", allocationPercent: 15 }),
      snapshot({ SOL: 100 }, "short")
    );

    expect(flipped.ok).toBe(true);
    if (!flipped.ok) {
      return;
    }

    expect(flipped.account.positions[0]?.quantity).toBeCloseTo(-5, 8);
    expect(flipped.account.positions[0]?.averageEntryPrice).toBeCloseTo(100, 8);
    expect(flipped.account.cash).toBeCloseTo(10_500, 8);
  });

  it("SELL still cannot open a short", () => {
    const result = executePaperDecision(
      createPaperAccount(),
      decision({ action: "SELL", symbol: "BTC", allocationPercent: 50 }),
      snapshot({ BTC: 100_000 })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.code).toBe("INSUFFICIENT_POSITION");
    expect(result.account.positions).toEqual([]);
  });
});

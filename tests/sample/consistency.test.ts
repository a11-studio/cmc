import { describe, expect, it } from "vitest";
import { formatUsd } from "@/lib/format";
import {
  MOMENTUM_ALPHA_CONSTRAINTS,
  SAMPLE_PRICES,
  agentBooks,
  agents,
  arenaSummary,
  marketQuotes,
  sampleDecision,
} from "@/lib/sample";
import {
  assertArenaTotals,
  assertConstraintCompliance,
  assertDrawdownIdentity,
  assertFeaturedDecisionAgreesWithBook,
  assertPortfolioIdentity,
  assertPositionIdentity,
  assertReturnIdentity,
  assertTradeIdentity,
} from "@/lib/sample/consistency";

const momentum = agentBooks.find((book) => book.agent.id === "momentum-alpha")!;

describe("sample portfolio accounting", () => {
  it("starts every agent at $10,000 initial capital", () => {
    for (const agent of agents) {
      expect(agent.initialCapital).toBe(MOMENTUM_ALPHA_CONSTRAINTS.initialCapital);
    }
  });

  it("reconciles cash, positions, and equity for every agent", () => {
    for (const book of agentBooks) {
      assertPortfolioIdentity(book);
      expect(book.cash + book.positions.reduce((sum, position) => sum + position.marketValue, 0)).toBeCloseTo(
        book.agent.equity,
        6
      );
    }
  });

  it("marks positions with coherent quantity, price, P&L, and allocation", () => {
    for (const book of agentBooks) {
      assertPositionIdentity(book);
    }
  });

  it("computes return % from equity versus initial capital", () => {
    for (const book of agentBooks) {
      assertReturnIdentity(book);
      expect(book.agent.returnPercent).toBeCloseTo(
        ((book.agent.equity - book.agent.initialCapital) / book.agent.initialCapital) * 100,
        6
      );
    }
  });

  it("computes drawdown % from peak equity", () => {
    for (const book of agentBooks) {
      assertDrawdownIdentity(book);
      expect(book.equityCurve[0]).toBe(MOMENTUM_ALPHA_CONSTRAINTS.initialCapital);
      expect(book.equityCurve.at(-1)).toBeCloseTo(book.agent.equity, 6);
    }
  });

  it("keeps trade notionals equal to quantity × execution price", () => {
    for (const book of agentBooks) {
      assertTradeIdentity(book);
    }
  });

  it("sums agent equities into arena total equity", () => {
    assertArenaTotals(agentBooks, arenaSummary.totalEquity);
    expect(agents).toHaveLength(1);
    expect(agents[0]?.id).toBe("momentum-alpha");
    expect(arenaSummary.totalEquity).toBeCloseTo(
      agents.reduce((sum, agent) => sum + agent.equity, 0),
      6
    );
    expect(arenaSummary.activeAgents).toBe(1);
  });
});

describe("Momentum Alpha sample constraints", () => {
  it("keeps every demo book inside the published risk limits", () => {
    for (const book of agentBooks) {
      expect(() => assertConstraintCompliance(book)).not.toThrow();
      expect(book.positions.length).toBeLessThanOrEqual(MOMENTUM_ALPHA_CONSTRAINTS.maxOpenPositions);
      expect(book.cash / book.agent.equity * 100).toBeGreaterThanOrEqual(
        MOMENTUM_ALPHA_CONSTRAINTS.minCashPercent
      );
    }
  });

  it("never sizes a sample trade above 15% of equity", () => {
    for (const book of agentBooks) {
      for (const trace of book.traces) {
        if (trace.tradePercentOfEquity != null) {
          expect(trace.tradePercentOfEquity).toBeLessThanOrEqual(
            MOMENTUM_ALPHA_CONSTRAINTS.maxTradePercent + 1e-6
          );
        }
      }
    }
  });

  it("never lets a sample position exceed 20% of equity", () => {
    for (const book of agentBooks) {
      for (const position of book.positions) {
        expect(position.allocationPercent).toBeLessThanOrEqual(
          MOMENTUM_ALPHA_CONSTRAINTS.maxPositionPercent + 1e-6
        );
      }
    }
  });

  it("does not short or use leverage", () => {
    for (const book of agentBooks) {
      expect(book.cash).toBeGreaterThanOrEqual(0);
      for (const position of book.positions) {
        expect(position.quantity).toBeGreaterThan(0);
      }
      for (const trade of book.trades) {
        expect(trade.side === "BUY" || trade.side === "SELL").toBe(true);
        expect(trade.quantity).toBeGreaterThan(0);
      }
    }
  });
});

describe("sample market and activity coherence", () => {
  it("uses a current ETH mark near $2,443, not $4,521", () => {
    expect(SAMPLE_PRICES.ETH).toBeCloseTo(2444.8, 2);
    expect(marketQuotes.find((quote) => quote.symbol === "ETH")?.price).toBe(SAMPLE_PRICES.ETH);
    expect(momentum.positions.find((position) => position.symbol === "ETH")?.currentPrice).toBe(
      SAMPLE_PRICES.ETH
    );
  });

  it("keeps ETH execution prices historically coherent with the current mark", () => {
    const ethTrades = momentum.trades
      .filter((trade) => trade.symbol === "ETH")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    expect(ethTrades.length).toBeGreaterThan(0);

    for (const trade of ethTrades) {
      expect(trade.price).toBeGreaterThan(1_800);
      expect(trade.price).toBeLessThan(2_600);
      expect(Math.abs(trade.price - SAMPLE_PRICES.ETH) / SAMPLE_PRICES.ETH).toBeLessThan(0.25);
    }

    const latestEth = ethTrades.at(-1)!;
    expect(latestEth.price).toBe(2438.4);
    expect(Math.abs(latestEth.price - SAMPLE_PRICES.ETH) / SAMPLE_PRICES.ETH).toBeLessThan(0.02);
    expect(latestEth.createdAt < "2026-09-17T10:55:00.000Z").toBe(true);
  });

  it("makes the featured risk check agree with the resulting ETH position", () => {
    expect(() => assertFeaturedDecisionAgreesWithBook(momentum)).not.toThrow();
    expect(sampleDecision.price).toBe(2438.4);
    expect(sampleDecision.allocationPercent).toBe(6);
    expect(sampleDecision.allocationPercent).toBeLessThanOrEqual(
      MOMENTUM_ALPHA_CONSTRAINTS.maxTradePercent
    );

    const eth = momentum.positions.find((position) => position.symbol === "ETH")!;
    expect(eth.allocationPercent).toBeLessThanOrEqual(MOMENTUM_ALPHA_CONSTRAINTS.maxPositionPercent);
    expect(sampleDecision.riskCheck).toContain("6%");
    expect(sampleDecision.riskCheck).toContain(eth.allocationPercent.toFixed(1));
  });

  it("describes the executed ETH trade with the same notional and price", () => {
    const executed = momentum.events.find((event) => event.type === "TRADE_EXECUTED");
    const trade = momentum.trades.find((item) => item.decisionId === "dec_eth_buy");

    expect(trade).toBeDefined();
    expect(executed?.description).toBe(
      `Bought ${formatUsd(trade!.notional)} ETH @ ${formatUsd(trade!.price)}`
    );
  });
});

import { describe, expect, it } from "vitest";
import { evaluateRisk } from "@/lib/risk";
import { DEFAULT_RISK_CONSTRAINTS } from "@/lib/risk/constraints";
import type { RiskInput, RiskPortfolioState } from "@/lib/risk/types";
import type { MarketSnapshot } from "@/lib/market/types";
import type { TradeDecision } from "@/lib/paper/types";

function snapshot(prices: Record<string, number> = { BTC: 100_000, ETH: 2_500, SOL: 100 }): MarketSnapshot {
  return {
    cycleId: "cycle-risk",
    timestamp: "2026-09-17T12:00:00.000Z",
    assets: Object.entries(prices).map(([symbol, price]) => ({ symbol, price })),
    market: {},
  };
}

function decision(overrides: Partial<TradeDecision> = {}): TradeDecision {
  return {
    action: "BUY",
    symbol: "ETH",
    allocationPercent: 12,
    confidence: 70,
    timeHorizon: "SHORT",
    reasons: ["Test decision"],
    riskFactors: [],
    ...overrides,
  };
}

function portfolio(overrides: Partial<RiskPortfolioState> = {}): RiskPortfolioState {
  return {
    cash: 10_000,
    equity: 10_000,
    drawdownPercent: 0,
    dayStartEquity: 10_000,
    positions: [],
    ...overrides,
  };
}

function input(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    decision: decision(),
    snapshot: snapshot(),
    portfolio: portfolio(),
    agentStatus: "ACTIVE",
    ...overrides,
  };
}

describe("Risk Engine approvals", () => {
  it("approves a BUY inside all default limits", () => {
    const result = evaluateRisk(input({ decision: decision({ allocationPercent: 12 }) }));

    expect(result.verdict).toBe("APPROVED");
    expect(result.approved).toBe(true);
    expect(result.executable).toBe(true);
    expect(result.code).toBe("APPROVED");
    expect(result.reason).toBe("Position size approved (12%)");
    expect(result.allowedDecision?.allocationPercent).toBe(12);
  });

  it("approves HOLD without changing the book", () => {
    const result = evaluateRisk(input({ decision: decision({ action: "HOLD", allocationPercent: 0 }) }));

    expect(result.verdict).toBe("APPROVED");
    expect(result.reason).toBe("HOLD approved");
    expect(result.allowedDecision?.allocationPercent).toBe(0);
  });

  it("approves a SELL of 40% of an existing position", () => {
    const result = evaluateRisk(
      input({
        decision: decision({ action: "SELL", symbol: "ETH", allocationPercent: 40 }),
        portfolio: portfolio({
          cash: 8_500,
          equity: 10_000,
          positions: [{ symbol: "ETH", quantity: 0.6, marketValue: 1_500, allocationPercent: 15 }],
        }),
      })
    );

    expect(result.verdict).toBe("APPROVED");
    expect(result.allowedDecision?.allocationPercent).toBe(40);
  });

  it("approves adding to an existing position when three names are already open", () => {
    const result = evaluateRisk(
      input({
        decision: decision({ action: "BUY", symbol: "ETH", allocationPercent: 5 }),
        portfolio: portfolio({
          cash: 7_000,
          equity: 10_000,
          positions: [
            { symbol: "BTC", quantity: 0.01, marketValue: 1_000, allocationPercent: 10 },
            { symbol: "ETH", quantity: 0.4, marketValue: 1_000, allocationPercent: 10 },
            { symbol: "SOL", quantity: 10, marketValue: 1_000, allocationPercent: 10 },
          ],
        }),
      })
    );

    expect(result.verdict).toBe("APPROVED");
  });

  it("approves a SHORT inside all default limits", () => {
    const result = evaluateRisk(input({ decision: decision({ action: "SHORT", allocationPercent: 12 }) }));

    expect(result.verdict).toBe("APPROVED");
    expect(result.approved).toBe(true);
    expect(result.executable).toBe(true);
    expect(result.allowedDecision?.allocationPercent).toBe(12);
  });
});

describe("Risk Engine constraints", () => {
  it("constrains a BUY above max trade size to 15% of equity", () => {
    const result = evaluateRisk(input({ decision: decision({ allocationPercent: 20 }) }));

    expect(result.verdict).toBe("CONSTRAINED");
    expect(result.approved).toBe(false);
    expect(result.executable).toBe(true);
    expect(result.adjustedAllocationPercent).toBe(DEFAULT_RISK_CONSTRAINTS.maxTradePercent);
    expect(result.allowedDecision?.allocationPercent).toBe(15);
    expect(result.decision.allocationPercent).toBe(20);
    expect(result.reason).toMatch(/reduced from 20% to 15%/);
  });

  it("allows a BUY that adds to a 20% position when trade size is inside the 15% cap", () => {
    const result = evaluateRisk(
      input({
        decision: decision({ allocationPercent: 15 }),
        portfolio: portfolio({
          cash: 8_000,
          equity: 10_000,
          positions: [{ symbol: "ETH", quantity: 8, marketValue: 2_000, allocationPercent: 20 }],
        }),
      })
    );

    expect(result.verdict).toBe("APPROVED");
    expect(result.adjustedAllocationPercent).toBe(15);
  });

  it("constrains a BUY that would spend more than remaining cash", () => {
    const result = evaluateRisk(
      input({
        decision: decision({ allocationPercent: 15 }),
        portfolio: portfolio({
          cash: 1_200,
          equity: 10_000,
          positions: [{ symbol: "BTC", quantity: 0.088, marketValue: 8_800, allocationPercent: 88 }],
        }),
      })
    );

    expect(result.verdict).toBe("CONSTRAINED");
    expect(result.adjustedAllocationPercent).toBeCloseTo(12, 8);
    expect(result.reason).toMatch(/require leverage/);
  });

  it("constrains a full SELL of an 18% position so the trade stays within 15% of equity", () => {
    const result = evaluateRisk(
      input({
        decision: decision({ action: "SELL", symbol: "ETH", allocationPercent: 100 }),
        portfolio: portfolio({
          cash: 8_200,
          equity: 10_000,
          positions: [{ symbol: "ETH", quantity: 0.72, marketValue: 1_800, allocationPercent: 18 }],
        }),
      })
    );

    expect(result.verdict).toBe("CONSTRAINED");
    expect(result.adjustedAllocationPercent).toBeCloseTo((1_500 / 1_800) * 100, 8);
  });

  it("constrains a SHORT above max trade size to 15% of equity", () => {
    const result = evaluateRisk(input({ decision: decision({ action: "SHORT", allocationPercent: 20 }) }));

    expect(result.verdict).toBe("CONSTRAINED");
    expect(result.adjustedAllocationPercent).toBe(DEFAULT_RISK_CONSTRAINTS.maxTradePercent);
    expect(result.allowedDecision?.allocationPercent).toBe(15);
  });

  it("allows adding to an 18% short up to the 15% max trade", () => {
    const result = evaluateRisk(
      input({
        decision: decision({ action: "SHORT", symbol: "ETH", allocationPercent: 15 }),
        portfolio: portfolio({
          cash: 11_800,
          equity: 10_000,
          positions: [{ symbol: "ETH", quantity: -0.72, marketValue: -1_800, allocationPercent: -18 }],
        }),
      })
    );

    expect(result.verdict).toBe("APPROVED");
    expect(result.adjustedAllocationPercent).toBe(15);
  });
});

describe("Risk Engine blocks", () => {
  it("blocks an invalid action", () => {
    const result = evaluateRisk(input({ decision: decision({ action: "YEET" as TradeDecision["action"] }) }));

    expect(result.verdict).toBe("BLOCKED");
    expect(result.code).toBe("INVALID_ACTION");
    expect(result.allowedDecision).toBeUndefined();
  });

  it("blocks an unsupported symbol", () => {
    const result = evaluateRisk(input({ decision: decision({ symbol: "DOGE" as TradeDecision["symbol"] }) }));

    expect(result.verdict).toBe("BLOCKED");
    expect(result.code).toBe("UNSUPPORTED_SYMBOL");
  });

  it("blocks a BUY with non-positive allocation", () => {
    const result = evaluateRisk(input({ decision: decision({ allocationPercent: 0 }) }));

    expect(result.verdict).toBe("BLOCKED");
    expect(result.code).toBe("INVALID_ALLOCATION");
  });

  it("blocks a BUY when the book is already fully in that symbol", () => {
    const result = evaluateRisk(
      input({
        decision: decision({ allocationPercent: 10 }),
        portfolio: portfolio({
          cash: 0,
          equity: 10_000,
          positions: [{ symbol: "ETH", quantity: 40, marketValue: 10_000, allocationPercent: 100 }],
        }),
      })
    );

    expect(result.verdict).toBe("BLOCKED");
    expect(result.reason).toBe("Rejected: maximum position size exceeded");
  });

  it("constrains a SHORT that would exceed 100% of equity in one symbol", () => {
    const result = evaluateRisk(
      input({
        decision: decision({ action: "SHORT", symbol: "ETH", allocationPercent: 15 }),
        portfolio: portfolio({
          cash: 19_200,
          equity: 10_000,
          positions: [{ symbol: "ETH", quantity: -3.68, marketValue: -9_200, allocationPercent: -92 }],
        }),
      })
    );

    expect(result.verdict).toBe("CONSTRAINED");
    expect(result.adjustedAllocationPercent).toBeCloseTo(8, 8);
  });

  it("allows a BUY that spends the last cash into a concentrated long", () => {
    const result = evaluateRisk(
      input({
        decision: decision({ allocationPercent: 10 }),
        portfolio: portfolio({
          cash: 1_000,
          equity: 10_000,
          positions: [{ symbol: "BTC", quantity: 0.09, marketValue: 9_000, allocationPercent: 90 }],
        }),
      })
    );

    expect(result.verdict).toBe("APPROVED");
    expect(result.adjustedAllocationPercent).toBe(10);
  });

  it("blocks a BUY when there is no cash left", () => {
    const result = evaluateRisk(
      input({
        decision: decision({ allocationPercent: 5 }),
        portfolio: portfolio({
          cash: 0,
          equity: 10_000,
          positions: [
            { symbol: "BTC", quantity: 0.04, marketValue: 4_000, allocationPercent: 40 },
            { symbol: "ETH", quantity: 2.4, marketValue: 6_000, allocationPercent: 60 },
          ],
        }),
      })
    );

    expect(result.verdict).toBe("BLOCKED");
    expect(result.reason).toBe("Rejected: leverage is not allowed");
  });

  it("blocks opening a new position when max open positions is reached", () => {
    const result = evaluateRisk(
      input({
        decision: decision({ action: "BUY", symbol: "SOL", allocationPercent: 8 }),
        constraints: { maxOpenPositions: 2 },
        portfolio: portfolio({
          cash: 8_000,
          equity: 10_000,
          positions: [
            { symbol: "BTC", quantity: 0.01, marketValue: 1_000, allocationPercent: 10 },
            { symbol: "ETH", quantity: 0.4, marketValue: 1_000, allocationPercent: 10 },
          ],
        }),
      })
    );

    expect(result.verdict).toBe("BLOCKED");
    expect(result.code).toBe("MAX_OPEN_POSITIONS");
    expect(result.reason).toBe("Rejected: maximum open positions reached");
  });

  it("blocks a SELL without a long instead of opening a short", () => {
    const result = evaluateRisk(input({ decision: decision({ action: "SELL", allocationPercent: 50 }) }));

    expect(result.verdict).toBe("BLOCKED");
    expect(result.code).toBe("INSUFFICIENT_POSITION");
    expect(result.reason).toBe("Rejected: no position to sell");
  });

  it("blocks SHORT when shorting is disabled", () => {
    const result = evaluateRisk(
      input({
        decision: decision({ action: "SHORT", allocationPercent: 10 }),
        constraints: { shorting: false },
      })
    );

    expect(result.verdict).toBe("BLOCKED");
    expect(result.code).toBe("SHORTING_FORBIDDEN");
    expect(result.reason).toBe("Rejected: shorting is not allowed");
  });

  it("blocks a BUY after the 5% daily loss limit", () => {
    const portfolioState = portfolio({
      cash: 9_400,
      equity: 9_400,
      dayStartEquity: 10_000,
      drawdownPercent: 6,
    });

    const buy = evaluateRisk(input({ decision: decision({ allocationPercent: 8 }), portfolio: portfolioState }));
    const sell = evaluateRisk(
      input({
        decision: decision({ action: "SELL", symbol: "ETH", allocationPercent: 50 }),
        portfolio: {
          ...portfolioState,
          cash: 8_000,
          positions: [{ symbol: "ETH", quantity: 0.56, marketValue: 1_400, allocationPercent: 14.89 }],
        },
      })
    );
    const hold = evaluateRisk(
      input({ decision: decision({ action: "HOLD", allocationPercent: 0 }), portfolio: portfolioState })
    );

    expect(buy.verdict).toBe("BLOCKED");
    expect(buy.code).toBe("DAILY_LOSS_LIMIT");
    expect(sell.verdict).toBe("APPROVED");
    expect(hold.verdict).toBe("APPROVED");

    const cover = evaluateRisk(
      input({
        decision: decision({ action: "BUY", symbol: "ETH", allocationPercent: 8 }),
        portfolio: {
          ...portfolioState,
          cash: 11_400,
          positions: [{ symbol: "ETH", quantity: -0.56, marketValue: -1_400, allocationPercent: -14.89 }],
        },
      })
    );
    const short = evaluateRisk(
      input({
        decision: decision({ action: "SHORT", symbol: "ETH", allocationPercent: 8 }),
        portfolio: portfolioState,
      })
    );

    expect(cover.verdict).toBe("APPROVED");
    expect(short.verdict).toBe("BLOCKED");
    expect(short.code).toBe("DAILY_LOSS_LIMIT");
  });

  it("blocks a BUY after the 15% drawdown limit", () => {
    const result = evaluateRisk(
      input({
        decision: decision({ allocationPercent: 8 }),
        portfolio: portfolio({
          cash: 8_500,
          equity: 8_500,
          drawdownPercent: 15,
          dayStartEquity: 8_500,
        }),
      })
    );

    expect(result.verdict).toBe("BLOCKED");
    expect(result.code).toBe("DRAWDOWN_LIMIT");
    expect(result.reason).toBe("Rejected: maximum drawdown reached");
  });

  it("blocks BUY and SELL when the agent is paused, but still allows HOLD", () => {
    const pausedBuy = evaluateRisk(input({ agentStatus: "PAUSED" }));
    const pausedSell = evaluateRisk(
      input({
        agentStatus: "PAUSED",
        decision: decision({ action: "SELL", allocationPercent: 50 }),
        portfolio: portfolio({
          cash: 8_500,
          equity: 10_000,
          positions: [{ symbol: "ETH", quantity: 0.6, marketValue: 1_500, allocationPercent: 15 }],
        }),
      })
    );
    const pausedHold = evaluateRisk(
      input({ agentStatus: "PAUSED", decision: decision({ action: "HOLD", allocationPercent: 0 }) })
    );

    expect(pausedBuy.verdict).toBe("BLOCKED");
    expect(pausedBuy.code).toBe("AGENT_PAUSED");
    expect(pausedSell.verdict).toBe("BLOCKED");
    expect(pausedHold.verdict).toBe("APPROVED");
  });

  it("blocks a BUY when the snapshot has no execution price", () => {
    const result = evaluateRisk(input({ snapshot: snapshot({ BTC: 100_000, SOL: 100 }) }));

    expect(result.verdict).toBe("BLOCKED");
    expect(result.code).toBe("MISSING_PRICE");
  });

  it("constrains a BUY to remaining cash instead of allowing leverage", () => {
    const result = evaluateRisk(
      input({
        decision: decision({ allocationPercent: 15 }),
        portfolio: portfolio({
          cash: 400,
          equity: 10_000,
          positions: [{ symbol: "BTC", quantity: 0.096, marketValue: 9_600, allocationPercent: 96 }],
        }),
      })
    );

    expect(result.verdict).toBe("CONSTRAINED");
    expect(result.executable).toBe(true);
    expect(result.adjustedAllocationPercent).toBeCloseTo(4, 8);
  });
});

describe("Risk Engine purity", () => {
  it("does not mutate the original decision", () => {
    const original = decision({ allocationPercent: 20 });
    const result = evaluateRisk(input({ decision: original }));

    expect(result.verdict).toBe("CONSTRAINED");
    expect(original.allocationPercent).toBe(20);
    expect(result.allowedDecision).not.toBe(original);
  });

  it("is deterministic for the same input", () => {
    const payload = input({ decision: decision({ allocationPercent: 12 }) });
    const first = evaluateRisk(payload);
    const second = evaluateRisk(payload);

    expect(first).toEqual(second);
  });
});

import { describe, expect, it } from "vitest";
import { scoreBookTradeChecks, scoreTradeCheck, scoreTradesAgainstNextCheck } from "@/lib/agent/trade-outcomes";
import type { AgentCycleResult } from "@/lib/agent/types";
import type { Trade } from "@/lib/paper/types";

function trade(overrides: Partial<Trade>): Trade {
  return {
    id: "t1",
    symbol: "SOL",
    side: "BUY",
    quantity: 1,
    price: 100,
    notional: 100,
    cycleId: "c1",
    createdAt: "2026-09-18T08:00:00.000Z",
    ...overrides,
  };
}

function cycle(
  cycleId: string,
  completedAt: string,
  price: number,
  symbol: Trade["symbol"] = "SOL"
): AgentCycleResult {
  return {
    status: "COMPLETED",
    agentId: "momentum-alpha",
    strategy: "Narrative momentum",
    cycleId,
    snapshotTimestamp: completedAt,
    snapshot: {
      cycleId,
      timestamp: completedAt,
      assets: [
        { symbol: "BTC", price: 1 },
        { symbol: "ETH", price: 1 },
        { symbol: "SOL", price: symbol === "SOL" ? price : 1 },
        { symbol: "BNB", price: 1 },
        { symbol: "XRP", price: symbol === "XRP" ? price : 1 },
      ],
      market: {},
    },
    decision: null,
    riskResult: null,
    execution: null,
    valuation: null,
    account: {
      initialCapital: 10_000,
      cash: 10_000,
      peakEquity: 10_000,
      realizedPnl: 0,
      positions: [],
      trades: [],
    },
    events: [],
    startedAt: completedAt,
    completedAt,
    trace: {
      agentId: "momentum-alpha",
      strategy: "Narrative momentum",
      cycleId,
      snapshotTimestamp: completedAt,
      decision: null,
      riskResult: null,
      execution: null,
    },
  };
}

describe("scoreTradeCheck", () => {
  it("marks a BUY green when the next check is higher", () => {
    expect(scoreTradeCheck("BUY", 100, 110)).toBe(true);
    expect(scoreTradeCheck("BUY", 100, 90)).toBe(false);
  });

  it("marks a SHORT green when the next check is lower", () => {
    expect(scoreTradeCheck("SHORT", 2, 1.5)).toBe(true);
    expect(scoreTradeCheck("SHORT", 2, 2.4)).toBe(false);
  });

  it("treats SELL like a short: green when price falls after the exit", () => {
    expect(scoreTradeCheck("SELL", 600, 590)).toBe(true);
    expect(scoreTradeCheck("SELL", 600, 610)).toBe(false);
  });

  it("leaves an unchanged mark unscored", () => {
    expect(scoreTradeCheck("BUY", 100, 100)).toBeNull();
  });
});

describe("scoreTradesAgainstNextCheck", () => {
  it("uses the next cycle snapshot, not the fill cycle", () => {
    const checks = scoreTradesAgainstNextCheck(
      [trade({ cycleId: "c1", price: 100 })],
      [
        cycle("c1", "2026-09-18T08:00:00.000Z", 100),
        cycle("c2", "2026-09-18T08:15:00.000Z", 104),
      ]
    );

    expect(checks).toEqual([
      expect.objectContaining({
        side: "BUY",
        fillPrice: 100,
        checkPrice: 104,
        win: true,
      }),
    ]);
  });

  it("mis-scores when the fill cycle is missing from the supplied cycle list", () => {
    const checks = scoreTradesAgainstNextCheck(
      [trade({ cycleId: "c-old", price: 100, createdAt: "2026-09-18T08:00:00.000Z" })],
      [cycle("c-new", "2026-09-20T08:00:00.000Z", 120)]
    );

    expect(checks[0]?.checkPrice).toBe(120);
    expect(checks[0]?.win).toBe(true);
  });

  it("keeps a fill pending until a later snapshot exists", () => {
    expect(
      scoreTradesAgainstNextCheck(
        [trade({ cycleId: "c1" })],
        [cycle("c1", "2026-09-18T08:00:00.000Z", 100)]
      )
    ).toEqual([
      expect.objectContaining({
        tradeId: "t1",
        win: null,
        checkPrice: null,
        checkedAt: null,
        kind: "fill",
      }),
    ]);
  });
});

describe("scoreBookTradeChecks", () => {
  it("keeps fills and adds HOLD and blocked decisions that never filled", () => {
    const hold = cycle("c-hold", "2026-09-18T08:15:00.000Z", 101);
    hold.decision = {
      action: "HOLD",
      symbol: "SOL",
      allocationPercent: 0,
      confidence: 40,
      timeHorizon: "MEDIUM",
      reasons: ["No breakout"],
      riskFactors: [],
    };

    const blocked = cycle("c-block", "2026-09-18T08:30:00.000Z", 102);
    blocked.status = "BLOCKED";
    blocked.decision = {
      action: "BUY",
      symbol: "SOL",
      allocationPercent: 5,
      confidence: 75,
      timeHorizon: "MEDIUM",
      reasons: ["Breakout"],
      riskFactors: [],
    };
    blocked.riskResult = {
      verdict: "BLOCKED",
      approved: false,
      executable: false,
      code: "MAX_POSITION_EXCEEDED",
      reason: "Rejected: maximum position size exceeded",
      decision: blocked.decision,
      checks: [],
    };

    const checks = scoreBookTradeChecks(
      [trade({ cycleId: "c1", price: 100, createdAt: "2026-09-18T08:00:00.000Z" })],
      [cycle("c1", "2026-09-18T08:00:00.000Z", 100), hold, blocked]
    );

    expect(checks.map((item) => item.kind)).toEqual(["fill", "hold", "blocked"]);
    expect(checks[0]?.win).toBe(true);
    expect(checks[1]).toMatchObject({ side: "HOLD", fillPrice: null, kind: "hold" });
    expect(checks[2]).toMatchObject({ side: "BUY", fillPrice: null, kind: "blocked" });
  });
});

import { describe, expect, it } from "vitest";
import { scoreBookTradeChecks, scoreTradeCheck } from "@/lib/agent/trade-outcomes";
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

  it("judges a SELL that closed a long like a short: green when price falls after the exit", () => {
    expect(scoreTradeCheck("SELL", 600, 590)).toBe(true);
    expect(scoreTradeCheck("SELL", 600, 610)).toBe(false);
  });

  it("judges a SELL that covered a short like a buy: green when price rises after the cover", () => {
    expect(scoreTradeCheck("SELL", 600, 610, true)).toBe(true);
    expect(scoreTradeCheck("SELL", 600, 590, true)).toBe(false);
  });

  it("leaves an unchanged mark unscored", () => {
    expect(scoreTradeCheck("BUY", 100, 100)).toBeNull();
  });
});

describe("scoreBookTradeChecks: fills", () => {
  it("scores a fill against the next hourly cycle, not the fill cycle", () => {
    const checks = scoreBookTradeChecks(
      [trade({ cycleId: "c1", price: 100 })],
      [cycle("c1", "2026-09-18T08:02:00.000Z", 100), cycle("c2", "2026-09-18T09:02:00.000Z", 104)]
    );

    expect(checks).toEqual([
      expect.objectContaining({
        cycleId: "c1",
        hourStart: "2026-09-18T08:00:00.000Z",
        side: "BUY",
        fillPrice: 100,
        checkPrice: 104,
        checkedAt: "2026-09-18T09:02:00.000Z",
        win: true,
        fills: 1,
      }),
    ]);
  });

  it("keeps a fill pending until a later cycle exists", () => {
    expect(scoreBookTradeChecks([trade({ cycleId: "c1" })], [cycle("c1", "2026-09-18T08:00:00.000Z", 100)])).toEqual([
      expect.objectContaining({ tradeId: "t1", win: null, checkPrice: null, checkedAt: null, kind: "fill" }),
    ]);
  });

  it("makes one square per cycle and scores the decision fill over a protective exit", () => {
    const fillCycle = cycle("c1", "2026-09-18T08:02:00.000Z", 100);
    fillCycle.decision = {
      action: "SHORT",
      symbol: "SOL",
      allocationPercent: 15,
      confidence: 70,
      timeHorizon: "SHORT",
      reasons: [],
      riskFactors: [],
    };

    const checks = scoreBookTradeChecks(
      [
        trade({ id: "open", cycleId: "c0", side: "BUY", symbol: "XRP", price: 2, createdAt: "2026-09-18T07:02:00.000Z" }),
        trade({ id: "exit", cycleId: "c1", side: "SELL", symbol: "XRP", price: 1.9, createdAt: "2026-09-18T08:02:00.000Z" }),
        trade({ id: "short", cycleId: "c1", side: "SHORT", price: 100, createdAt: "2026-09-18T08:02:01.000Z" }),
      ],
      [cycle("c0", "2026-09-18T07:02:00.000Z", 100), fillCycle, cycle("c2", "2026-09-18T09:02:00.000Z", 95)]
    );

    const c1 = checks.find((check) => check.cycleId === "c1");
    expect(checks.filter((check) => check.cycleId === "c1")).toHaveLength(1);
    expect(c1).toMatchObject({ tradeId: "short", side: "SHORT", checkPrice: 95, win: true, fills: 2 });
  });

  it("scores a SELL that covered a short as right when price then rose", () => {
    const checks = scoreBookTradeChecks(
      [
        trade({ id: "s", cycleId: "c0", side: "SHORT", createdAt: "2026-09-18T07:02:00.000Z" }),
        trade({ id: "cover", cycleId: "c1", side: "SELL", price: 90, createdAt: "2026-09-18T08:02:00.000Z" }),
      ],
      [
        cycle("c0", "2026-09-18T07:02:00.000Z", 100),
        cycle("c1", "2026-09-18T08:02:00.000Z", 90),
        cycle("c2", "2026-09-18T09:02:00.000Z", 93),
      ]
    );

    expect(checks.find((check) => check.tradeId === "cover")?.win).toBe(true);
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
    expect(checks.map((item) => item.hourStart)).toEqual([
      "2026-09-18T08:00:00.000Z",
      "2026-09-18T08:00:00.000Z",
      "2026-09-18T08:00:00.000Z",
    ]);
    expect(checks[1]).toMatchObject({ side: "HOLD", fillPrice: null, kind: "hold" });
    expect(checks[2]).toMatchObject({ side: "BUY", fillPrice: null, kind: "blocked" });
  });
});

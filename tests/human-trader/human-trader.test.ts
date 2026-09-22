import { describe, expect, it } from "vitest";
import { isArenaHumanTraderEnabled } from "@/lib/human-trader/flags";
import { buildHumanVsAiLeaderboard, humanRankInLeaderboard } from "@/lib/human-trader/leaderboard";
import {
  accountAfterTrade,
  createInitialHumanTraderState,
  parseHumanTraderState,
  resetHumanTraderState,
  serializeHumanTraderState,
} from "@/lib/human-trader/storage";
import {
  estimateHumanTradeQuantity,
  executeHumanNotionalTrade,
  maxHumanTradeNotional,
} from "@/lib/human-trader/trade";
import { marketSnapshotFromQuotes } from "@/lib/human-trader/market-snapshot";
import { markToMarket } from "@/lib/paper/portfolio";
import { primaryNavForAudience } from "@/lib/layout/nav";
import type { LeaderboardAgent } from "@/types/arena";

const snapshot = marketSnapshotFromQuotes([
  { symbol: "BTC", price: 100_000, change24h: 1.2 },
  { symbol: "ETH", price: 3_000, change24h: -0.5 },
  { symbol: "SOL", price: 150, change24h: 2 },
  { symbol: "BNB", price: 600, change24h: 0 },
  { symbol: "XRP", price: 2, change24h: 0 },
]);

const agents: LeaderboardAgent[] = [
  {
    id: "momentum-alpha",
    name: "Elon Musk",
    strategy: "Narrative momentum",
    description: "",
    status: "ACTIVE",
    mark: "momentum",
    equity: 10_200,
    returnPercent: 2,
    drawdownPercent: 1,
    winRatePercent: 50,
    trades: 3,
    initialCapital: 10_000,
    cash: 100,
    coins: 10_100,
    dataSource: "live",
    runtimeStatus: "LIVE",
  },
];

describe("isArenaHumanTraderEnabled", () => {
  it("is disabled unless ARENA_HUMAN_TRADER=true", () => {
    expect(isArenaHumanTraderEnabled({})).toBe(false);
    expect(isArenaHumanTraderEnabled({ ARENA_HUMAN_TRADER: "false" })).toBe(false);
    expect(isArenaHumanTraderEnabled({ ARENA_HUMAN_TRADER: "true" })).toBe(true);
  });
});

describe("human trader storage", () => {
  it("starts with $10,000 cash and no positions", () => {
    const state = createInitialHumanTraderState();
    expect(state.account.cash).toBe(10_000);
    expect(state.account.positions).toEqual([]);
    expect(state.equityHistory[0]?.equity).toBe(10_000);
  });

  it("round-trips through serialized local storage", () => {
    const state = createInitialHumanTraderState();
    const raw = serializeHumanTraderState(state);
    const parsed = parseHumanTraderState(raw);

    expect(parsed?.account.cash).toBe(10_000);
    expect(parseHumanTraderState("not-json")).toBeNull();
  });

  it("resets to a fresh account", () => {
    const reset = resetHumanTraderState();
    expect(reset.account.trades).toEqual([]);
    expect(reset.account.initialCapital).toBe(10_000);
  });
});

describe("human trader paper execution", () => {
  it("buy reduces cash and opens a position", () => {
    const state = createInitialHumanTraderState();
    const result = executeHumanNotionalTrade(state.account, snapshot, {
      action: "BUY",
      symbol: "BTC",
      dollarAmount: 1_000,
    }, { createTradeId: () => "t1" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.account.cash).toBe(9_000);
    expect(result.account.positions).toHaveLength(1);
    expect(result.account.positions[0]?.quantity).toBeCloseTo(0.01, 8);
  });

  it("computes average entry across buys", () => {
    let account = createInitialHumanTraderState().account;
    const first = executeHumanNotionalTrade(account, snapshot, {
      action: "BUY",
      symbol: "SOL",
      dollarAmount: 1_500,
    }, { createTradeId: () => "t1" });

    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    account = first.account;
    const second = executeHumanNotionalTrade(account, snapshot, {
      action: "BUY",
      symbol: "SOL",
      dollarAmount: 1_500,
    }, { createTradeId: () => "t2" });

    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }

    expect(second.account.positions[0]?.averageEntryPrice).toBeCloseTo(150, 6);
  });

  it("sell reduces position and increases cash with realized pnl", () => {
    const bought = executeHumanNotionalTrade(createInitialHumanTraderState().account, snapshot, {
      action: "BUY",
      symbol: "ETH",
      dollarAmount: 3_000,
    }, { createTradeId: () => "t1" });

    expect(bought.ok).toBe(true);
    if (!bought.ok) {
      return;
    }

    const higher = marketSnapshotFromQuotes([
      { symbol: "BTC", price: 100_000 },
      { symbol: "ETH", price: 3_300 },
      { symbol: "SOL", price: 150 },
      { symbol: "BNB", price: 600 },
      { symbol: "XRP", price: 2 },
    ]);

    const sold = executeHumanNotionalTrade(bought.account, higher, {
      action: "SELL",
      symbol: "ETH",
      dollarAmount: 1_500,
    }, { createTradeId: () => "t2" });

    expect(sold.ok).toBe(true);
    if (!sold.ok) {
      return;
    }

    expect(sold.account.positions).toHaveLength(1);
    expect(sold.account.positions[0]?.quantity).toBeLessThan(1);
    expect(sold.account.cash).toBeGreaterThan(7_000);
    expect(sold.account.realizedPnl).toBeGreaterThan(0);
  });

  it("marks equity with unrealized pnl", () => {
    const bought = executeHumanNotionalTrade(createInitialHumanTraderState().account, snapshot, {
      action: "BUY",
      symbol: "BTC",
      dollarAmount: 5_000,
    }, { createTradeId: () => "t1" });

    expect(bought.ok).toBe(true);
    if (!bought.ok) {
      return;
    }

    const valued = markToMarket(bought.account, snapshot);
    expect(valued.portfolio.unrealizedPnl).toBe(0);
    expect(valued.portfolio.equity).toBeCloseTo(10_000, 6);
  });

  it("BUY covers an open short and realizes pnl", () => {
    const shorted = executeHumanNotionalTrade(createInitialHumanTraderState().account, snapshot, {
      action: "SHORT",
      symbol: "BTC",
      dollarAmount: 2_000,
    }, { createTradeId: () => "t-short" });

    expect(shorted.ok).toBe(true);
    if (!shorted.ok) {
      return;
    }

    const covered = executeHumanNotionalTrade(shorted.account, snapshot, {
      action: "BUY",
      symbol: "BTC",
      dollarAmount: 2_000,
    }, { createTradeId: () => "t-cover" });

    expect(covered.ok).toBe(true);
    if (!covered.ok) {
      return;
    }

    expect(covered.account.positions).toHaveLength(0);
    expect(covered.account.cash).toBeCloseTo(10_000, 0);
  });

  it("constrains a SHORT above the 15% max trade size", () => {
    const result = executeHumanNotionalTrade(createInitialHumanTraderState().account, snapshot, {
      action: "SHORT",
      symbol: "BTC",
      dollarAmount: 2_500,
    }, { createTradeId: () => "t-big-short" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.account.positions[0]?.quantity).toBeCloseTo(-0.015, 8);
    expect(Math.abs(result.account.positions[0]?.quantity ?? 0) * 100_000).toBeCloseTo(1_500, 0);
  });

  it("blocks a SHORT on a fourth symbol when three positions are already open", () => {
    let account = createInitialHumanTraderState().account;

    for (const [symbol, amount] of [
      ["BTC", 1_000],
      ["ETH", 1_000],
      ["SOL", 1_000],
    ] as const) {
      const step = executeHumanNotionalTrade(account, snapshot, {
        action: "SHORT",
        symbol,
        dollarAmount: amount,
      }, { createTradeId: () => `t-${symbol}` });

      expect(step.ok).toBe(true);
      if (!step.ok) {
        return;
      }

      account = step.account;
    }

    const blocked = executeHumanNotionalTrade(account, snapshot, {
      action: "SHORT",
      symbol: "BNB",
      dollarAmount: 500,
    }, { createTradeId: () => "t-bnb" });

    expect(blocked.ok).toBe(false);
    if (blocked.ok) {
      return;
    }

    expect(blocked.reason).toContain("maximum open positions");
  });

  it("reports max notional from arena headroom", () => {
    const account = createInitialHumanTraderState().account;
    expect(maxHumanTradeNotional(account, snapshot, { action: "SHORT", symbol: "BTC" })).toBeCloseTo(
      1_500,
      0
    );
  });

  it("SHORT opens a negative position and credits cash", () => {
    const result = executeHumanNotionalTrade(createInitialHumanTraderState().account, snapshot, {
      action: "SHORT",
      symbol: "BTC",
      dollarAmount: 1_000,
    }, { createTradeId: () => "t-short" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.account.positions[0]?.quantity).toBeLessThan(0);
    expect(result.account.cash).toBeGreaterThan(10_000);
    expect(result.valuation.portfolio.equity).toBeCloseTo(10_000, 4);
  });

  it("estimates trade quantity from dollar amount", () => {
    const account = createInitialHumanTraderState().account;
    expect(
      estimateHumanTradeQuantity(account, snapshot, {
        action: "BUY",
        symbol: "BTC",
        dollarAmount: 1_000,
      })
    ).toBeCloseTo(0.01, 8);
  });

  it("records equity history after trades", () => {
    const initial = createInitialHumanTraderState();
    const result = executeHumanNotionalTrade(initial.account, snapshot, {
      action: "BUY",
      symbol: "SOL",
      dollarAmount: 500,
    }, { createTradeId: () => "t1" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const next = accountAfterTrade(
      initial,
      result.account,
      result.valuation.portfolio.equity,
      "2026-09-22T08:00:00.000Z"
    );

    expect(next.equityHistory).toHaveLength(2);
  });
});

describe("human vs AI leaderboard", () => {
  it("includes YOU without changing agent rows", () => {
    const rows = buildHumanVsAiLeaderboard(agents, { equity: 10_500, returnPercent: 5 });
    expect(rows.some((row) => row.isHuman && row.name === "YOU")).toBe(true);
    expect(rows.some((row) => row.id === "momentum-alpha")).toBe(true);
    expect(humanRankInLeaderboard(rows)).toBe(1);
  });
});

describe("navigation", () => {
  it("hides My Trading when the feature flag is off", () => {
    expect(primaryNavForAudience(true, false).some((item) => item.match === "my-trading")).toBe(
      false
    );
  });

  it("shows My Trading when the feature flag is on", () => {
    expect(primaryNavForAudience(false, true).some((item) => item.match === "my-trading")).toBe(
      true
    );
  });
});

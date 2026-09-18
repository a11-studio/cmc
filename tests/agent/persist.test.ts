import { describe, expect, it, vi } from "vitest";
import { runAgentCycle } from "@/lib/agent/cycle";
import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
import {
  createStoreFromPersistedState,
  persistArenaState,
  persistedStateFromRows,
  reviveCycle,
  snapshotPersistedState,
  toArenaWriteRows,
  unwrapAccountPayload,
  wrapAccountPayload,
  type ArenaWriter,
} from "@/lib/agent/persist";
import { createInMemoryAgentStore } from "@/lib/agent/store";
import type { AgentCycleDependencies } from "@/lib/agent/types";
import type { MarketSnapshot } from "@/lib/market/types";
import { executePaperDecision } from "@/lib/paper/engine";
import { createPaperAccount } from "@/lib/paper/portfolio";
import type { TradeDecision } from "@/lib/paper/types";
import { evaluateRisk } from "@/lib/risk/evaluate";

const NOW = new Date("2026-09-17T11:00:00.000Z");

function snapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    cycleId: "cmc-raw",
    timestamp: "2026-09-17T11:00:00.000Z",
    assets: [
      { symbol: "BTC", price: 50_000, change24h: 1.2 },
      { symbol: "ETH", price: 2_500, change24h: 0.8 },
      { symbol: "SOL", price: 100, change24h: 2.1 },
      { symbol: "BNB", price: 600, change24h: 0.4 },
      { symbol: "XRP", price: 2.2, change24h: 0.6 },
    ],
    market: { btcDominance: 54 },
    ...overrides,
  };
}

function decision(overrides: Partial<TradeDecision> = {}): TradeDecision {
  return {
    action: "HOLD",
    symbol: "BTC",
    allocationPercent: 0,
    confidence: 70,
    timeHorizon: "SHORT",
    reasons: ["Test decision"],
    riskFactors: ["Test risk"],
    ...overrides,
  };
}

function createDeps(overrides: Partial<AgentCycleDependencies> = {}): AgentCycleDependencies {
  return {
    getMarketSnapshot: vi.fn(async () => snapshot()),
    generateTradeDecision: vi.fn(async () => decision()),
    evaluateRisk,
    executePaperDecision,
    store: createInMemoryAgentStore(),
    now: () => NOW,
    ...overrides,
  };
}

describe("Momentum Alpha persistence mapping", () => {
  it("round-trips an unused account through wrap/unwrap and store hydrate", () => {
    const store = createInMemoryAgentStore();
    const state = snapshotPersistedState(store, NOW);
    const wrapped = wrapAccountPayload(state.account, state.dayKey);
    const unwrapped = unwrapAccountPayload(wrapped);
    const hydrated = createStoreFromPersistedState(state);

    expect(state.dayKey).toBe("2026-09-17");
    expect(unwrapped.account.cash).toBe(10_000);
    expect(unwrapped.dayKey).toBe("2026-09-17");
    expect(hydrated.getAccount().cash).toBe(10_000);
    expect(hydrated.getDayStartEquity(NOW)).toBe(10_000);
    expect(hydrated.listCycles()).toEqual([]);
  });

  it("round-trips a completed BUY cycle including the frozen snapshot", async () => {
    const store = createInMemoryAgentStore();
    const result = await runAgentCycle({
      agent: MOMENTUM_ALPHA_AGENT,
      cycleId: "cycle-1",
      deps: createDeps({
        store,
        generateTradeDecision: vi.fn(async () =>
          decision({ action: "BUY", symbol: "BTC", allocationPercent: 10 })
        ),
      }),
    });

    expect(result.status).toBe("COMPLETED");

    const state = snapshotPersistedState(store, NOW);
    const json = JSON.parse(JSON.stringify(state)) as typeof state;
    const hydrated = createStoreFromPersistedState(
      persistedStateFromRows(
        {
          account_payload: wrapAccountPayload(json.account, json.dayKey),
          status: json.status,
          day_start_equity: json.dayStartEquity,
          last_equity: json.lastEquity,
          day_key: json.dayKey,
        },
        json.cycles.map((cycle) => ({ payload: cycle, status: cycle.status }))
      ) ?? json
    );

    const restored = hydrated.findCycle("cycle-1");
    expect(restored?.status).toBe("COMPLETED");
    expect(restored?.decision?.action).toBe("BUY");
    expect(restored?.snapshot?.assets[0]?.price).toBe(50_000);
    expect(Object.isFrozen(restored?.snapshot)).toBe(true);
    expect(hydrated.getAccount().trades).toHaveLength(1);
    expect(hydrated.getAccount().cash).toBeCloseTo(9_000, 8);
  });

  it("writes normalized rows for realtime tables", async () => {
    const store = createInMemoryAgentStore();
    await runAgentCycle({
      agent: MOMENTUM_ALPHA_AGENT,
      cycleId: "cycle-1",
      deps: createDeps({
        store,
        generateTradeDecision: vi.fn(async () =>
          decision({ action: "BUY", symbol: "BTC", allocationPercent: 10 })
        ),
      }),
    });

    const writes: { op: string; table: string; onConflict?: string; count: number }[] = [];
    const writer: ArenaWriter = {
      async upsert(table, rows, onConflict) {
        writes.push({ op: "upsert", table, onConflict, count: rows.length });
      },
      async deleteEq(table, column, value) {
        writes.push({ op: "delete", table, count: column === "agent_id" && value === "momentum-alpha" ? 1 : 0 });
      },
    };

    await persistArenaState(writer, snapshotPersistedState(store, NOW), NOW);

    expect(writes).toEqual(
      expect.arrayContaining([
        { op: "upsert", table: "agents", onConflict: "id", count: 1 },
        { op: "upsert", table: "market_snapshots", onConflict: "cycle_id", count: 1 },
        { op: "upsert", table: "agent_cycles", onConflict: "agent_id,cycle_id", count: 1 },
        { op: "upsert", table: "decisions", onConflict: "id", count: 1 },
        { op: "upsert", table: "risk_checks", onConflict: "decision_id", count: 1 },
        { op: "upsert", table: "trades", onConflict: "id", count: 1 },
        { op: "delete", table: "positions", count: 1 },
        { op: "upsert", table: "positions", onConflict: "agent_id,symbol", count: 1 },
        { op: "upsert", table: "portfolio_snapshots", onConflict: "agent_id,cycle_id", count: 1 },
        { op: "upsert", table: "activity_events", onConflict: "id", count: expect.any(Number) },
      ])
    );

    const rows = toArenaWriteRows(snapshotPersistedState(store, NOW), NOW);
    expect(rows.activity.some((event) => event.type === "TRADE_EXECUTED")).toBe(true);
    expect(rows.decisions[0]?.id).toBe("cycle-1");
  });

  it("writes Richard Dennis rows under his agent id", () => {
    const store = createInMemoryAgentStore();
    const rows = toArenaWriteRows(snapshotPersistedState(store, NOW, "richard-dennis"), NOW);

    expect(rows.agent.id).toBe("richard-dennis");
    expect(rows.agent.name).toBe("Richard Dennis");
    expect(rows.agent.strategy).toBe("The Turtle");
  });

  it("ignores empty claimed cycle payloads", () => {
    expect(reviveCycle({})).toBeNull();
    expect(reviveCycle({ status: "CLAIMED" })).toBeNull();

    const state = persistedStateFromRows(
      {
        account_payload: createPaperAccount(),
        status: "ACTIVE",
        day_start_equity: 10_000,
        last_equity: 10_000,
        day_key: "2026-09-17",
      },
      [{ payload: {}, status: "CLAIMED" }]
    );

    expect(state?.cycles).toEqual([]);
    expect(state?.account.cash).toBe(10_000);
  });

  it("keeps same-day start equity after hydrate", () => {
    const store = createInMemoryAgentStore({
      dayStartEquity: 9_500,
      lastEquity: 9_800,
      dayKey: "2026-09-17",
    });
    const hydrated = createStoreFromPersistedState(snapshotPersistedState(store, NOW));

    expect(hydrated.getDayStartEquity(NOW)).toBe(9_500);
  });

  it("round-trips a paused trading status", () => {
    const store = createInMemoryAgentStore();
    store.setAgentStatus("PAUSED");
    const state = snapshotPersistedState(store, NOW);
    const hydrated = createStoreFromPersistedState(state);
    const rows = toArenaWriteRows(state, NOW);

    expect(state.status).toBe("PAUSED");
    expect(hydrated.getAgentStatus()).toBe("PAUSED");
    expect(rows.agent.status).toBe("PAUSED");
  });
});

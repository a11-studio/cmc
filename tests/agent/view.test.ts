import { describe, expect, it, vi } from "vitest";
import { runAgentCycle } from "@/lib/agent/cycle";
import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
import { createInMemoryAgentStore } from "@/lib/agent/store";
import type { AgentCycleDependencies, AgentCycleResult } from "@/lib/agent/types";
import {
  buildMomentumAlphaView,
  cycleToActivityEvents,
  cycleToDecisionRecord,
  isArenaDebugControlsEnabled,
  isManualCycleEnabled,
  serializeCycle,
  serializeMomentumAlphaApi,
  resolveValuation,
  serializeTriggerResult,
} from "@/lib/agent/view";
import { AiDecisionError } from "@/lib/ai/errors";
import { MarketDataError } from "@/lib/market/errors";
import type { MarketSnapshot } from "@/lib/market/types";
import { executePaperDecision } from "@/lib/paper/engine";
import type { TradeDecision } from "@/lib/paper/types";
import { evaluateRisk } from "@/lib/risk/evaluate";

const NOW = new Date("2026-09-17T11:00:00.000Z");

function snapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    cycleId: "cmc-raw",
    timestamp: "2026-09-17T11:00:00.000Z",
    assets: [
      { symbol: "BTC", price: 50_000, change1h: 0.4, change24h: 1.2, change7d: 3, volume24h: 1_000 },
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
    reasons: ["BTC 24h momentum is positive."],
    riskFactors: ["Volume is uneven."],
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

async function run(overrides: Partial<AgentCycleDependencies> = {}, cycleId = "cycle-1") {
  const deps = createDeps(overrides);
  const result = await runAgentCycle({ deps, cycleId, agent: MOMENTUM_ALPHA_AGENT });
  return { deps, result };
}

describe("Momentum Alpha view serialization", () => {
  it("serializes the unused $10,000 account before any cycle", () => {
    const view = buildMomentumAlphaView(createInMemoryAgentStore());
    const payload = serializeMomentumAlphaApi(view);

    expect(payload.source).toBe("live");
    expect(payload.agent.dataSource).toBe("live");
    expect(payload.agent.equity).toBe(10_000);
    expect(payload.agent.returnPercent).toBe(0);
    expect(payload.agent.cash).toBe(10_000);
    expect(payload.agent.coins).toBe(0);
    expect(payload.cash).toBe(10_000);
    expect(payload.positions).toEqual([]);
    expect(payload.trades).toEqual([]);
    expect(payload.decisions).toEqual([]);
    expect(payload.activity).toEqual([]);
    expect(payload.hasCycles).toBe(false);
    expect(view.agent.equity).toBe(view.cash);
    expect(view.dayStartEquity).toBe(10_000);
  });

  it("maps a real BUY account, decision detail, and activity from the paper engine", async () => {
    const { deps, result } = await run({
      generateTradeDecision: vi.fn(async () =>
        decision({ action: "BUY", symbol: "BTC", allocationPercent: 10 })
      ),
    });

    const view = buildMomentumAlphaView(deps.store);
    const detail = cycleToDecisionRecord(result);
    const events = cycleToActivityEvents(result);

    expect(view.agent.equity).toBe(result.valuation?.portfolio.equity);
    expect(view.cash).toBeCloseTo(9_000, 8);
    expect(view.agent.cash).toBeCloseTo(9_000, 8);
    expect(view.agent.coins).toBeCloseTo(1_000, 8);
    expect(view.positions[0]?.symbol).toBe("BTC");
    expect(view.trades).toHaveLength(1);
    expect(view.trades[0]?.decisionId).toBe("cycle-1");
    expect(detail?.id).toBe("cycle-1");
    expect(detail?.dataSource).toBe("live");
    expect(detail?.action).toBe("BUY");
    expect(detail?.allocationPercent).toBe(10);
    expect(detail?.reasons).toEqual(["BTC 24h momentum is positive."]);
    expect(detail?.riskVerdict).toBe("APPROVED");
    expect(detail?.market.price).toBe(50_000);
    expect(detail?.market.change1h).toBe(0.4);
    expect(detail?.resultingEquity).toBe(result.valuation?.portfolio.equity);
    expect(events.map((event) => event.title)).toEqual([
      "ANALYZING",
      "DECISION",
      "RISK CHECK",
      "TRADE EXECUTED",
    ]);
    expect(events.at(-1)?.description).toMatch(/BUY BTC \$1,000\.00 · equity \$10,000\.00/);
    expect(detail?.events).toEqual(events);
    expect(serializeMomentumAlphaApi(view).cycles[0]?.cycleId).toBe("cycle-1");
  });

  it("displays a Risk BLOCKED cycle without changing the account", async () => {
    const { deps, result } = await run({
      generateTradeDecision: vi.fn(async () =>
        decision({ action: "SELL", symbol: "ETH", allocationPercent: 50 })
      ),
    });

    const view = buildMomentumAlphaView(deps.store);
    const serialized = serializeCycle(result);
    const detail = cycleToDecisionRecord(result);
    const events = cycleToActivityEvents(result);

    expect(result.status).toBe("BLOCKED");
    expect(view.cash).toBe(10_000);
    expect(view.trades).toEqual([]);
    expect(serialized.riskVerdict).toBe("BLOCKED");
    expect(detail?.status).toBe("Blocked");
    expect(events.map((event) => event.title)).toEqual([
      "ANALYZING",
      "DECISION",
      "RISK CHECK",
      "BLOCKED",
    ]);
  });

  it("keeps requested vs allowed allocation on a CONSTRAINED cycle", async () => {
    const { result } = await run({
      generateTradeDecision: vi.fn(async () =>
        decision({ action: "BUY", symbol: "BTC", allocationPercent: 50 })
      ),
    });

    const serialized = serializeCycle(result);
    const detail = cycleToDecisionRecord(result);

    expect(serialized.riskVerdict).toBe("CONSTRAINED");
    expect(serialized.requestedAllocationPercent).toBe(50);
    expect(serialized.allowedAllocationPercent).toBeCloseTo(15, 8);
    expect(detail?.status).toBe("Constrained");
    expect(detail?.requestedAllocationPercent).toBe(50);
    expect(detail?.allowedAllocationPercent).toBeCloseTo(15, 8);
  });

  it("serializes Gemini and CMC failures as failed cycles", async () => {
    const gemini = await run({
      generateTradeDecision: vi.fn(async () => {
        throw new AiDecisionError("Gemini is unavailable", "GEMINI_UNAVAILABLE");
      }),
    });
    const cmc = await run(
      {
        getMarketSnapshot: vi.fn(async () => {
          throw new MarketDataError("CMC is unavailable", "CMC_UNAVAILABLE");
        }),
      },
      "cycle-cmc"
    );

    expect(serializeTriggerResult(gemini.result).ok).toBe(false);
    expect(serializeTriggerResult(gemini.result).message).toMatch(/Gemini is unavailable/);
    expect(cycleToActivityEvents(gemini.result).some((event) => event.title === "CYCLE FAILED")).toBe(true);
    expect(serializeCycle(cmc.result).failure?.code).toBe("CMC_UNAVAILABLE");
    expect(cycleToActivityEvents(cmc.result)[0]?.title).toBe("ANALYZING");
    expect(buildMomentumAlphaView(gemini.deps.store).cash).toBe(10_000);
    expect(buildMomentumAlphaView(cmc.deps.store).cash).toBe(10_000);
  });

  it("enables the manual trigger only outside production unless explicitly allowed", () => {
    expect(isManualCycleEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isManualCycleEnabled({ NODE_ENV: "test" })).toBe(true);
    expect(isManualCycleEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isManualCycleEnabled({ NODE_ENV: "production", MANUAL_CYCLE_ENABLED: "true" })).toBe(true);
  });

  it("exposes pause and settings controls only outside production", () => {
    expect(isArenaDebugControlsEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isArenaDebugControlsEnabled({ NODE_ENV: "test" })).toBe(true);
    expect(isArenaDebugControlsEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("ignores blocked-cycle valuations when marking the portfolio to market", () => {
    const account = {
      initialCapital: 10_000,
      cash: 0.46,
      peakEquity: 10_900,
      realizedPnl: 2,
      positions: [{ symbol: "BTC" as const, quantity: 0.1, averageEntryPrice: 80_000 }],
      trades: [],
    };

    const cycles = [
      {
        status: "COMPLETED" as const,
        valuation: {
          portfolio: {
            cash: 0.46,
            equity: 10_918,
            realizedPnl: 2,
            unrealizedPnl: 100,
            returnPercent: 9,
            drawdownPercent: 0,
          },
          positions: [
            {
              symbol: "BTC" as const,
              quantity: 0.1,
              averageEntryPrice: 80_000,
              marketValue: 9_000,
              unrealizedPnl: 100,
              allocationPercent: 82,
            },
          ],
        },
        snapshot: {
          cycleId: "richard-donchian-1",
          timestamp: "2026-09-22T00:00:00.000Z",
          assets: [{ symbol: "BTC" as const, price: 90_000 }],
          market: {},
        },
      },
      {
        status: "BLOCKED" as const,
        valuation: {
          portfolio: {
            cash: 0.46,
            equity: 0.46,
            realizedPnl: 2,
            unrealizedPnl: 0,
            returnPercent: -99.99,
            drawdownPercent: 99,
          },
          positions: [],
        },
        snapshot: {
          cycleId: "richard-donchian-2",
          timestamp: "2026-09-22T01:00:00.000Z",
          assets: [{ symbol: "BTC" as const, price: 90_000 }],
          market: {},
        },
      },
    ];

    const marked = resolveValuation(account, cycles as AgentCycleResult[]);

    expect(marked.portfolio.equity).toBeGreaterThan(1_000);
    expect(marked.positions).toHaveLength(1);
  });

  it("manual trigger serialization uses the cycle result, not a second engine", async () => {
    const { result } = await run({
      generateTradeDecision: vi.fn(async () =>
        decision({ action: "BUY", symbol: "BTC", allocationPercent: 10 })
      ),
    });
    const payload = serializeTriggerResult(result);

    expect(payload.cycleId).toBe(result.cycleId);
    expect(payload.status).toBe(result.status);
    expect(payload.decision?.action).toBe("BUY");
    expect(payload.ok).toBe(true);
  });

  it("exposes a paused trading status on the live agent", () => {
    const view = buildMomentumAlphaView(createInMemoryAgentStore({ status: "PAUSED" }));

    expect(view.agent.status).toBe("PAUSED");
  });

  it("serializes a paused skip without treating it as a failed cycle", async () => {
    const { result } = await run({ store: createInMemoryAgentStore({ status: "PAUSED" }) });
    const payload = serializeTriggerResult(result);

    expect(payload.ok).toBe(false);
    expect(payload.status).toBe("SKIPPED_PAUSED");
    expect(payload.message).toMatch(/Trading is paused/);
  });
});

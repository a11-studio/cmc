import { describe, expect, it, vi } from "vitest";
import { runAgentCycle } from "@/lib/agent/cycle";
import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
import { createInMemoryAgentStore } from "@/lib/agent/store";
import type { AgentCycleDependencies } from "@/lib/agent/types";
import { AiDecisionError } from "@/lib/ai/errors";
import { MarketDataError } from "@/lib/market/errors";
import type { MarketSnapshot } from "@/lib/market/types";
import { executePaperDecision } from "@/lib/paper/engine";
import { createPaperAccount } from "@/lib/paper/portfolio";
import type { PaperAccount, TradeDecision } from "@/lib/paper/types";
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

function cloneAccount(account: PaperAccount): PaperAccount {
  return JSON.parse(JSON.stringify(account)) as PaperAccount;
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

describe("Momentum Alpha agent cycle", () => {
  it("runs a successful BUY through Gemini → Risk → Paper", async () => {
    const execute = vi.fn(executePaperDecision);
    const { result, deps } = await run({
      generateTradeDecision: vi.fn(async () =>
        decision({ action: "BUY", symbol: "BTC", allocationPercent: 10 })
      ),
      executePaperDecision: execute,
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.agentId).toBe("momentum-alpha");
    expect(result.strategy).toBe("Narrative momentum");
    expect(result.cycleId).toBe("cycle-1");
    expect(result.snapshotTimestamp).toBe("2026-09-17T11:00:00.000Z");
    expect(result.decision?.action).toBe("BUY");
    expect(result.riskResult?.verdict).toBe("APPROVED");
    expect(result.execution?.ok).toBe(true);
    expect(result.account.cash).toBeCloseTo(9_000, 8);
    expect(result.account.trades).toHaveLength(1);
    expect(result.account.trades[0]?.cycleId).toBe("cycle-1");
    expect(result.trace).toMatchObject({
      agentId: "momentum-alpha",
      strategy: "Narrative momentum",
      cycleId: "cycle-1",
      snapshotTimestamp: "2026-09-17T11:00:00.000Z",
    });
    expect(deps.generateTradeDecision).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.invocationCallOrder[0]).toBeGreaterThan(
      (deps.generateTradeDecision as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
    );
  });

  it("runs a successful SELL of an existing position", async () => {
    const market = snapshot();
    const opened = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "BTC", allocationPercent: 10 }),
      market
    );

    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }

    const { result } = await run({
      store: createInMemoryAgentStore({ account: opened.account }),
      generateTradeDecision: vi.fn(async () =>
        decision({ action: "SELL", symbol: "BTC", allocationPercent: 50 })
      ),
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.decision?.action).toBe("SELL");
    expect(result.riskResult?.verdict).toBe("APPROVED");
    expect(result.execution?.ok).toBe(true);
    expect(result.account.cash).toBeGreaterThan(opened.account.cash);
    expect(result.account.positions[0]?.quantity).toBeCloseTo(opened.account.positions[0]!.quantity * 0.5, 10);
  });

  it("runs a HOLD cycle without changing cash or positions", async () => {
    const { result } = await run({
      generateTradeDecision: vi.fn(async () => decision({ action: "HOLD", allocationPercent: 0 })),
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.decision?.action).toBe("HOLD");
    expect(result.riskResult?.verdict).toBe("APPROVED");
    expect(result.execution?.ok).toBe(true);
    expect(result.execution?.action).toBe("HOLD");
    expect(result.account.cash).toBe(10_000);
    expect(result.account.positions).toEqual([]);
    expect(result.account.trades).toEqual([]);
  });

  it("records Risk BLOCKED and does not execute", async () => {
    const execute = vi.fn(executePaperDecision);
    const { result } = await run({
      generateTradeDecision: vi.fn(async () =>
        decision({ action: "SELL", symbol: "ETH", allocationPercent: 50 })
      ),
      executePaperDecision: execute,
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.riskResult?.verdict).toBe("BLOCKED");
    expect(result.execution).toBeNull();
    expect(result.account.cash).toBe(10_000);
    expect(result.account.trades).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });

  it("executes the constrained allocation, not Gemini's original size", async () => {
    const execute = vi.fn(executePaperDecision);
    const { result } = await run({
      generateTradeDecision: vi.fn(async () =>
        decision({ action: "BUY", symbol: "BTC", allocationPercent: 50 })
      ),
      executePaperDecision: execute,
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.riskResult?.verdict).toBe("CONSTRAINED");
    expect(result.riskResult?.adjustedAllocationPercent).toBeCloseTo(15, 8);
    expect(result.decision?.allocationPercent).toBe(50);
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]?.[1].allocationPercent).toBeCloseTo(15, 8);
    expect(result.account.cash).toBeCloseTo(8_500, 8);
  });

  it("keeps the previous account intact after a Gemini failure", async () => {
    const store = createInMemoryAgentStore();
    const before = cloneAccount(store.getAccount());
    const execute = vi.fn(executePaperDecision);
    const { result } = await run({
      store,
      generateTradeDecision: vi.fn(async () => {
        throw new AiDecisionError("Gemini is unavailable", "GEMINI_UNAVAILABLE");
      }),
      executePaperDecision: execute,
    });

    expect(result.status).toBe("FAILED_DECISION");
    expect(result.failure).toMatchObject({ stage: "DECISION", code: "GEMINI_UNAVAILABLE" });
    expect(result.execution).toBeNull();
    expect(result.account).toEqual(before);
    expect(store.getAccount()).toEqual(before);
    expect(execute).not.toHaveBeenCalled();
  });

  it("keeps the previous account intact after a CMC failure", async () => {
    const store = createInMemoryAgentStore();
    const before = cloneAccount(store.getAccount());
    const generate = vi.fn(async () => decision());
    const execute = vi.fn(executePaperDecision);
    const { result } = await run({
      store,
      getMarketSnapshot: vi.fn(async () => {
        throw new MarketDataError("CMC is unavailable", "CMC_UNAVAILABLE");
      }),
      generateTradeDecision: generate,
      executePaperDecision: execute,
    });

    expect(result.status).toBe("FAILED_MARKET");
    expect(result.failure).toMatchObject({ stage: "MARKET", code: "CMC_UNAVAILABLE" });
    expect(result.snapshot).toBeNull();
    expect(result.decision).toBeNull();
    expect(result.account).toEqual(before);
    expect(store.getAccount()).toEqual(before);
    expect(generate).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("keeps the previous account intact after a Paper Engine failure", async () => {
    const store = createInMemoryAgentStore();
    const before = cloneAccount(store.getAccount());
    const { result } = await run({
      store,
      generateTradeDecision: vi.fn(async () =>
        decision({ action: "BUY", symbol: "BTC", allocationPercent: 10 })
      ),
      executePaperDecision: () => {
        throw new Error("paper engine crashed");
      },
    });

    expect(result.status).toBe("FAILED_EXECUTION");
    expect(result.failure).toMatchObject({ stage: "EXECUTION", message: "paper engine crashed" });
    expect(result.account).toEqual(before);
    expect(store.getAccount()).toEqual(before);
    expect(result.account.trades).toEqual([]);
  });

  it("does not execute the same cycle twice", async () => {
    const execute = vi.fn(executePaperDecision);
    const deps = createDeps({
      generateTradeDecision: vi.fn(async () =>
        decision({ action: "BUY", symbol: "BTC", allocationPercent: 10 })
      ),
      executePaperDecision: execute,
    });

    const first = await runAgentCycle({ deps, cycleId: "cycle-dup" });
    const second = await runAgentCycle({ deps, cycleId: "cycle-dup" });

    expect(first.status).toBe("COMPLETED");
    expect(second.status).toBe("SKIPPED_DUPLICATE");
    expect(execute).toHaveBeenCalledOnce();
    expect(deps.generateTradeDecision).toHaveBeenCalledOnce();
    expect(second.account.cash).toBeCloseTo(first.account.cash, 8);
    expect(second.account.trades).toHaveLength(1);
    expect(deps.store.getAccount().trades).toHaveLength(1);
  });

  it("retries a failed Gemini cycle in the same slot", async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new AiDecisionError("high demand", "GEMINI_UNAVAILABLE"))
      .mockResolvedValueOnce(decision({ action: "HOLD", allocationPercent: 0 }));

    const deps = createDeps({ generateTradeDecision: generate });
    const first = await runAgentCycle({ deps, cycleId: "cycle-retry" });
    const second = await runAgentCycle({ deps, cycleId: "cycle-retry" });

    expect(first.status).toBe("FAILED_DECISION");
    expect(second.status).toBe("COMPLETED");
    expect(generate).toHaveBeenCalledTimes(2);
    expect(deps.store.findCycle("cycle-retry")?.status).toBe("COMPLETED");
  });

  it("leaves a seeded account unchanged when a later cycle fails", async () => {
    const market = snapshot();
    const opened = executePaperDecision(
      createPaperAccount(),
      decision({ action: "BUY", symbol: "ETH", allocationPercent: 10 }),
      market
    );

    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }

    const store = createInMemoryAgentStore({ account: opened.account });
    const before = cloneAccount(store.getAccount());
    const { result } = await run(
      {
        store,
        generateTradeDecision: vi.fn(async () => {
          throw new AiDecisionError("malformed JSON", "MALFORMED_RESPONSE");
        }),
      },
      "cycle-fail"
    );

    expect(result.status).toBe("FAILED_DECISION");
    expect(store.getAccount()).toEqual(before);
    expect(result.account.positions).toEqual(before.positions);
    expect(result.account.cash).toBe(before.cash);
    expect(result.account.trades).toEqual(before.trades);
  });

  it("keeps the MarketSnapshot immutable and stamps the cycle id on a clone", async () => {
    const raw = snapshot();
    const { result } = await run({
      getMarketSnapshot: vi.fn(async () => raw),
      generateTradeDecision: vi.fn(async () => decision({ action: "HOLD", allocationPercent: 0 })),
    });

    expect(raw.cycleId).toBe("cmc-raw");
    expect(result.snapshot?.cycleId).toBe("cycle-1");
    expect(Object.isFrozen(result.snapshot)).toBe(true);
    expect(Object.isFrozen(result.snapshot?.assets)).toBe(true);

    raw.cycleId = "mutated";
    raw.assets[0]!.price = 1;

    expect(result.snapshot?.cycleId).toBe("cycle-1");
    expect(result.snapshot?.assets[0]?.price).toBe(50_000);
  });

  it("does not call Paper Engine when Risk throws", async () => {
    const execute = vi.fn(executePaperDecision);
    const store = createInMemoryAgentStore();
    const before = cloneAccount(store.getAccount());
    const { result } = await run({
      store,
      generateTradeDecision: vi.fn(async () =>
        decision({ action: "BUY", symbol: "BTC", allocationPercent: 10 })
      ),
      evaluateRisk: () => {
        throw new Error("risk engine crashed");
      },
      executePaperDecision: execute,
    });

    expect(result.status).toBe("FAILED_RISK");
    expect(result.failure).toMatchObject({ stage: "RISK", message: "risk engine crashed" });
    expect(execute).not.toHaveBeenCalled();
    expect(store.getAccount()).toEqual(before);
  });

  it("skips Gemini and paper when trading is paused", async () => {
    const execute = vi.fn(executePaperDecision);
    const generate = vi.fn(async () => decision({ action: "BUY", symbol: "BTC", allocationPercent: 10 }));
    const store = createInMemoryAgentStore({ status: "PAUSED" });
    const { result } = await run({
      store,
      generateTradeDecision: generate,
      executePaperDecision: execute,
    });

    expect(result.status).toBe("SKIPPED_PAUSED");
    expect(generate).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    expect(result.account.cash).toBe(10_000);
    expect(store.listCycles()).toEqual([]);
  });
});

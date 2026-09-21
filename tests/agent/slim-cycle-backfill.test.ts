import { describe, expect, it } from "vitest";
import {
  approximatePayloadBytes,
  slimStoredCyclePayload,
  storedCyclePayloadNeedsSlim,
} from "@/lib/agent/slim-cycle-backfill";
import { slimCycleForStorage } from "@/lib/agent/persist";
import type { AgentCycleResult } from "@/lib/agent/types";

function richPayload(): AgentCycleResult {
  return {
    status: "COMPLETED",
    agentId: "momentum-alpha",
    strategy: "Narrative momentum",
    cycleId: "cycle-backfill-1",
    snapshotTimestamp: "2026-09-21T10:00:00.000Z",
    snapshot: {
      cycleId: "cycle-backfill-1",
      timestamp: "2026-09-21T10:00:00.000Z",
      assets: [{ symbol: "BTC", price: 81_000 }],
      market: { fearGreed: 50 },
    },
    decision: {
      action: "HOLD",
      symbol: "BTC",
      allocationPercent: 0,
      confidence: 40,
      timeHorizon: "SHORT",
      reasons: ["Wait"],
      riskFactors: [],
    },
    riskResult: null,
    execution: null,
    valuation: { portfolio: { equity: 10_000, cash: 10_000 }, positions: [] },
    account: {
      initialCapital: 10_000,
      cash: 10_000,
      peakEquity: 10_000,
      realizedPnl: 0,
      positions: [],
      trades: [{ id: "t1", symbol: "BTC", side: "BUY", quantity: 1, price: 1, notional: 1, cycleId: "c", createdAt: "x" }],
    },
    events: [{ at: "2026-09-21T10:00:00.000Z", type: "CYCLE_STARTED", detail: "x" }],
    startedAt: "2026-09-21T10:00:00.000Z",
    completedAt: "2026-09-21T10:01:00.000Z",
    trace: {
      agentId: "momentum-alpha",
      strategy: "Narrative momentum",
      cycleId: "cycle-backfill-1",
      snapshotTimestamp: "2026-09-21T10:00:00.000Z",
      decision: null,
      riskResult: null,
      execution: null,
    },
  };
}

describe("slimStoredCyclePayload", () => {
  it("detects fat legacy payloads", () => {
    expect(storedCyclePayloadNeedsSlim(richPayload())).toBe(true);
    expect(storedCyclePayloadNeedsSlim({ status: "COMPLETED", marketCheckAssets: [] })).toBe(false);
  });

  it("matches slimCycleForStorage for rich cycles", () => {
    const cycle = richPayload();
    const fromApp = slimCycleForStorage(cycle);
    const { slim, changed, beforeBytes, afterBytes } = slimStoredCyclePayload(cycle);

    expect(changed).toBe(true);
    expect(beforeBytes).toBeGreaterThan(afterBytes);
    expect(slim).toEqual(fromApp);
    expect(slim.marketCheckAssets).toEqual([{ symbol: "BTC", price: 81_000 }]);
    expect(slim.snapshot).toBeUndefined();
    expect(slim.account).toBeUndefined();
  });

  it("is idempotent on already-slim payloads", () => {
    const once = slimStoredCyclePayload(richPayload());
    const twice = slimStoredCyclePayload(once.slim);

    expect(twice.changed).toBe(false);
    expect(twice.slim).toEqual(once.slim);
    expect(approximatePayloadBytes(twice.slim)).toBe(twice.afterBytes);
  });
});

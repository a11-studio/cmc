import { describe, expect, it } from "vitest";
import { cycleSlotFromId, splitCyclesByLatestBatch } from "@/lib/arena/activity-feed-core";
import type { AgentCycleResult } from "@/lib/agent/types";

function stubCycle(cycleId: string, completedAt: string): AgentCycleResult {
  return {
    status: "COMPLETED",
    agentId: cycleId.split("-").slice(0, -1).join("-"),
    strategy: "Test",
    cycleId,
    snapshotTimestamp: completedAt,
    snapshot: null,
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
      agentId: "a",
      strategy: "Test",
      cycleId,
      snapshotTimestamp: completedAt,
      decision: null,
      riskResult: null,
      execution: null,
    },
  };
}

describe("activity feed batching", () => {
  it("reads the hourly slot suffix from cycle ids", () => {
    expect(cycleSlotFromId("momentum-alpha-497218")).toBe("497218");
    expect(cycleSlotFromId("richard-dennis-497217")).toBe("497217");
  });

  it("keeps the newest slot as the latest batch", () => {
    const { latestBatch, older } = splitCyclesByLatestBatch([
      stubCycle("momentum-alpha-497218", "2026-09-21T10:47:00.000Z"),
      stubCycle("richard-dennis-497218", "2026-09-21T10:47:05.000Z"),
      stubCycle("momentum-alpha-497217", "2026-09-21T09:37:00.000Z"),
    ]);

    expect(latestBatch.map((cycle) => cycle.cycleId).sort()).toEqual([
      "momentum-alpha-497218",
      "richard-dennis-497218",
    ]);
    expect(older.map((cycle) => cycle.cycleId)).toEqual(["momentum-alpha-497217"]);
  });
});

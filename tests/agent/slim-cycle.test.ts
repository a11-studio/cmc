import { describe, expect, it } from "vitest";

import { reviveCycle, slimCycleForStorage } from "@/lib/agent/persist";
import type { AgentCycleResult } from "@/lib/agent/types";

function sampleCycle(): AgentCycleResult {
  return {
    status: "COMPLETED",
    agentId: "momentum-alpha",
    strategy: "Narrative momentum",
    cycleId: "cycle-1",
    snapshotTimestamp: "2026-09-21T10:00:00.000Z",
    snapshot: {
      cycleId: "cycle-1",
      timestamp: "2026-09-21T10:00:00.000Z",
      assets: [{ symbol: "BTC", price: 81_000, marketCap: 1 }],
      market: { openInterest: 1, openInterestVenues: [{ name: "X", value: 1 }] },
    },
    decision: {
      action: "HOLD",
      symbol: "BTC",
      allocationPercent: 0,
      confidence: 50,
      timeHorizon: "SHORT",
      reasons: [],
      riskFactors: [],
    },
    riskResult: null,
    execution: null,
    valuation: null,
    account: null as never,
    events: [],
    startedAt: "2026-09-21T10:00:00.000Z",
    completedAt: "2026-09-21T10:01:00.000Z",
    trace: null as never,
  };
}

describe("slim cycle storage", () => {
  it("stores market check assets instead of a full snapshot", () => {
    const slim = slimCycleForStorage(sampleCycle()) as Record<string, unknown>;

    expect(slim.snapshot).toBeUndefined();
    expect(slim.marketCheckAssets).toEqual([{ symbol: "BTC", price: 81_000 }]);
  });

  it("revives a minimal snapshot from market check assets", () => {
    const slim = slimCycleForStorage(sampleCycle());
    const revived = reviveCycle(slim)!;

    expect(revived.snapshot?.assets[0]?.price).toBe(81_000);
    expect(revived.snapshot?.market).toEqual({});
  });
});

import { describe, expect, it } from "vitest";
import {
  buildDashboardLiteSummary,
  buildCombinedEquitySeries,
  pickLatestCyclePayloadPerAgent,
  latestDecisionsFromCycles,
} from "@/lib/arena/dashboard-lite-build";
import { DASHBOARD_LITE_RECENT_FILLS_LIMIT } from "@/lib/arena/dashboard-lite-types";
import { reviveCycle } from "@/lib/agent/persist";
import { cycleToDecisionRecord } from "@/lib/agent/view";
import { listLiveAgents } from "@/lib/agents/registry";
import type { DashboardLiteAgent } from "@/lib/arena/dashboard-lite-types";

function sampleAgent(overrides: Partial<DashboardLiteAgent> = {}): DashboardLiteAgent {
  return {
    id: "momentum-alpha",
    name: "Elon Musk",
    strategy: "Narrative momentum",
    description: "Test",
    mark: "momentum",
    status: "ACTIVE",
    initialCapital: 10_000,
    equity: 10_500,
    returnPercent: 5,
    drawdownPercent: 1,
    cash: 8_000,
    coinsDeployed: 2_500,
    winRatePercent: 0,
    trades: 3,
    runtimeStatus: "LIVE",
    dataSource: "live",
    ...overrides,
  };
}

describe("dashboard lite builders", () => {
  it("includes every LIVE registry agent in summary math when provided", () => {
    const liveIds = listLiveAgents().map((agent) => agent.id);
    const agents = liveIds.map((id, index) =>
      sampleAgent({
        id,
        name: id,
        equity: 10_000 + index * 100,
        initialCapital: 10_000,
        returnPercent: index,
      })
    );

    const summary = buildDashboardLiteSummary(agents);

    expect(summary.agentCount).toBe(liveIds.length);
    expect(summary.startingCapital).toBe(liveIds.length * 10_000);
    expect(summary.totalEquity).toBe(agents.reduce((sum, agent) => sum + agent.equity, 0));
  });

  it("picks only the latest completed cycle payload per agent", () => {
    const payloads = pickLatestCyclePayloadPerAgent([
      { agent_id: "a", payload: { cycleId: "a-1" }, completed_at: "2026-01-01T10:00:00.000Z" },
      { agent_id: "a", payload: { cycleId: "a-2" }, completed_at: "2026-01-02T10:00:00.000Z" },
      { agent_id: "b", payload: { cycleId: "b-1" }, completed_at: "2026-01-03T10:00:00.000Z" },
    ]);

    expect(payloads.get("a")).toEqual({ cycleId: "a-2" });
    expect(payloads.get("b")).toEqual({ cycleId: "b-1" });
    expect(payloads.size).toBe(2);
  });

  it("caps recent fills constant at 32", () => {
    expect(DASHBOARD_LITE_RECENT_FILLS_LIMIT).toBe(32);
  });

  it("builds latest decisions from one revived cycle per agent", () => {
    const raw = {
      status: "COMPLETED",
      agentId: "momentum-alpha",
      strategy: "Narrative momentum",
      cycleId: "momentum-alpha-1",
      startedAt: "2026-01-01T10:00:00.000Z",
      completedAt: "2026-01-01T10:01:00.000Z",
      snapshotTimestamp: "2026-01-01T10:00:00.000Z",
      marketCheckAssets: [{ symbol: "BTC", price: 80_000 }],
      decision: {
        action: "BUY",
        symbol: "BTC",
        allocationPercent: 10,
        confidence: 70,
        timeHorizon: "SHORT",
        reasons: ["test"],
        riskFactors: [],
      },
      riskResult: {
        approved: true,
        verdict: "APPROVED",
        executable: true,
        code: "APPROVED",
        reason: "ok",
        decision: {
          action: "BUY",
          symbol: "BTC",
          allocationPercent: 10,
          confidence: 70,
          timeHorizon: "SHORT",
          reasons: ["test"],
          riskFactors: [],
        },
        checks: [],
      },
    };

    const revived = reviveCycle(raw);
    const decision = revived ? cycleToDecisionRecord(revived) : null;
    const decisions = latestDecisionsFromCycles(
      new Map([["momentum-alpha", decision]])
    );

    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.action).toBe("BUY");
    expect(decisions[0]?.agentId).toBe("momentum-alpha");
  });

  it("keeps equity history available for combined arena chart", () => {
    const combined = buildCombinedEquitySeries({
      a: [{ equity: 10_000, at: "2026-01-01T10:00:00.000Z" }],
      b: [{ equity: 10_000, at: "2026-01-01T10:00:00.000Z" }],
    });

    expect(combined.length).toBeGreaterThan(1);
    expect(combined[0]?.equity).toBe(20_000);
  });

  it("matches legacy summary calculations from agent equity", () => {
    const agents = [sampleAgent({ equity: 11_000, initialCapital: 10_000, returnPercent: 10 })];
    const summary = buildDashboardLiteSummary(agents);

    expect(summary.pnl).toBe(1_000);
    expect(summary.returnPercent).toBe(10);
  });
});

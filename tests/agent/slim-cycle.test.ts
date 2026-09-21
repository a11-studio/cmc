import { describe, expect, it } from "vitest";

import { attachMarketSnapshotIfMissing, reviveCycle, slimCycleForStorage } from "@/lib/agent/persist";
import { cycleToDecisionRecord } from "@/lib/agent/view";
import type { AgentCycleResult } from "@/lib/agent/types";
import type { SupabaseClient } from "@supabase/supabase-js";

function richCycle(): AgentCycleResult {
  return {
    status: "COMPLETED",
    agentId: "momentum-alpha",
    strategy: "Narrative momentum",
    cycleId: "cycle-slim-1",
    snapshotTimestamp: "2026-09-21T10:00:00.000Z",
    snapshot: {
      cycleId: "cycle-slim-1",
      timestamp: "2026-09-21T10:00:00.000Z",
      assets: [
        { symbol: "BTC", price: 81_000, marketCap: 1e12, change24h: -1 },
        { symbol: "ETH", price: 3_200, volume24h: 1e9 },
      ],
      market: { openInterest: 200, btcDominance: 55, fearGreed: 42 },
    },
    decision: {
      action: "BUY",
      symbol: "BTC",
      allocationPercent: 10,
      confidence: 72,
      timeHorizon: "SHORT",
      reasons: ["Trend intact"],
      riskFactors: ["Volatility"],
    },
    riskResult: {
      approved: true,
      verdict: "APPROVED",
      executable: true,
      code: "APPROVED",
      reason: "Within limits",
      decision: {
        action: "BUY",
        symbol: "BTC",
        allocationPercent: 10,
        confidence: 72,
        timeHorizon: "SHORT",
        reasons: ["Trend intact"],
        riskFactors: ["Volatility"],
      },
      checks: [],
    },
    execution: {
      ok: true,
      action: "BUY",
      trade: {
        id: "trade-1",
        symbol: "BTC",
        side: "BUY",
        quantity: 0.01,
        price: 81_000,
        notional: 810,
        cycleId: "cycle-slim-1",
        createdAt: "2026-09-21T10:01:00.000Z",
      },
      account: {
        initialCapital: 10_000,
        cash: 9_190,
        peakEquity: 10_000,
        realizedPnl: 0,
        positions: [{ symbol: "BTC", quantity: 0.01, averageEntryPrice: 81_000 }],
        trades: [],
      },
      valuation: {
        portfolio: {
          cash: 9_190,
          equity: 10_000,
          realizedPnl: 0,
          unrealizedPnl: 810,
          returnPercent: 0,
          drawdownPercent: 0,
        },
        positions: [],
      },
    },
    valuation: {
      portfolio: {
        cash: 9_190,
        equity: 10_000,
        realizedPnl: 0,
        unrealizedPnl: 810,
        returnPercent: 0,
        drawdownPercent: 0,
      },
      positions: [],
    },
    account: {
      initialCapital: 10_000,
      cash: 9_190,
      peakEquity: 10_000,
      realizedPnl: 0,
      positions: [{ symbol: "BTC", quantity: 0.01, averageEntryPrice: 81_000 }],
      trades: [
        {
          id: "trade-1",
          symbol: "BTC",
          side: "BUY",
          quantity: 0.01,
          price: 81_000,
          notional: 810,
          cycleId: "cycle-slim-1",
          createdAt: "2026-09-21T10:01:00.000Z",
        },
      ],
    },
    events: [{ at: "2026-09-21T10:00:00.000Z", type: "CYCLE_STARTED", detail: "legacy event row" }],
    startedAt: "2026-09-21T10:00:00.000Z",
    completedAt: "2026-09-21T10:01:00.000Z",
    trace: {
      agentId: "momentum-alpha",
      strategy: "Narrative momentum",
      cycleId: "cycle-slim-1",
      snapshotTimestamp: "2026-09-21T10:00:00.000Z",
      decision: null,
      riskResult: null,
      execution: null,
    },
  };
}

describe("slim cycle storage", () => {
  it("drops account, snapshot, events, and trace from persisted payload", () => {
    const slim = slimCycleForStorage(richCycle()) as Record<string, unknown>;

    expect(slim.trace).toBeUndefined();
    expect(slim.snapshot).toBeUndefined();
    expect(slim.account).toBeUndefined();
    expect(slim.events).toBeUndefined();
    expect(slim.marketCheckAssets).toEqual([
      { symbol: "BTC", price: 81_000 },
      { symbol: "ETH", price: 3_200 },
    ]);
  });

  it("preserves decision, risk, execution, valuation, and metadata", () => {
    const slim = slimCycleForStorage(richCycle()) as Record<string, unknown>;

    expect(slim.status).toBe("COMPLETED");
    expect(slim.cycleId).toBe("cycle-slim-1");
    expect(slim.agentId).toBe("momentum-alpha");
    expect(slim.startedAt).toBe("2026-09-21T10:00:00.000Z");
    expect(slim.completedAt).toBe("2026-09-21T10:01:00.000Z");
    expect((slim.decision as { action: string }).action).toBe("BUY");
    expect((slim.riskResult as { verdict: string }).verdict).toBe("APPROVED");
    expect((slim.execution as { ok: boolean }).ok).toBe(true);
    expect((slim.execution as { account?: unknown }).account).toBeUndefined();
    expect((slim.valuation as { portfolio: { equity: number } }).portfolio.equity).toBe(10_000);
  });

  it("revives market check assets for decision detail and legacy payloads still parse", () => {
    const slim = slimCycleForStorage(richCycle());
    const revived = reviveCycle(slim)!;

    expect(revived.snapshot?.assets).toHaveLength(2);
    expect(revived.snapshot?.assets[0]?.price).toBe(81_000);
    expect(revived.events).toEqual([]);

    const legacy = reviveCycle(richCycle())!;
    expect(legacy.snapshot?.market.btcDominance).toBe(55);
    expect(legacy.events).toHaveLength(1);

    const decision = cycleToDecisionRecord(revived);
    expect(decision?.action).toBe("BUY");
    expect(decision?.market.price).toBe(81_000);
    expect(decision?.events?.length).toBeGreaterThan(0);
  });
});

describe("attachMarketSnapshotIfMissing", () => {
  it("loads full market snapshot from market_snapshots when slim payload only has check assets", async () => {
    const slim = slimCycleForStorage(richCycle());
    const revived = reviveCycle(slim)!;
    expect(revived.snapshot?.assets[0]?.price).toBe(81_000);
    expect(revived.snapshot?.market.btcDominance).toBeUndefined();

    const fullSnapshot = richCycle().snapshot!;
    const client = {
      from(table: string) {
        return {
          select: () => ({
            eq: (_col: string, value: string) => ({
              maybeSingle: async () =>
                table === "market_snapshots" && value === "cycle-slim-1"
                  ? { data: { payload: fullSnapshot }, error: null }
                  : { data: null, error: null },
            }),
          }),
        };
      },
    } as unknown as SupabaseClient;

    const enriched = await attachMarketSnapshotIfMissing(client, revived);
    expect(enriched.snapshot?.market.btcDominance).toBe(55);
    expect(enriched.snapshot?.assets[0]?.price).toBe(81_000);

    const decision = cycleToDecisionRecord(enriched);
    expect(decision?.market.price).toBe(81_000);
  });
});

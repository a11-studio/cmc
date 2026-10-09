import { describe, expect, it } from "vitest";
import {
  getCachedDashboardLite,
  invalidateDashboardLiteCache,
  setCachedDashboardLite,
} from "@/lib/arena/dashboard-lite-cache";
import { resetTtlCacheForTests } from "@/lib/server/ttl-cache";
import type { DashboardLite } from "@/lib/arena/dashboard-lite-types";

function emptyDashboard(): DashboardLite {
  return {
    agents: [],
    positionsByAgent: {},
    summary: {
      agentCount: 0,
      startingCapital: 0,
      totalEquity: 0,
      pnl: 0,
      returnPercent: 0,
    },
    equitySeriesByAgent: {},
    combinedEquitySeries: [],
    latestDecisions: [],
    recentFills: [],
    risk: {
      agentId: "momentum-alpha",
      equity: 0,
      dayStartEquity: 0,
      positions: [],
    },
    persistenceMode: "supabase",
    paused: false,
  };
}

describe("dashboard-lite cache", () => {
  it("returns cached dashboard data until invalidated", () => {
    resetTtlCacheForTests();
    const dashboard = emptyDashboard();
    dashboard.agents = [{ id: "a", name: "A", strategy: "S", description: "", mark: "momentum", status: "ACTIVE", initialCapital: 1, equity: 1, returnPercent: 0, drawdownPercent: 0, cash: 1, coinsDeployed: 0, winRatePercent: 0, trades: 0, runtimeStatus: "LIVE", dataSource: "live" }];

    setCachedDashboardLite(dashboard);
    expect(getCachedDashboardLite()).toEqual(dashboard);

    invalidateDashboardLiteCache();
    expect(getCachedDashboardLite()).toBeUndefined();
  });
});

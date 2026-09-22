import { buildAllocationSlices } from "@/components/arena/agent-allocation-card";
import type { DashboardLite, DashboardLiteAgent } from "@/lib/arena/dashboard-lite-types";
import type { MomentumAlphaView } from "@/lib/agent/view";
import type { PositionRow } from "@/types/arena";

export function allocationBooksFromDashboardLite(
  lite: DashboardLite,
  positionsByAgent: Record<string, PositionRow[]>
): MomentumAlphaView[] {
  return lite.agents.map((agent) => liteAgentToAllocationBook(agent, positionsByAgent[agent.id] ?? []));
}

function liteAgentToAllocationBook(agent: DashboardLiteAgent, positions: PositionRow[]): MomentumAlphaView {
  return {
    agent: {
      id: agent.id,
      name: agent.name,
      strategy: agent.strategy,
      description: agent.description,
      status: agent.status,
      mark: agent.mark,
      equity: agent.equity,
      returnPercent: agent.returnPercent,
      drawdownPercent: agent.drawdownPercent,
      winRatePercent: agent.winRatePercent,
      trades: agent.trades,
      initialCapital: agent.initialCapital,
      cash: agent.cash,
      coins: agent.coinsDeployed,
      dataSource: agent.dataSource,
      runtimeStatus: agent.runtimeStatus,
    },
    cash: agent.cash,
    cashAllocationPercent: agent.equity > 0 ? (agent.cash / agent.equity) * 100 : 100,
    realizedPnl: 0,
    unrealizedPnl: 0,
    dayStartEquity: agent.initialCapital,
    positions,
    trades: [],
    decisions: [],
    events: [],
    cycles: [],
    equityCurve: [],
    equitySeries: [],
    latestCycle: null,
    hasCycles: false,
    tradeChecks: [],
  };
}

export function allocationSlicesFromLite(lite: DashboardLite, positionsByAgent: Record<string, PositionRow[]>) {
  return buildAllocationSlices(allocationBooksFromDashboardLite(lite, positionsByAgent));
}

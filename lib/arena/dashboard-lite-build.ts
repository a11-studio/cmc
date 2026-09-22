import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
import { combineEquitySeries } from "@/lib/charts/equity";
import { findAgentDefinition, listLiveAgents } from "@/lib/agents/registry";
import { buildAgentRoster } from "@/lib/agents/roster";
import type { MomentumAlphaView } from "@/lib/agent/view";
import {
  DASHBOARD_LITE_RISK_AGENT_ID,
  type DashboardLite,
  type DashboardLiteAgent,
} from "@/lib/arena/dashboard-lite-types";
import type { AgentMark, AgentStatus, DecisionRecord, EquityCurvePoint, LeaderboardAgent, PositionRow } from "@/types/arena";

export function toLeaderboardAgent(agent: DashboardLiteAgent): LeaderboardAgent {
  return {
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
  };
}

export function buildDashboardLiteSummary(agents: readonly DashboardLiteAgent[]): DashboardLite["summary"] {
  const leaderboard = agents.map(toLeaderboardAgent);
  const startingCapital = leaderboard.reduce((sum, agent) => sum + agent.initialCapital, 0);
  const totalEquity = leaderboard.reduce((sum, agent) => sum + agent.equity, 0);
  const pnl = totalEquity - startingCapital;

  return {
    agentCount: leaderboard.length,
    startingCapital,
    totalEquity,
    pnl,
    returnPercent: startingCapital === 0 ? 0 : (pnl / startingCapital) * 100,
  };
}

export function buildCombinedEquitySeries(
  equitySeriesByAgent: Record<string, EquityCurvePoint[]>
): EquityCurvePoint[] {
  const books = Object.entries(equitySeriesByAgent).map(([, equitySeries]) => ({ equitySeries }));
  return combineEquitySeries(books);
}

export function pickLatestCyclePayloadPerAgent(
  rows: readonly { agent_id: string; payload: unknown; completed_at: string | null }[]
): Map<string, unknown> {
  const latest = new Map<string, { payload: unknown; completedAt: number }>();

  for (const row of rows) {
    const completedAt = row.completed_at ? Date.parse(row.completed_at) : Number.NaN;

    if (!Number.isFinite(completedAt)) {
      continue;
    }

    const existing = latest.get(row.agent_id);

    if (!existing || completedAt > existing.completedAt) {
      latest.set(row.agent_id, { payload: row.payload, completedAt });
    }
  }

  return new Map(latest.entries().map(([agentId, entry]) => [agentId, entry.payload]));
}

export function mapAgentRiskStatus(value: string | null): AgentStatus {
  if (value === "PAUSED" || value === "ERROR" || value === "ACTIVE") {
    return value;
  }

  return "ACTIVE";
}

export function deriveAgentStatusFromStore(
  storeStatus: AgentStatus,
  latestCycleStatus: string | undefined
): AgentStatus {
  if (storeStatus === "PAUSED") {
    return "PAUSED";
  }

  if (latestCycleStatus?.startsWith("FAILED")) {
    return "ERROR";
  }

  return storeStatus;
}

export function dashboardLiteRoster(agents: readonly DashboardLiteAgent[]): LeaderboardAgent[] {
  return buildAgentRoster(agents.map(toLeaderboardAgent));
}

/** Memory / rollback: convert a full dashboard into the lite shape for unified UI. */
export function dashboardLiteFromLegacyViews(
  books: readonly MomentumAlphaView[],
  persistenceMode: "memory" | "supabase",
  paused: boolean
): DashboardLite {
  const agents: DashboardLiteAgent[] = books.map((book) => ({
    id: book.agent.id,
    name: book.agent.name,
    strategy: book.agent.strategy,
    description: book.agent.description,
    mark: book.agent.mark,
    status: book.agent.status,
    initialCapital: book.agent.initialCapital,
    equity: book.agent.equity,
    returnPercent: book.agent.returnPercent,
    drawdownPercent: book.agent.drawdownPercent,
    cash: book.cash,
    coinsDeployed: book.agent.coins,
    winRatePercent: book.agent.winRatePercent,
    trades: book.agent.trades,
    runtimeStatus: "LIVE",
    dataSource: book.agent.dataSource === "sample" ? "sample" : "live",
  }));

  const equitySeriesByAgent: Record<string, EquityCurvePoint[]> = {};

  for (const book of books) {
    equitySeriesByAgent[book.agent.id] = book.equitySeries;
  }

  const riskBook = books.find((book) => book.agent.id === DASHBOARD_LITE_RISK_AGENT_ID) ?? books[0]!;

  const positionsByAgent: Record<string, PositionRow[]> = {};

  for (const book of books) {
    positionsByAgent[book.agent.id] = book.positions;
  }

  return {
    agents,
    positionsByAgent,
    summary: buildDashboardLiteSummary(agents),
    equitySeriesByAgent,
    combinedEquitySeries: buildCombinedEquitySeries(equitySeriesByAgent),
    latestDecisions: books.flatMap((book) => (book.decisions[0] ? [book.decisions[0]] : [])),
    recentFills: books
      .flatMap((book) =>
        book.trades.map((trade) => ({
          ...trade,
          agentId: book.agent.id,
          agentName: book.agent.name,
          mark: book.agent.mark,
        }))
      )
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 32),
    risk: {
      agentId: riskBook.agent.id,
      equity: riskBook.agent.equity,
      dayStartEquity: riskBook.dayStartEquity,
      positions: riskBook.positions,
    },
    persistenceMode,
    paused,
  };
}

export function definitionForLiveAgent(agentId: string) {
  return findAgentDefinition(agentId) ?? listLiveAgents().find((agent) => agent.id === agentId);
}

export function buildPositionRows(
  positions: readonly { symbol: string; quantity: number; averageEntryPrice: number }[],
  prices: Map<string, number>,
  equity: number
): PositionRow[] {
  return positions
    .map((position) => {
      const currentPrice = prices.get(position.symbol) ?? position.averageEntryPrice;
      const marketValue = position.quantity * currentPrice;
      const unrealizedPnl = position.quantity * (currentPrice - position.averageEntryPrice);
      const allocationPercent = equity > 0 ? (Math.abs(marketValue) / equity) * 100 : 0;

      return {
        symbol: position.symbol as PositionRow["symbol"],
        quantity: position.quantity,
        averageEntryPrice: position.averageEntryPrice,
        currentPrice,
        marketValue,
        unrealizedPnl,
        allocationPercent,
      };
    })
    .sort((left, right) => Math.abs(right.marketValue) - Math.abs(left.marketValue));
}

export function latestDecisionsFromCycles(
  decisionsByAgent: Map<string, DecisionRecord | null>
): DecisionRecord[] {
  return [...decisionsByAgent.values()].filter((decision): decision is DecisionRecord => decision != null);
}

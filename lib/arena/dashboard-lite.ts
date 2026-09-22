import "server-only";

import { EQUITY_HISTORY_LIMIT } from "@/lib/agent/equity-history";
import { approximateJsonBytes, logArenaEgress } from "@/lib/agent/egress-log";
import { unwrapAccountPayload } from "@/lib/agent/persist";
import { reviveCycle } from "@/lib/agent/persist";
import { cycleToDecisionRecord } from "@/lib/agent/view";
import {
  buildCombinedEquitySeries,
  buildDashboardLiteSummary,
  buildPositionRows,
  dashboardLiteRoster,
  deriveAgentStatusFromStore,
  latestDecisionsFromCycles,
  mapAgentRiskStatus,
  pickLatestCyclePayloadPerAgent,
  toLeaderboardAgent,
} from "@/lib/arena/dashboard-lite-build";
import {
  DASHBOARD_LITE_RECENT_FILLS_LIMIT,
  DASHBOARD_LITE_RISK_AGENT_ID,
  type DashboardLite,
  type DashboardLiteAgent,
} from "@/lib/arena/dashboard-lite-types";
import { filterAgentPortfolioEquityHistoryForDisplay } from "@/lib/agent/portfolio-equity-display";
import { listLiveAgents } from "@/lib/agents/registry";
import { getPersistenceMode, isSupabasePersistenceConfigured } from "@/lib/env.server";
import { getShellMarket } from "@/lib/market/shell-market";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { EquityCurvePoint, PositionRow, TradeAction } from "@/types/arena";
import type { SupportedSymbol } from "@/lib/market/types";

type AgentRow = {
  id: string;
  status: string | null;
  last_equity: number | null;
  day_start_equity: number | null;
  day_key: string | null;
  account_payload: unknown;
  initial_capital: number | null;
};

type PositionRowDb = {
  agent_id: string;
  symbol: string;
  quantity: number;
  average_entry_price: number;
};

type TradeRowDb = {
  id: string;
  agent_id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  notional: number;
  realized_pnl: number | null;
  decision_id: string | null;
  created_at: string;
};

type SnapshotRow = {
  agent_id: string;
  equity: number;
  timestamp: string;
  cycle_id: string | null;
  return_percent: number | null;
  drawdown_percent: number | null;
};

type CycleRow = {
  agent_id: string;
  payload: unknown;
  completed_at: string | null;
  status: string | null;
};

async function fetchEquitySeriesByAgent(
  client: ReturnType<typeof createSupabaseAdminClient>,
  agentIds: readonly string[]
): Promise<Record<string, EquityCurvePoint[]>> {
  const result: Record<string, EquityCurvePoint[]> = {};

  await Promise.all(
    agentIds.map(async (agentId) => {
      const { data, error } = await client!
        .from("portfolio_snapshots")
        .select("equity, timestamp, cycle_id")
        .eq("agent_id", agentId)
        .order("timestamp", { ascending: true })
        .limit(EQUITY_HISTORY_LIMIT);

      if (error) {
        throw new Error(`dashboard-lite equity: ${error.message}`);
      }

      const points = (data ?? []).flatMap((row) => {
        if (typeof row.equity !== "number" || typeof row.timestamp !== "string") {
          return [];
        }

        return [
          {
            equity: row.equity,
            at: row.timestamp,
            label: typeof row.cycle_id === "string" ? row.cycle_id : undefined,
          },
        ];
      });

      result[agentId] = filterAgentPortfolioEquityHistoryForDisplay(agentId, points);
    })
  );

  return result;
}

async function fetchTradeCounts(
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  agentIds: readonly string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  await Promise.all(
    agentIds.map(async (agentId) => {
      const { count, error } = await client
        .from("trades")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId);

      if (error) {
        throw new Error(`dashboard-lite trade count: ${error.message}`);
      }

      counts.set(agentId, count ?? 0);
    })
  );

  return counts;
}

export async function fetchDashboardLite(): Promise<DashboardLite> {
  const live = listLiveAgents();
  const agentIds = live.map((agent) => agent.id);

  if (!isSupabasePersistenceConfigured() || agentIds.length === 0) {
    return {
      agents: [],
      positionsByAgent: {},
      summary: buildDashboardLiteSummary([]),
      equitySeriesByAgent: {},
      combinedEquitySeries: [],
      latestDecisions: [],
      recentFills: [],
      risk: {
        agentId: DASHBOARD_LITE_RISK_AGENT_ID,
        equity: 0,
        dayStartEquity: 0,
        positions: [],
      },
      persistenceMode: getPersistenceMode(),
      paused: false,
    };
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  let queryCount = 0;
  let approxBytes = 0;
  let cyclePayloadCount = 0;

  const [
    agentsResult,
    positionsResult,
    tradesResult,
    cyclesResult,
    latestMetricsResult,
  ] = await Promise.all([
    client
      .from("agents")
      .select("id, status, last_equity, day_start_equity, day_key, account_payload, initial_capital")
      .in("id", agentIds),
    client
      .from("positions")
      .select("agent_id, symbol, quantity, average_entry_price")
      .in("agent_id", agentIds),
    client
      .from("trades")
      .select("id, agent_id, symbol, side, quantity, price, notional, realized_pnl, decision_id, created_at")
      .in("agent_id", agentIds)
      .order("created_at", { ascending: false })
      .limit(DASHBOARD_LITE_RECENT_FILLS_LIMIT),
    client
      .from("agent_cycles")
      .select("agent_id, payload, completed_at, status")
      .in("agent_id", agentIds)
      .neq("status", "CLAIMED")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(agentIds.length * 4),
    client
      .from("portfolio_snapshots")
      .select("agent_id, equity, timestamp, cycle_id, return_percent, drawdown_percent")
      .in("agent_id", agentIds)
      .order("timestamp", { ascending: false })
      .limit(agentIds.length * 2),
  ]);

  queryCount += 5;

  for (const result of [agentsResult, positionsResult, tradesResult, cyclesResult, latestMetricsResult]) {
    if (result.error) {
      throw new Error(`dashboard-lite query failed: ${result.error.message}`);
    }
  }

  approxBytes +=
    approximateJsonBytes(agentsResult.data) +
    approximateJsonBytes(positionsResult.data) +
    approximateJsonBytes(tradesResult.data) +
    approximateJsonBytes(cyclesResult.data) +
    approximateJsonBytes(latestMetricsResult.data);

  const [equitySeriesByAgent, tradeCounts] = await Promise.all([
    fetchEquitySeriesByAgent(client, agentIds),
    fetchTradeCounts(client, agentIds),
  ]);

  queryCount += agentIds.length * 2;

  for (const series of Object.values(equitySeriesByAgent)) {
    approxBytes += approximateJsonBytes(series);
  }

  const shell = await getShellMarket();
  const priceMap = new Map(
    shell.quotes
      .filter((quote) => quote.price != null)
      .map((quote) => [quote.symbol, quote.price as number])
  );

  const dbPositionsByAgent = new Map<string, PositionRowDb[]>();

  for (const row of (positionsResult.data as PositionRowDb[] | null) ?? []) {
    const list = dbPositionsByAgent.get(row.agent_id) ?? [];
    list.push(row);
    dbPositionsByAgent.set(row.agent_id, list);
  }

  const latestSnapshotByAgent = new Map<string, SnapshotRow>();

  for (const row of (latestMetricsResult.data as SnapshotRow[] | null) ?? []) {
    const existing = latestSnapshotByAgent.get(row.agent_id);

    if (!existing || Date.parse(row.timestamp) > Date.parse(existing.timestamp)) {
      latestSnapshotByAgent.set(row.agent_id, row);
    }
  }

  const latestPayloadByAgent = pickLatestCyclePayloadPerAgent(
    (cyclesResult.data as CycleRow[] | null) ?? []
  );

  cyclePayloadCount = latestPayloadByAgent.size;

  for (const payload of latestPayloadByAgent.values()) {
    approxBytes += approximateJsonBytes(payload);
  }

  const decisionsByAgent = new Map<string, ReturnType<typeof cycleToDecisionRecord>>();

  for (const [agentId, payload] of latestPayloadByAgent.entries()) {
    const revived = reviveCycle(payload);

    if (!revived) {
      decisionsByAgent.set(agentId, null);
      continue;
    }

    revived.agentId = agentId;
    decisionsByAgent.set(agentId, cycleToDecisionRecord(revived));
  }

  const agentRows = new Map(
    ((agentsResult.data as AgentRow[] | null) ?? []).map((row) => [row.id, row])
  );

  const positionsByAgent: Record<string, PositionRow[]> = {};

  const agents: DashboardLiteAgent[] = live.map((definition) => {
    const row = agentRows.get(definition.id);
    const unwrapped = row ? unwrapAccountPayload(row.account_payload) : null;
    const initialCapital = row?.initial_capital ?? definition.initialCapital;
    const cash = unwrapped?.account.cash ?? initialCapital;
    const snapshot = latestSnapshotByAgent.get(definition.id);
    const equity =
      row?.last_equity ??
      snapshot?.equity ??
      unwrapped?.account.cash ??
      initialCapital;
    const returnPercent =
      snapshot?.return_percent ??
      (initialCapital > 0 ? ((equity - initialCapital) / initialCapital) * 100 : 0);
    const drawdownPercent = snapshot?.drawdown_percent ?? 0;
    const dbPositions = dbPositionsByAgent.get(definition.id) ?? [];
    const positionRows = buildPositionRows(
      dbPositions.map((position) => ({
        symbol: position.symbol,
        quantity: position.quantity,
        averageEntryPrice: position.average_entry_price,
      })),
      priceMap,
      equity
    );
    positionsByAgent[definition.id] = positionRows;
    const coinsDeployed = positionRows.reduce((sum, position) => sum + Math.abs(position.marketValue), 0);
    const storeStatus = mapAgentRiskStatus(row?.status ?? null);
    const latestCycle = reviveCycle(latestPayloadByAgent.get(definition.id));

    return {
      id: definition.id,
      name: definition.displayName,
      strategy: definition.strategyName,
      description: definition.description,
      mark: definition.mark,
      status: deriveAgentStatusFromStore(storeStatus, latestCycle?.status),
      initialCapital,
      equity,
      returnPercent,
      drawdownPercent,
      cash,
      coinsDeployed,
      winRatePercent: 0,
      trades: tradeCounts.get(definition.id) ?? 0,
      runtimeStatus: "LIVE",
      dataSource: "live",
    };
  });

  const riskAgent = agents.find((agent) => agent.id === DASHBOARD_LITE_RISK_AGENT_ID) ?? agents[0]!;
  const riskRow = agentRows.get(riskAgent.id);
  const riskPositions = buildPositionRows(
    (dbPositionsByAgent.get(riskAgent.id) ?? []).map((position) => ({
      symbol: position.symbol,
      quantity: position.quantity,
      averageEntryPrice: position.average_entry_price,
    })),
    priceMap,
    riskAgent.equity
  );

  const recentFills: DashboardLite["recentFills"] = [];

  for (const trade of (tradesResult.data as TradeRowDb[] | null) ?? []) {
    if (recentFills.length >= DASHBOARD_LITE_RECENT_FILLS_LIMIT) {
      break;
    }

    const side = trade.side as TradeAction;

    if (side !== "BUY" && side !== "SELL" && side !== "SHORT") {
      continue;
    }

    const definition = live.find((agent) => agent.id === trade.agent_id);

    recentFills.push({
      id: trade.id,
      symbol: trade.symbol as SupportedSymbol,
      side,
      notional: trade.notional,
      quantity: trade.quantity,
      price: trade.price,
      createdAt: trade.created_at,
      decisionId: trade.decision_id ?? trade.id,
      realizedPnl: trade.realized_pnl ?? undefined,
      agentId: trade.agent_id,
      agentName: definition?.displayName ?? trade.agent_id,
      mark: definition?.mark ?? "momentum",
    });
  }

  const combinedEquitySeries = buildCombinedEquitySeries(equitySeriesByAgent);
  const paused = agents.length > 0 && agents.every((agent) => agent.status === "PAUSED");

  logArenaEgress("dashboard-lite", {
    queryCount,
    cyclePayloadCount,
    approxBytes,
    agents: agents.length,
    recentFills: recentFills.length,
  });

  return {
    agents,
    positionsByAgent,
    summary: buildDashboardLiteSummary(agents),
    equitySeriesByAgent,
    combinedEquitySeries,
    latestDecisions: latestDecisionsFromCycles(decisionsByAgent),
    recentFills,
    risk: {
      agentId: riskAgent.id,
      equity: riskAgent.equity,
      dayStartEquity: riskRow?.day_start_equity ?? riskAgent.initialCapital,
      positions: riskPositions,
    },
    persistenceMode: "supabase",
    paused,
  };
}

export { dashboardLiteRoster, toLeaderboardAgent };

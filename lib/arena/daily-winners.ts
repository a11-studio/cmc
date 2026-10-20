import "server-only";

import { fetchEquitySeriesFromLedgerByAgent } from "@/lib/agent/equity-history-ledger";
import { listLiveAgents } from "@/lib/agents/registry";
import {
  buildDailyPnlByAgent,
  pickDailyWinners,
  type DailyWinnerEntry,
  type DailyWinnerEquityRow,
} from "@/lib/arena/daily-winners-core";
import { isSupabasePersistenceConfigured } from "@/lib/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { EquityCurvePoint } from "@/types/arena";

export type { DailyWinnerEntry } from "@/lib/arena/daily-winners-core";

/** Enough UTC days for winners without huge market_snapshots IN queries. */
const SNAPSHOT_LIMIT = 360;

function equityRowsFromLedgerSeries(
  seriesByAgent: Record<string, readonly EquityCurvePoint[]>
): DailyWinnerEquityRow[] {
  const rows: DailyWinnerEquityRow[] = [];

  for (const [agentId, points] of Object.entries(seriesByAgent)) {
    for (const point of points) {
      if (!point.at || !(point.equity > 0) || !Number.isFinite(point.equity)) {
        continue;
      }

      rows.push({
        agent_id: agentId,
        equity: point.equity,
        timestamp: point.at,
      });
    }
  }

  return rows;
}

async function fetchStoredWinnerEquityRows(
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  agentIds: readonly string[]
): Promise<DailyWinnerEquityRow[]> {
  if (agentIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("portfolio_snapshots")
    .select("agent_id, equity, timestamp")
    .in("agent_id", agentIds)
    .order("timestamp", { ascending: false })
    .limit(agentIds.length * SNAPSHOT_LIMIT);

  if (error) {
    throw new Error(`daily winners stored snapshots: ${error.message}`);
  }

  return (data ?? []) as DailyWinnerEquityRow[];
}

export async function fetchDailyWinners(): Promise<DailyWinnerEntry[]> {
  const live = listLiveAgents();

  if (live.length === 0 || !isSupabasePersistenceConfigured()) {
    return [];
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return [];
  }

  const agentIds = live.map((agent) => agent.id);
  const agentMeta = new Map(
    live.map((agent) => [agent.id, { name: agent.displayName, mark: agent.mark, strategy: agent.description }])
  );

  const agentConfigs = live.map((agent) => ({
    id: agent.id,
    initialCapital: agent.initialCapital,
  }));

  let ledgerSeries: Record<string, EquityCurvePoint[]> = {};

  try {
    ledgerSeries = await fetchEquitySeriesFromLedgerByAgent(
      client,
      agentConfigs,
      SNAPSHOT_LIMIT
    );
  } catch (error) {
    console.warn("daily winners equity ledger failed; using stored snapshots", error);
  }

  const ledgerRows = equityRowsFromLedgerSeries(ledgerSeries);
  const agentsWithoutLedger = agentIds.filter((agentId) => (ledgerSeries[agentId]?.length ?? 0) === 0);
  const storedRows = await fetchStoredWinnerEquityRows(client, agentsWithoutLedger);

  const rows = [...ledgerRows, ...storedRows].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp)
  );
  const byAgent = buildDailyPnlByAgent(rows, agentMeta);

  return pickDailyWinners(byAgent, agentMeta);
}

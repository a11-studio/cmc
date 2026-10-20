import "server-only";

import { listLiveAgents } from "@/lib/agents/registry";
import {
  buildDailyPnlByAgent,
  pickDailyWinners,
  stabilizeIntradayEquitySpikes,
  type DailyWinnerEntry,
  type DailyWinnerEquityRow,
} from "@/lib/arena/daily-winners-core";
import { isSupabasePersistenceConfigured } from "@/lib/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
export type { DailyWinnerEntry } from "@/lib/arena/daily-winners-core";

/** Per-agent snapshot cap — enough UTC days for daily crowns without one global limit. */
const SNAPSHOT_LIMIT = 360;

async function fetchStoredWinnerEquityRows(
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  agentIds: readonly string[]
): Promise<DailyWinnerEquityRow[]> {
  if (agentIds.length === 0) {
    return [];
  }

  const rows: DailyWinnerEquityRow[] = [];

  await Promise.all(
    agentIds.map(async (agentId) => {
      const { data, error } = await client
        .from("portfolio_snapshots")
        .select("agent_id, equity, timestamp")
        .eq("agent_id", agentId)
        .order("timestamp", { ascending: false })
        .limit(SNAPSHOT_LIMIT);

      if (error) {
        throw new Error(`daily winners stored snapshots: ${error.message}`);
      }

      rows.push(...((data ?? []) as DailyWinnerEquityRow[]));
    })
  );

  return rows;
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

  // Daily crowns use dense portfolio_snapshots (one row per cycle). Ledger replay is
  // sparse per agent and was hiding real day-to-day leaders (e.g. Warren Buffett).
  const storedRows = await fetchStoredWinnerEquityRows(client, agentIds);
  const rows = stabilizeIntradayEquitySpikes(
    storedRows.sort((left, right) => left.timestamp.localeCompare(right.timestamp))
  );
  const byAgent = buildDailyPnlByAgent(rows, agentMeta);
  const initialCapitalByAgent = new Map(live.map((agent) => [agent.id, agent.initialCapital]));

  return pickDailyWinners(byAgent, agentMeta, initialCapitalByAgent);
}

import "server-only";

import { listLiveAgents } from "@/lib/agents/registry";
import {
  buildDailyPnlByAgent,
  pickDailyWinners,
  type DailyWinnerEntry,
  type DailyWinnerEquityRow,
} from "@/lib/arena/daily-winners-core";
import { isSupabasePersistenceConfigured } from "@/lib/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type { DailyWinnerEntry } from "@/lib/arena/daily-winners-core";

const SNAPSHOT_LIMIT = 4_000;

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

  const { data, error } = await client
    .from("portfolio_snapshots")
    .select("agent_id, equity, timestamp")
    .in("agent_id", agentIds)
    .order("timestamp", { ascending: true })
    .limit(SNAPSHOT_LIMIT);

  if (error) {
    throw new Error(`daily winners: ${error.message}`);
  }

  const rows = (data ?? []) as DailyWinnerEquityRow[];
  const byAgent = buildDailyPnlByAgent(rows, agentMeta);

  return pickDailyWinners(byAgent, agentMeta);
}

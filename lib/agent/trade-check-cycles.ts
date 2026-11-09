import "server-only";

import { reviveCycle } from "@/lib/agent/persist";
import type { AgentCycleResult } from "@/lib/agent/types";
import { ARENA_SEASON_START } from "@/lib/agent/season";
import { HOURLY_GRID_DAYS } from "@/lib/charts/trade-heatmap";
import type { SupabaseClient } from "@supabase/supabase-js";

const HOURLY_GRID_WINDOW_MS = HOURLY_GRID_DAYS * 24 * 60 * 60 * 1000;

/**
 * Cycles behind the hourly Trade checks grid: every cycle of the current season in
 * the last HOURLY_GRID_DAYS days (plus a day of margin), not just the last
 * HYDRATE_CYCLE_LIMIT dashboard cycles. Slim payloads still carry
 * marketCheckAssets + decisions for this path.
 */
export async function loadTradeCheckCycles(
  client: SupabaseClient,
  agentId: string,
  now = new Date()
): Promise<AgentCycleResult[]> {
  const windowStart = now.getTime() - HOURLY_GRID_WINDOW_MS - 24 * 60 * 60 * 1000;
  const since = new Date(Math.max(windowStart, Date.parse(ARENA_SEASON_START))).toISOString();

  const { data, error } = await client
    .from("agent_cycles")
    .select("payload, completed_at, started_at, status")
    .eq("agent_id", agentId)
    .neq("status", "CLAIMED")
    .gte("completed_at", since)
    .order("completed_at", { ascending: true });

  if (error) {
    throw new Error(`load trade check cycles: ${error.message}`);
  }

  const revived: AgentCycleResult[] = [];

  for (const row of data ?? []) {
    const cycle = reviveCycle(row.payload);

    if (!cycle) {
      continue;
    }

    const completedAt = (row.completed_at as string | null) ?? cycle.completedAt;
    const startedAt = (row.started_at as string | null) ?? cycle.startedAt;

    if (completedAt) {
      cycle.completedAt = completedAt;
    }

    if (startedAt) {
      cycle.startedAt = startedAt;
    }

    if (typeof row.status === "string") {
      cycle.status = row.status as AgentCycleResult["status"];
    }

    revived.push(cycle);
  }

  return revived;
}

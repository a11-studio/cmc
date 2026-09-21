import "server-only";

import { reviveCycle } from "@/lib/agent/persist";
import type { AgentCycleResult } from "@/lib/agent/types";
import type { Trade } from "@/lib/paper/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Trade-check scoring needs the full hourly chain since the first fill, not just
 * the last HYDRATE_CYCLE_LIMIT dashboard cycles. Slim payloads still carry
 * marketCheckAssets + decisions for this path.
 */
export async function loadTradeCheckCycles(
  client: SupabaseClient,
  agentId: string,
  trades: readonly Trade[]
): Promise<AgentCycleResult[]> {
  if (trades.length === 0) {
    return [];
  }

  let earliest = Number.POSITIVE_INFINITY;

  for (const trade of trades) {
    const at = Date.parse(trade.createdAt);

    if (Number.isFinite(at)) {
      earliest = Math.min(earliest, at);
    }
  }

  if (!Number.isFinite(earliest)) {
    return [];
  }

  const since = new Date(earliest).toISOString();

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

import "server-only";

import { approximateJsonBytes, logArenaEgress } from "@/lib/agent/egress-log";
import { isSupabasePersistenceConfigured } from "@/lib/env.server";
import {
  DEFAULT_TTL_CACHE_MS,
  getTtlCached,
  invalidateTtlCache,
  setTtlCached,
  ttlCacheKey,
} from "@/lib/server/ttl-cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { EquityCurvePoint } from "@/types/arena";

/** Chart history — lightweight rows only (no cycle payloads). */
export const EQUITY_HISTORY_LIMIT = 120;

function cacheKey(agentId: string): string {
  return ttlCacheKey(["arena", "equity-history", agentId]);
}

export function invalidateAgentEquityHistoryCache(agentId: string): void {
  invalidateTtlCache(cacheKey(agentId));
}

async function fetchAgentPortfolioEquityHistoryUncached(agentId: string): Promise<EquityCurvePoint[]> {
  if (!isSupabasePersistenceConfigured()) {
    return [];
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("portfolio_snapshots")
    .select("equity, timestamp, cycle_id")
    .eq("agent_id", agentId)
    .order("timestamp", { ascending: true })
    .limit(EQUITY_HISTORY_LIMIT);

  if (error) {
    throw new Error(`equity history: ${error.message}`);
  }

  const rows = data ?? [];

  logArenaEgress("equity-history", {
    agentId,
    rows: rows.length,
    approxBytes: approximateJsonBytes(rows),
    cache: "miss",
  });

  return rows.flatMap((row) => {
    const equity = row.equity;
    const at = row.timestamp;

    if (typeof equity !== "number" || !Number.isFinite(equity) || typeof at !== "string") {
      return [];
    }

    return [
      {
        equity,
        at,
        label: typeof row.cycle_id === "string" ? row.cycle_id : undefined,
      },
    ];
  });
}

export async function fetchAgentPortfolioEquityHistory(agentId: string): Promise<EquityCurvePoint[]> {
  const key = cacheKey(agentId);
  const cached = getTtlCached<EquityCurvePoint[]>(key);

  if (cached) {
    logArenaEgress("equity-history", { agentId, cache: "hit" });
    return cached;
  }

  const points = await fetchAgentPortfolioEquityHistoryUncached(agentId);
  setTtlCached(key, points, DEFAULT_TTL_CACHE_MS);
  return points;
}

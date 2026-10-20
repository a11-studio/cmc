import "server-only";

import { approximateJsonBytes, logArenaEgress } from "@/lib/agent/egress-log";
import { fetchAgentEquityHistoryFromLedger } from "@/lib/agent/equity-history-ledger";
import { findAgentDefinition } from "@/lib/agents/registry";
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

import { latestEquityHistoryRows } from "@/lib/agent/equity-history-rows";
import { filterAgentPortfolioEquityHistoryForDisplay } from "@/lib/agent/portfolio-equity-display";

/** Chart history — lightweight rows only (no cycle payloads). */
export const EQUITY_HISTORY_LIMIT = 120;

export { latestEquityHistoryRows } from "@/lib/agent/equity-history-rows";

function cacheKey(agentId: string): string {
  return ttlCacheKey(["arena", "equity-history", agentId]);
}

export function invalidateAgentEquityHistoryCache(agentId: string): void {
  invalidateTtlCache(cacheKey(agentId));
}

function initialCapitalFor(agentId: string): number {
  return findAgentDefinition(agentId)?.initialCapital ?? 10_000;
}

async function fetchStoredPortfolioEquityHistory(
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  agentId: string
): Promise<EquityCurvePoint[]> {
  const { data, error } = await client
    .from("portfolio_snapshots")
    .select("equity, timestamp, cycle_id")
    .eq("agent_id", agentId)
    .order("timestamp", { ascending: false })
    .limit(EQUITY_HISTORY_LIMIT);

  if (error) {
    throw new Error(`equity history: ${error.message}`);
  }

  const rows = latestEquityHistoryRows(data ?? [], EQUITY_HISTORY_LIMIT);

  const points = rows.flatMap((row) => {
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

  return filterAgentPortfolioEquityHistoryForDisplay(agentId, points);
}

async function fetchAgentPortfolioEquityHistoryUncached(agentId: string): Promise<EquityCurvePoint[]> {
  if (!isSupabasePersistenceConfigured()) {
    return [];
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return [];
  }

  const { count, error: tradeCountError } = await client
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId);

  if (tradeCountError) {
    throw new Error(`equity history trade count: ${tradeCountError.message}`);
  }

  let source: "ledger" | "snapshots" = "snapshots";
  let points: EquityCurvePoint[] = [];

  if ((count ?? 0) > 0) {
    try {
      points = await fetchAgentEquityHistoryFromLedger(
        client,
        agentId,
        initialCapitalFor(agentId),
        EQUITY_HISTORY_LIMIT
      );
      source = points.length > 0 ? "ledger" : "snapshots";
    } catch (error) {
      console.warn(`equity ledger history failed for ${agentId}`, error);
    }
  }

  if (points.length === 0) {
    points = await fetchStoredPortfolioEquityHistory(client, agentId);
    source = "snapshots";
  }

  logArenaEgress("equity-history", {
    agentId,
    rows: points.length,
    approxBytes: approximateJsonBytes(points),
    cache: "miss",
    source,
  });

  return points;
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

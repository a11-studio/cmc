import "server-only";

import { latestCycleCompletedAt } from "@/lib/agent/scheduler";
import type { AgentCycleResult } from "@/lib/agent/types";
import { listLiveAgents } from "@/lib/agents/registry";
import { isSupabasePersistenceConfigured } from "@/lib/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_TTL_CACHE_MS,
  getTtlCached,
  invalidateTtlCache,
  setTtlCached,
  ttlCacheKey,
} from "@/lib/server/ttl-cache";
import { logArenaEgress, approximateJsonBytes } from "@/lib/agent/egress-log";

const CYCLE_CONTROL_CACHE_KEY = ttlCacheKey(["arena", "cycle-control"]);

export type ArenaCycleControl = {
  lastCompletedAt: string | null;
  autoRun: boolean;
  paused: boolean;
};

type AgentStatusRow = { id: string; status: string | null };
type CycleCompletedRow = {
  agent_id: string;
  completed_at: string | null;
  status: string | null;
};

function isAgentRiskStatus(value: string | null): value is "ACTIVE" | "PAUSED" | "ERROR" {
  return value === "ACTIVE" || value === "PAUSED" || value === "ERROR";
}

function controlFromMemory(): ArenaCycleControl {
  return {
    lastCompletedAt: null,
    autoRun: listLiveAgents().some((agent) => agent.status === "LIVE"),
    paused: false,
  };
}

async function fetchArenaCycleControlFromSupabase(): Promise<ArenaCycleControl> {
  const liveAgents = listLiveAgents();
  const agentIds = liveAgents.map((agent) => agent.id);

  if (agentIds.length === 0) {
    return { lastCompletedAt: null, autoRun: false, paused: true };
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return controlFromMemory();
  }

  const [statusResult, cyclesResult] = await Promise.all([
    client.from("agents").select("id, status").in("id", agentIds),
    client
      .from("agent_cycles")
      .select("agent_id, completed_at, status")
      .in("agent_id", agentIds)
      .not("completed_at", "is", null)
      .neq("status", "CLAIMED")
      .order("completed_at", { ascending: false })
      .limit(agentIds.length * 4),
  ]);

  if (statusResult.error) {
    throw new Error(`cycle control agents: ${statusResult.error.message}`);
  }

  if (cyclesResult.error) {
    throw new Error(`cycle control cycles: ${cyclesResult.error.message}`);
  }

  const statuses = (statusResult.data as AgentStatusRow[] | null) ?? [];
  const cycleRows = (cyclesResult.data as CycleCompletedRow[] | null) ?? [];

  const payloadBytes =
    approximateJsonBytes(statuses) + approximateJsonBytes(cycleRows);

  logArenaEgress("cycle-control", {
    agents: agentIds.length,
    statusRows: statuses.length,
    cycleRows: cycleRows.length,
    approxBytes: payloadBytes,
    cache: "miss",
  });

  const statusById = new Map(statuses.map((row) => [row.id, row.status]));
  const agentStatuses = agentIds.map((id) => {
    const status = statusById.get(id) ?? null;
    return isAgentRiskStatus(status) ? status : "ACTIVE";
  });

  const pseudoCycles: Pick<AgentCycleResult, "status" | "completedAt">[] = cycleRows
    .filter((row) => row.completed_at)
    .map((row) => ({
      status: (row.status ?? "COMPLETED") as AgentCycleResult["status"],
      completedAt: row.completed_at!,
    }));

  return {
    lastCompletedAt: latestCycleCompletedAt(pseudoCycles),
    autoRun: agentStatuses.some((status) => status === "ACTIVE"),
    paused: agentStatuses.length > 0 && agentStatuses.every((status) => status === "PAUSED"),
  };
}

export async function getArenaCycleControlState(): Promise<ArenaCycleControl> {
  if (!isSupabasePersistenceConfigured()) {
    return controlFromMemory();
  }

  const cached = getTtlCached<ArenaCycleControl>(CYCLE_CONTROL_CACHE_KEY);

  if (cached) {
    logArenaEgress("cycle-control", { cache: "hit" });
    return cached;
  }

  const state = await fetchArenaCycleControlFromSupabase();
  setTtlCached(CYCLE_CONTROL_CACHE_KEY, state, DEFAULT_TTL_CACHE_MS);
  return state;
}

export function invalidateArenaCycleControlCache(): void {
  invalidateTtlCache(CYCLE_CONTROL_CACHE_KEY);
}

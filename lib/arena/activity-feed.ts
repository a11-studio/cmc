import "server-only";

import { getAgentStore } from "@/lib/agent/runtime";
import type { AgentCycleResult } from "@/lib/agent/types";
import { buildActivityFeedFromCycles, ACTIVITY_FEED_LIMIT } from "@/lib/arena/activity-feed-core";
import { listLiveAgents } from "@/lib/agents/registry";
import { isSupabasePersistenceConfigured } from "@/lib/env.server";
import { reviveCycle } from "@/lib/agent/persist";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ActivityFeedPayload } from "@/lib/arena/activity-feed-core";

export { ACTIVITY_FEED_LIMIT } from "@/lib/arena/activity-feed-core";
export type { ActivityFeedPayload } from "@/lib/arena/activity-feed-core";

async function fetchActivityFeedFromSupabase(): Promise<ActivityFeedPayload> {
  const live = listLiveAgents();
  const agentIds = live.map((agent) => agent.id);

  if (agentIds.length === 0) {
    return { latest: { cycles: [], events: [] }, older: { cycles: [], events: [] } };
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return { latest: { cycles: [], events: [] }, older: { cycles: [], events: [] } };
  }

  const { data, error } = await client
    .from("agent_cycles")
    .select("payload, completed_at, started_at, status")
    .in("agent_id", agentIds)
    .neq("status", "CLAIMED")
    .order("completed_at", { ascending: false })
    .limit(ACTIVITY_FEED_LIMIT);

  if (error) {
    throw new Error(`activity feed: ${error.message}`);
  }

  const revived: AgentCycleResult[] = [];

  for (const row of data ?? []) {
    const cycle = reviveCycle(row.payload);

    if (!cycle) {
      continue;
    }

    if (row.completed_at) {
      cycle.completedAt = row.completed_at as string;
    }

    if (row.started_at) {
      cycle.startedAt = row.started_at as string;
    }

    if (typeof row.status === "string") {
      cycle.status = row.status as AgentCycleResult["status"];
    }

    revived.push(cycle);
  }

  return buildActivityFeedFromCycles(revived);
}

async function fetchActivityFeedFromStores(): Promise<ActivityFeedPayload> {
  const live = listLiveAgents();
  const cycles: AgentCycleResult[] = [];

  for (const agent of live) {
    const store = await getAgentStore(agent.id);
    cycles.push(...store.listCycles());
  }

  return buildActivityFeedFromCycles(cycles);
}

export async function fetchActivityFeed(): Promise<ActivityFeedPayload> {
  if (isSupabasePersistenceConfigured()) {
    return fetchActivityFeedFromSupabase();
  }

  return fetchActivityFeedFromStores();
}

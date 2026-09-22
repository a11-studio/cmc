import "server-only";

import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
import { invalidateArenaCycleControlCache } from "@/lib/agent/cycle-control";
import { invalidateAgentEquityHistoryCache } from "@/lib/agent/equity-history";
import { approximateJsonBytes, logArenaEgress } from "@/lib/agent/egress-log";
import { loadPaperAccountForDashboard, loadPaperAccountForExecution } from "@/lib/agent/hydrate-account";
import { mergeOpenPositionsFromDatabase } from "@/lib/agent/hydrate-account";
import {
  attachMarketSnapshotIfMissing,
  createStoreFromPersistedState,
  persistArenaState,
  persistedStateFromRows,
  reviveCycle,
  snapshotPersistedState,
  type ArenaWriter,
  type PersistedAgentRow,
  type PersistedCycleRow,
} from "@/lib/agent/persist";
import { createInMemoryAgentStore } from "@/lib/agent/store";
import type { AgentCycleResult, AgentCycleStore } from "@/lib/agent/types";
import { findAgentDefinition, toAgentIdentity } from "@/lib/agents/registry";
import { isSupabasePersistenceConfigured } from "@/lib/env.server";
import {
  DEFAULT_TTL_CACHE_MS,
  getTtlCached,
  invalidateTtlCache,
  setTtlCached,
  ttlCacheKey,
} from "@/lib/server/ttl-cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Recent cycles for dashboard charts, decisions, and trade checks.
 * ~48 hourly cycles ≈ 2 days; matches typical Arena UI windows.
 */
export const HYDRATE_CYCLE_LIMIT = 48;

/** How long a CLAIMED row may sit before another run may take the slot over. */
export const STALE_CLAIM_MS = 10 * 60 * 1000;

export type HydratePurpose = "dashboard" | "execution";

function throwIfError(error: { message: string } | null, action: string): void {
  if (error) {
    throw new Error(`${action}: ${error.message}`);
  }
}

function identityFor(agentId: string) {
  const definition = findAgentDefinition(agentId);
  return definition ? toAgentIdentity(definition) : MOMENTUM_ALPHA_AGENT;
}

function emptyStore(agentId: string): AgentCycleStore {
  return createInMemoryAgentStore({ initialCapital: identityFor(agentId).initialCapital });
}

function hydrateCacheKey(agentId: string, purpose: HydratePurpose): string {
  return ttlCacheKey(["arena", "hydrate", purpose, agentId]);
}

export function invalidateAgentHydrateCache(agentId?: string): void {
  if (agentId) {
    invalidateTtlCache(hydrateCacheKey(agentId, "dashboard"));
    invalidateTtlCache(hydrateCacheKey(agentId, "execution"));
    invalidateAgentEquityHistoryCache(agentId);
  }

  invalidateArenaCycleControlCache();
}

export function createSupabaseArenaWriter(client: SupabaseClient): ArenaWriter {
  return {
    async upsert(table, rows, onConflict) {
      const { error } = await client.from(table).upsert(rows, { onConflict });
      throwIfError(error, `upsert ${table}`);
    },
    async deleteEq(table, column, value) {
      const { error } = await client.from(table).delete().eq(column, value);
      throwIfError(error, `delete ${table}`);
    },
  };
}

export async function fetchPersistedCycle(
  agentId: string,
  cycleId: string
): Promise<AgentCycleResult | null> {
  if (!isSupabasePersistenceConfigured()) {
    return null;
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("agent_cycles")
    .select("payload")
    .eq("agent_id", agentId)
    .eq("cycle_id", cycleId)
    .maybeSingle();

  throwIfError(error, "fetch cycle");

  const cycle = reviveCycle((data as { payload: unknown } | null)?.payload);

  if (!cycle) {
    return null;
  }

  return attachMarketSnapshotIfMissing(client, cycle);
}

async function hydrateAgentStoreUncached(
  agentId: string,
  purpose: HydratePurpose
): Promise<AgentCycleStore> {
  if (!isSupabasePersistenceConfigured()) {
    return emptyStore(agentId);
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return emptyStore(agentId);
  }

  const [agentResult, cyclesResult] = await Promise.all([
    client
      .from("agents")
      .select("account_payload, status, day_start_equity, last_equity, day_key")
      .eq("id", agentId)
      .maybeSingle(),
    client
      .from("agent_cycles")
      .select("payload, status")
      .eq("agent_id", agentId)
      .neq("status", "CLAIMED")
      .order("started_at", { ascending: false })
      .limit(HYDRATE_CYCLE_LIMIT),
  ]);

  throwIfError(agentResult.error, "hydrate agent");
  throwIfError(cyclesResult.error, "hydrate cycles");

  const agentRow = agentResult.data as PersistedAgentRow | null;

  if (!agentRow) {
    return emptyStore(agentId);
  }

  const account =
    purpose === "execution"
      ? await loadPaperAccountForExecution(client, agentId, agentRow)
      : await loadPaperAccountForDashboard(client, agentId, agentRow);

  const cycleRows = [...((cyclesResult.data as PersistedCycleRow[] | null) ?? [])].reverse();

  const approxBytes =
    approximateJsonBytes(agentRow.account_payload) +
    cycleRows.reduce((sum, row) => sum + approximateJsonBytes(row.payload), 0);

  logArenaEgress("hydrate", {
    agentId,
    purpose,
    cycles: cycleRows.length,
    approxBytes,
    cache: "miss",
  });

  const state = persistedStateFromRows(agentRow, cycleRows, new Date(), agentId);

  if (!state) {
    return emptyStore(agentId);
  }

  state.account = account;

  return createStoreFromPersistedState(state);
}

export async function hydrateAgentStore(
  agentId: string,
  purpose: HydratePurpose = "dashboard"
): Promise<AgentCycleStore> {
  if (!isSupabasePersistenceConfigured()) {
    return emptyStore(agentId);
  }

  if (purpose === "execution") {
    return hydrateAgentStoreUncached(agentId, purpose);
  }

  const key = hydrateCacheKey(agentId, purpose);
  const cached = getTtlCached<AgentCycleStore>(key);

  if (cached) {
    logArenaEgress("hydrate", { agentId, purpose, cache: "hit" });
    return cached;
  }

  const store = await hydrateAgentStoreUncached(agentId, purpose);
  setTtlCached(key, store, DEFAULT_TTL_CACHE_MS);
  return store;
}

export async function persistAgentStore(agentId: string, store: AgentCycleStore): Promise<void> {
  if (!isSupabasePersistenceConfigured()) {
    return;
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return;
  }

  const state = snapshotPersistedState(store, new Date(), agentId);
  state.account = await mergeOpenPositionsFromDatabase(client, agentId, state.account);
  await persistArenaState(createSupabaseArenaWriter(client), state);
  invalidateAgentHydrateCache(agentId);
}

export async function claimAgentCycle(agentId: string, cycleId: string, now = new Date()): Promise<boolean> {
  if (!isSupabasePersistenceConfigured()) {
    return true;
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return true;
  }

  const { data, error } = await client
    .from("agent_cycles")
    .upsert(
      {
        agent_id: agentId,
        cycle_id: cycleId,
        started_at: now.toISOString(),
        status: "CLAIMED",
        payload: {},
      },
      { onConflict: "agent_id,cycle_id", ignoreDuplicates: true }
    )
    .select("cycle_id");

  throwIfError(error, "claim cycle");

  if ((data?.length ?? 0) > 0) {
    return true;
  }

  const abandonedBefore = new Date(now.getTime() - STALE_CLAIM_MS).toISOString();

  const { data: reclaimed, error: reclaimError } = await client
    .from("agent_cycles")
    .update({ started_at: now.toISOString() })
    .eq("agent_id", agentId)
    .eq("cycle_id", cycleId)
    .eq("status", "CLAIMED")
    .lt("started_at", abandonedBefore)
    .select("cycle_id");

  throwIfError(reclaimError, "reclaim cycle");

  return (reclaimed?.length ?? 0) > 0;
}

export async function hydrateMomentumAlphaStore(): Promise<AgentCycleStore> {
  return hydrateAgentStore(MOMENTUM_ALPHA_AGENT.id);
}

export async function persistMomentumAlphaStore(store: AgentCycleStore): Promise<void> {
  return persistAgentStore(MOMENTUM_ALPHA_AGENT.id, store);
}

export async function claimMomentumAlphaCycle(cycleId: string, now = new Date()): Promise<boolean> {
  return claimAgentCycle(MOMENTUM_ALPHA_AGENT.id, cycleId, now);
}

export function skippedDuplicateFromStore(
  store: AgentCycleStore,
  cycleId: string,
  now = new Date(),
  agentId: string = MOMENTUM_ALPHA_AGENT.id
): AgentCycleResult {
  const prior = store.findCycle(cycleId);
  const account = store.getAccount();
  const startedAt = now.toISOString();
  const identity = identityFor(agentId);

  return {
    status: "SKIPPED_DUPLICATE",
    agentId: prior?.agentId ?? identity.id,
    strategy: prior?.strategy ?? identity.strategy,
    cycleId,
    snapshotTimestamp: prior?.snapshotTimestamp ?? null,
    snapshot: prior?.snapshot ?? null,
    decision: prior?.decision ?? null,
    riskResult: prior?.riskResult ?? null,
    execution: prior?.execution ?? null,
    valuation: prior?.valuation ?? null,
    account: prior?.account ?? account,
    events: [
      ...(prior?.events ?? []),
      { at: startedAt, type: "CYCLE_SKIPPED", detail: `Cycle ${cycleId} already claimed` },
    ],
    startedAt: prior?.startedAt ?? startedAt,
    completedAt: startedAt,
    trace: {
      agentId: prior?.agentId ?? identity.id,
      strategy: prior?.strategy ?? identity.strategy,
      cycleId,
      snapshotTimestamp: prior?.snapshotTimestamp ?? null,
      decision: prior?.decision ?? null,
      riskResult: prior?.riskResult ?? null,
      execution: prior?.execution ?? null,
    },
  };
}

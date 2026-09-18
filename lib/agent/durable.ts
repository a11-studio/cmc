import "server-only";

import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
import {
  createStoreFromPersistedState,
  persistArenaState,
  persistedStateFromRows,
  snapshotPersistedState,
  type ArenaWriter,
  type PersistedAgentRow,
  type PersistedCycleRow,
} from "@/lib/agent/persist";
import { createInMemoryAgentStore } from "@/lib/agent/store";
import type { AgentCycleResult, AgentCycleStore } from "@/lib/agent/types";
import { isSupabasePersistenceConfigured } from "@/lib/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const UNIQUE_VIOLATION = "23505";

function throwIfError(error: { message: string } | null, action: string): void {
  if (error) {
    throw new Error(`${action}: ${error.message}`);
  }
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

export async function hydrateMomentumAlphaStore(): Promise<AgentCycleStore> {
  if (!isSupabasePersistenceConfigured()) {
    return createInMemoryAgentStore();
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return createInMemoryAgentStore();
  }

  const agentResult = await client
    .from("agents")
    .select("account_payload, status, day_start_equity, last_equity, day_key")
    .eq("id", MOMENTUM_ALPHA_AGENT.id)
    .maybeSingle();

  throwIfError(agentResult.error, "hydrate agent");

  const cyclesResult = await client
    .from("agent_cycles")
    .select("payload, status")
    .eq("agent_id", MOMENTUM_ALPHA_AGENT.id)
    .order("started_at", { ascending: true });

  throwIfError(cyclesResult.error, "hydrate cycles");

  const state = persistedStateFromRows(
    (agentResult.data as PersistedAgentRow | null) ?? null,
    (cyclesResult.data as PersistedCycleRow[] | null) ?? []
  );

  if (!state) {
    return createInMemoryAgentStore();
  }

  return createStoreFromPersistedState(state);
}

export async function persistMomentumAlphaStore(store: AgentCycleStore): Promise<void> {
  if (!isSupabasePersistenceConfigured()) {
    return;
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return;
  }

  await persistArenaState(createSupabaseArenaWriter(client), snapshotPersistedState(store));
}

export async function claimMomentumAlphaCycle(cycleId: string, now = new Date()): Promise<boolean> {
  if (!isSupabasePersistenceConfigured()) {
    return true;
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return true;
  }

  const { error } = await client.from("agent_cycles").insert({
    agent_id: MOMENTUM_ALPHA_AGENT.id,
    cycle_id: cycleId,
    started_at: now.toISOString(),
    status: "CLAIMED",
    payload: {},
  });

  if (error?.code === UNIQUE_VIOLATION) {
    return false;
  }

  throwIfError(error, "claim cycle");
  return true;
}

export function skippedDuplicateFromStore(
  store: AgentCycleStore,
  cycleId: string,
  now = new Date()
): AgentCycleResult {
  const prior = store.findCycle(cycleId);
  const account = store.getAccount();
  const startedAt = now.toISOString();

  return {
    status: "SKIPPED_DUPLICATE",
    agentId: prior?.agentId ?? MOMENTUM_ALPHA_AGENT.id,
    strategy: prior?.strategy ?? MOMENTUM_ALPHA_AGENT.strategy,
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
      agentId: prior?.agentId ?? MOMENTUM_ALPHA_AGENT.id,
      strategy: prior?.strategy ?? MOMENTUM_ALPHA_AGENT.strategy,
      cycleId,
      snapshotTimestamp: prior?.snapshotTimestamp ?? null,
      decision: prior?.decision ?? null,
      riskResult: prior?.riskResult ?? null,
      execution: prior?.execution ?? null,
    },
  };
}

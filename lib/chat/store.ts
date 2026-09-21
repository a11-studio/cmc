import "server-only";

import { findAgentDefinition } from "@/lib/agents/registry";
import { ARENA_ADMIN_AGENT_ID, ARENA_ADMIN_DISPLAY_NAME } from "@/lib/chat/constants";
import { isSupabasePersistenceConfigured } from "@/lib/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isArenaChatKind } from "@/lib/chat/speak";
import type { ArenaChatMessage } from "@/lib/chat/types";

const memory: ArenaChatMessage[] = [];
const MEMORY_CAP = 200;

function displayName(agentId: string | null): string | null {
  if (!agentId) {
    return null;
  }

  if (agentId === ARENA_ADMIN_AGENT_ID) {
    return ARENA_ADMIN_DISPLAY_NAME;
  }

  return findAgentDefinition(agentId)?.displayName ?? agentId;
}

function fromRow(row: {
  id: string;
  agent_id: string;
  cycle_id: string | null;
  kind: string;
  addressed_agent_id: string | null;
  body: string;
  created_at: string;
}): ArenaChatMessage | null {
  if (!isArenaChatKind(row.kind)) {
    return null;
  }

  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: displayName(row.agent_id) ?? row.agent_id,
    cycleId: row.cycle_id,
    kind: row.kind,
    addressedAgentId: row.addressed_agent_id,
    addressedAgentName: displayName(row.addressed_agent_id),
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function listArenaChatMessages(limit = 80): Promise<ArenaChatMessage[]> {
  if (!isSupabasePersistenceConfigured()) {
    return memory.slice(-limit);
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return memory.slice(-limit);
  }

  const { data, error } = await client
    .from("arena_chat_messages")
    .select("id, agent_id, cycle_id, kind, addressed_agent_id, body, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`list chat: ${error.message}`);
  }

  return (data ?? [])
    .slice()
    .reverse()
    .flatMap((row) => {
      const message = fromRow(row);
      return message ? [message] : [];
    });
}

export async function insertArenaChatMessages(messages: ArenaChatMessage[]): Promise<void> {
  if (messages.length === 0) {
    return;
  }

  for (const message of messages) {
    memory.push(message);
  }

  if (memory.length > MEMORY_CAP) {
    memory.splice(0, memory.length - MEMORY_CAP);
  }

  if (!isSupabasePersistenceConfigured()) {
    return;
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return;
  }

  const { error } = await client.from("arena_chat_messages").upsert(
    messages.map((message) => ({
      id: message.id,
      agent_id: message.agentId,
      cycle_id: message.cycleId,
      kind: message.kind,
      addressed_agent_id: message.addressedAgentId,
      body: message.body,
      created_at: message.createdAt,
    })),
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(`insert chat: ${error.message}`);
  }
}

export function resetArenaChatMemory() {
  memory.length = 0;
}

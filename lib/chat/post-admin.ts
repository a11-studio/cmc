import "server-only";

import { randomUUID } from "node:crypto";

import { createGeminiClient } from "@/lib/ai/client";
import { getGeminiApiKey } from "@/lib/ai/config";
import { hasServerEnv } from "@/lib/env.server";
import { getAgentDefinition, listLiveAgents } from "@/lib/agents/registry";
import { loadAgentSkill } from "@/lib/agents/skills";
import { isArenaAdminChatEnabled } from "@/lib/chat/admin-auth";
import { ARENA_ADMIN_AGENT_ID, ARENA_ADMIN_DISPLAY_NAME } from "@/lib/chat/constants";
import { generateChatJson } from "@/lib/chat/generate";
import {
  ARENA_CHAT_REPLY_SCHEMA,
  buildChatAdminReplyUserPrompt,
  buildChatSystemPrompt,
} from "@/lib/chat/prompts";
import { ARENA_ADMIN_MESSAGE_MAX_LENGTH, chatMessageId, parseChatReply } from "@/lib/chat/speak";
import { insertArenaChatMessages } from "@/lib/chat/store";
import type { ArenaChatMessage } from "@/lib/chat/types";

export class ArenaAdminChatError extends Error {
  constructor(
    message: string,
    readonly code: "DISABLED" | "EMPTY" | "TOO_LONG" | "UNKNOWN_AGENT"
  ) {
    super(message);
    this.name = "ArenaAdminChatError";
  }
}

function normalizeAddressedAgentId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (!listLiveAgents().some((agent) => agent.id === trimmed)) {
    throw new ArenaAdminChatError("Unknown live agent", "UNKNOWN_AGENT");
  }

  return trimmed;
}

async function maybeReplyToAdminMessage(adminMessage: ArenaChatMessage): Promise<ArenaChatMessage[]> {
  if (!adminMessage.addressedAgentId || !hasServerEnv("GEMINI_API_KEY")) {
    return [];
  }

  const asked = getAgentDefinition(adminMessage.addressedAgentId);
  const generateContent = createGeminiClient(getGeminiApiKey());
  const replyBody = parseChatReply(
    await generateChatJson(
      {
        systemInstruction: buildChatSystemPrompt({
          agentName: asked.displayName,
          strategyName: asked.strategyName,
          skill: loadAgentSkill(asked.skillPath),
        }),
        userPrompt: buildChatAdminReplyUserPrompt({
          adminMessage: adminMessage.body,
          addressedToYou: true,
        }),
        schema: ARENA_CHAT_REPLY_SCHEMA,
      },
      { generateContent }
    )
  );

  if (!replyBody) {
    return [];
  }

  const createdAt = new Date(Date.parse(adminMessage.createdAt) + 1000).toISOString();

  return [
    {
      id: chatMessageId(asked.id, adminMessage.id, "reply"),
      agentId: asked.id,
      agentName: asked.displayName,
      cycleId: null,
      kind: "reply",
      addressedAgentId: ARENA_ADMIN_AGENT_ID,
      addressedAgentName: ARENA_ADMIN_DISPLAY_NAME,
      body: replyBody,
      createdAt,
    },
  ];
}

export async function postArenaAdminMessage(input: {
  body: string;
  addressedAgentId?: string | null;
}): Promise<ArenaChatMessage[]> {
  if (!isArenaAdminChatEnabled()) {
    throw new ArenaAdminChatError("Admin chat is disabled in this environment", "DISABLED");
  }

  const body = input.body.trim();

  if (!body) {
    throw new ArenaAdminChatError("Message cannot be empty", "EMPTY");
  }

  if (body.length > ARENA_ADMIN_MESSAGE_MAX_LENGTH) {
    throw new ArenaAdminChatError(`Message must be at most ${ARENA_ADMIN_MESSAGE_MAX_LENGTH} characters`, "TOO_LONG");
  }

  const addressedAgentId = normalizeAddressedAgentId(input.addressedAgentId);
  const createdAt = new Date().toISOString();
  const messageId = `chat-admin-${randomUUID()}`;

  const adminMessage: ArenaChatMessage = {
    id: messageId,
    agentId: ARENA_ADMIN_AGENT_ID,
    agentName: ARENA_ADMIN_DISPLAY_NAME,
    cycleId: null,
    kind: "admin",
    addressedAgentId,
    addressedAgentName: addressedAgentId ? getAgentDefinition(addressedAgentId).displayName : null,
    body,
    createdAt,
  };

  const replies = await maybeReplyToAdminMessage(adminMessage);
  const posted = [adminMessage, ...replies];

  await insertArenaChatMessages(posted);
  return posted;
}

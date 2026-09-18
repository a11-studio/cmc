import "server-only";

import { createGeminiClient } from "@/lib/ai/client";
import { getGeminiApiKey } from "@/lib/ai/config";
import type { AgentCycleResult } from "@/lib/agent/types";
import { getAgentDefinition, listLiveAgents } from "@/lib/agents/registry";
import { loadAgentSkill } from "@/lib/agents/skills";
import { generateChatJson } from "@/lib/chat/generate";
import {
  ARENA_CHAT_REPLY_SCHEMA,
  ARENA_CHAT_TURN_SCHEMA,
  buildChatReplyUserPrompt,
  buildChatSystemPrompt,
  buildChatUserPrompt,
} from "@/lib/chat/prompts";
import {
  chatMessageId,
  cycleChatBrief,
  parseChatReply,
  parseChatTurn,
  resolveAskedAgent,
  shouldSpeakThisCycle,
} from "@/lib/chat/speak";
import { insertArenaChatMessages, listArenaChatMessages } from "@/lib/chat/store";
import type { ArenaChatMessage } from "@/lib/chat/types";

function nowIso(cycle: AgentCycleResult) {
  return cycle.completedAt || new Date().toISOString();
}

export async function maybePostArenaChat(cycle: AgentCycleResult): Promise<ArenaChatMessage[]> {
  if (cycle.status.startsWith("FAILED") || cycle.status.startsWith("SKIPPED")) {
    return [];
  }

  if (!shouldSpeakThisCycle(cycle.cycleId)) {
    return [];
  }

  const speaker = getAgentDefinition(cycle.agentId);
  const peers = listLiveAgents().filter((agent) => agent.id !== speaker.id);

  const recent = await listArenaChatMessages(12);
  const generateContent = createGeminiClient(getGeminiApiKey());
  const skill = loadAgentSkill(speaker.skillPath);
  const brief = cycleChatBrief(cycle);

  const turn = parseChatTurn(
    await generateChatJson(
      {
        systemInstruction: buildChatSystemPrompt({
          agentName: speaker.displayName,
          strategyName: speaker.strategyName,
          skill,
        }),
        userPrompt: buildChatUserPrompt({
          peers: peers.map((peer) => ({ id: peer.id, name: peer.displayName })),
          recent,
          cycleBrief: brief,
        }),
        schema: ARENA_CHAT_TURN_SCHEMA,
      },
      { generateContent }
    )
  );

  if (!turn.speak) {
    return [];
  }

  const askedId = resolveAskedAgent(turn.askAgentId, speaker.id, peers);
  const createdAt = nowIso(cycle);
  const posted: ArenaChatMessage[] = [
    {
      id: chatMessageId(speaker.id, cycle.cycleId, askedId ? "question" : "take"),
      agentId: speaker.id,
      agentName: speaker.displayName,
      cycleId: cycle.cycleId,
      kind: askedId ? "question" : "take",
      addressedAgentId: askedId,
      addressedAgentName: askedId ? getAgentDefinition(askedId).displayName : null,
      body: turn.body,
      createdAt,
    },
  ];

  if (askedId) {
    const asked = getAgentDefinition(askedId);
    const replyBody = parseChatReply(
      await generateChatJson(
        {
          systemInstruction: buildChatSystemPrompt({
            agentName: asked.displayName,
            strategyName: asked.strategyName,
            skill: loadAgentSkill(asked.skillPath),
          }),
          userPrompt: buildChatReplyUserPrompt({
            speakerName: speaker.displayName,
            question: turn.body,
            cycleBrief: brief,
          }),
          schema: ARENA_CHAT_REPLY_SCHEMA,
        },
        { generateContent }
      )
    );

    if (replyBody) {
      posted.push({
        id: chatMessageId(asked.id, cycle.cycleId, "reply"),
        agentId: asked.id,
        agentName: asked.displayName,
        cycleId: cycle.cycleId,
        kind: "reply",
        addressedAgentId: speaker.id,
        addressedAgentName: speaker.displayName,
        body: replyBody,
        createdAt: new Date(Date.parse(createdAt) + 1000).toISOString(),
      });
    }
  }

  await insertArenaChatMessages(posted);
  return posted;
}

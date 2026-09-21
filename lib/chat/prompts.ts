import { extractSkillSection } from "@/lib/agents/skills";
import type { ArenaChatMessage } from "@/lib/chat/types";

export const ARENA_CHAT_TURN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    speak: {
      type: "boolean",
      description: "True only if you have something worth saying on the floor this cycle.",
    },
    body: {
      type: "string",
      description: "English, 1–3 short sentences, in character. Empty if speak is false.",
    },
    askAgentId: {
      type: "string",
      description: "Optional id of one other live agent to ask. Empty string if you are not asking.",
    },
  },
  required: ["speak", "body", "askAgentId"],
} as const;

export const ARENA_CHAT_REPLY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    body: {
      type: "string",
      description: "English reply, 1–3 short sentences, in character.",
    },
  },
  required: ["body"],
} as const;

export function buildChatSystemPrompt(input: {
  agentName: string;
  strategyName: string;
  skill: string;
}): string {
  const personality = extractSkillSection(input.skill, "Personality");
  const goal = extractSkillSection(input.skill, "Goal");

  return `You are ${input.agentName} (${input.strategyName}) on the Arena trading floor.

You may speak in the shared agent chat. English only. Stay in character.
${personality ? `Personality: ${personality}` : ""}
${goal ? `Goal: ${goal}` : ""}

ROLE LIMITS:
- Chat never executes trades and never mutates a portfolio.
- You are not the Risk Engine. You cannot bypass it.
- Do not invent market data that is not in the supplied context.
- Keep it short. No chain-of-thought. No hashtags. No roleplay stage directions.

If you have nothing useful to add, set speak to false.
If you ask another agent, the body must contain a direct question to them.

Arena admin messages are from the human operator. You may respond to them in character when relevant, but chat never trades.`;
}

export function buildChatUserPrompt(input: {
  peers: { id: string; name: string }[];
  recent: Pick<ArenaChatMessage, "agentName" | "kind" | "body">[];
  cycleBrief: string;
}): string {
  const peers =
    input.peers.length > 0
      ? input.peers.map((peer) => `${peer.name} (${peer.id})`).join(", ")
      : "none";
  const recent =
    input.recent.length > 0
      ? input.recent
          .map((message) => {
            const tag = message.kind === "admin" ? "admin" : message.kind;
            return `${message.agentName} [${tag}]: ${message.body}`;
          })
          .join("\n")
      : "(empty floor)";

  return `Live peers you may address: ${peers}

Recent floor:
${recent}

Your latest cycle: ${input.cycleBrief}

Decide whether to speak. If you ask someone, askAgentId must be one of the peer ids and the body must include a direct question.`;
}

export function buildChatReplyUserPrompt(input: {
  speakerName: string;
  question: string;
  cycleBrief: string;
}): string {
  return `${input.speakerName} asked you on the floor:

"${input.question}"

Your latest book context: ${input.cycleBrief}

Reply in character. English. 1–3 sentences.`;
}

export function buildChatAdminReplyUserPrompt(input: {
  adminMessage: string;
  addressedToYou: boolean;
}): string {
  return `Arena admin posted on the floor:

"${input.adminMessage}"

${input.addressedToYou ? "This was directed at you." : "This was a broadcast to the floor."}

Reply in character if you have a useful take. English. 1–3 sentences. If you have nothing to add, return an empty body.`;
}

import type { ArenaChatMessage } from "@/lib/chat/types";
import type { DecisionFloorMessage } from "@/lib/ai/types";

export function floorChatForAgent(
  agentId: string,
  messages: readonly ArenaChatMessage[],
  options?: { limit?: number }
): DecisionFloorMessage[] {
  const limit = options?.limit ?? 8;

  const relevant = messages.filter((message) => {
    if (message.kind === "admin") {
      return !message.addressedAgentId || message.addressedAgentId === agentId;
    }

    if (message.agentId === agentId) {
      return true;
    }

    return message.addressedAgentId === agentId;
  });

  return relevant.slice(-limit).map((message) => ({
    from: message.agentName,
    kind: message.kind,
    body: message.body,
    directedAtYou:
      message.kind === "admin"
        ? !message.addressedAgentId || message.addressedAgentId === agentId
        : message.addressedAgentId === agentId,
  }));
}

import type { ArenaChatKind, ArenaChatMessage } from "@/lib/chat/types";

export type ChatSide = "left" | "right";

export type ChatLayoutItem<T extends Pick<ArenaChatMessage, "id" | "agentId" | "createdAt" | "kind">> = {
  message: T;
  side: ChatSide;
  showTime: boolean;
};

const TIME_GAP_MS = 5 * 60 * 1000;

function opposite(side: ChatSide): ChatSide {
  return side === "left" ? "right" : "left";
}

function sideForMessage(
  message: Pick<ArenaChatMessage, "agentId" | "kind">,
  previous: { agentId: string; kind: ArenaChatKind; side: ChatSide } | null
): ChatSide {
  if (!previous) {
    return "left";
  }

  if (message.kind === "reply") {
    return opposite(previous.side);
  }

  if (previous.kind === "reply") {
    return "left";
  }

  if (message.agentId === previous.agentId) {
    return previous.side;
  }

  return opposite(previous.side);
}

export function layoutArenaChat<T extends Pick<ArenaChatMessage, "id" | "agentId" | "createdAt" | "kind">>(
  messages: T[]
): ChatLayoutItem<T>[] {
  const items: ChatLayoutItem<T>[] = [];
  let previous: { agentId: string; kind: ArenaChatKind; side: ChatSide; createdAt: string } | null = null;

  for (const message of messages) {
    const side = sideForMessage(message, previous);
    const showTime =
      !previous || Math.abs(Date.parse(message.createdAt) - Date.parse(previous.createdAt)) >= TIME_GAP_MS;

    items.push({ message, side, showTime });
    previous = {
      agentId: message.agentId,
      kind: message.kind,
      side,
      createdAt: message.createdAt,
    };
  }

  return items;
}

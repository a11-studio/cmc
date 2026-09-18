import type { AgentCycleResult } from "@/lib/agent/types";
import type { ArenaChatKind, ArenaChatTurn } from "@/lib/chat/types";
import type { ArenaAgentDefinition } from "@/lib/agents/types";

const KINDS: readonly ArenaChatKind[] = ["take", "question", "reply"];

export function shouldSpeakThisCycle(cycleId: string): boolean {
  let hash = 0;

  for (const char of cycleId) {
    hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  }

  return hash % 3 === 0;
}

export function chatMessageId(agentId: string, cycleId: string, kind: ArenaChatKind): string {
  return `chat-${agentId}-${cycleId}-${kind}`;
}

export function isArenaChatKind(value: string): value is ArenaChatKind {
  return KINDS.includes(value as ArenaChatKind);
}

export function cycleChatBrief(cycle: AgentCycleResult): string {
  const decision = cycle.decision;
  const risk = cycle.riskResult;
  const fill = cycle.execution?.ok && cycle.execution.trade
    ? `${cycle.execution.action} ${cycle.execution.trade.symbol}`
    : null;

  if (!decision) {
    return `${cycle.status} with no TradeDecision.`;
  }

  return [
    `${decision.action} ${decision.symbol} ${decision.allocationPercent}%`,
    risk ? `risk ${risk.verdict}` : null,
    fill,
    cycle.status === "BLOCKED" ? cycle.riskResult?.reason ?? "blocked" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function parseChatTurn(payload: unknown): ArenaChatTurn {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { speak: false, body: "", askAgentId: null };
  }

  const record = payload as Record<string, unknown>;
  const speak = record.speak === true;
  const body = typeof record.body === "string" ? record.body.trim() : "";
  const ask =
    typeof record.askAgentId === "string" && record.askAgentId.trim() ? record.askAgentId.trim() : null;

  return {
    speak: speak && body.length > 0,
    body: body.slice(0, 480),
    askAgentId: ask,
  };
}

export function parseChatReply(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }

  const body = (payload as Record<string, unknown>).body;
  return typeof body === "string" ? body.trim().slice(0, 480) : "";
}

export function resolveAskedAgent(
  askAgentId: string | null,
  speakerId: string,
  livePeers: readonly Pick<ArenaAgentDefinition, "id">[]
): string | null {
  if (!askAgentId || askAgentId === speakerId) {
    return null;
  }

  return livePeers.some((peer) => peer.id === askAgentId) ? askAgentId : null;
}

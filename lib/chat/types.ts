export type ArenaChatKind = "take" | "question" | "reply";

export type ArenaChatMessage = {
  id: string;
  agentId: string;
  agentName: string;
  cycleId: string | null;
  kind: ArenaChatKind;
  addressedAgentId: string | null;
  addressedAgentName: string | null;
  body: string;
  createdAt: string;
};

export type ArenaChatTurn = {
  speak: boolean;
  body: string;
  askAgentId: string | null;
};

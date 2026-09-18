import type { SupportedSymbol } from "@/lib/market/types";
import type { AgentMark } from "@/types/arena";

export type AgentRiskProfile = "conservative" | "medium" | "aggressive";
export type AgentRosterStatus = "LIVE" | "READY" | "SIMULATION";

export type ArenaAgentDefinition = {
  id: string;
  displayName: string;
  strategyName: string;
  description: string;
  skillPath: string;
  mark: AgentMark;
  riskProfile: AgentRiskProfile;
  preferredAssets: readonly SupportedSymbol[];
  timeHorizon: string;
  status: AgentRosterStatus;
  initialCapital: number;
};

export class UnknownAgentError extends Error {
  readonly code = "UNKNOWN_AGENT";

  constructor(agentId: string) {
    super(`Unknown agent: ${agentId}`);
    this.name = "UnknownAgentError";
  }
}

export function isUnknownAgentError(error: unknown): error is UnknownAgentError {
  return error instanceof UnknownAgentError;
}

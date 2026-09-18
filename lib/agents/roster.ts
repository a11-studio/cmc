import { listArenaAgents } from "@/lib/agents/registry";
import type { LeaderboardAgent } from "@/types/arena";

export function buildAgentRoster(liveAgent: LeaderboardAgent): LeaderboardAgent[] {
  return listArenaAgents().map((definition) => {
    if (definition.status === "LIVE" && definition.id === liveAgent.id) {
      return {
        ...liveAgent,
        name: definition.displayName,
        strategy: definition.strategyName,
        description: definition.description,
        mark: definition.mark,
        runtimeStatus: "LIVE",
        dataSource: "live",
      };
    }

    return {
      id: definition.id,
      name: definition.displayName,
      strategy: definition.strategyName,
      description: definition.description,
      status: "ACTIVE",
      mark: definition.mark,
      equity: definition.initialCapital,
      returnPercent: 0,
      drawdownPercent: 0,
      winRatePercent: 0,
      trades: 0,
      initialCapital: definition.initialCapital,
      dataSource: "roster",
      runtimeStatus: definition.status,
    };
  });
}

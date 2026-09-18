import { listArenaAgents } from "@/lib/agents/registry";
import type { LeaderboardAgent } from "@/types/arena";

export function buildAgentRoster(liveAgents: LeaderboardAgent | readonly LeaderboardAgent[]): LeaderboardAgent[] {
  const liveById = new Map(
    (Array.isArray(liveAgents) ? liveAgents : [liveAgents]).map((agent) => [agent.id, agent])
  );

  return listArenaAgents().map((definition) => {
    const live = liveById.get(definition.id);

    if (definition.status === "LIVE" && live) {
      return {
        ...live,
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
      dataSource: definition.status === "LIVE" ? "live" : "roster",
      runtimeStatus: definition.status,
    };
  });
}

import { cycleToActivityEvents, serializeCycle, type SerializedCycle } from "@/lib/agent/view";
import type { AgentCycleResult } from "@/lib/agent/types";
import type { ActivityEvent } from "@/types/arena";

export const ACTIVITY_FEED_LIMIT = 24;

export type ActivityFeedSlice = {
  cycles: SerializedCycle[];
  events: ActivityEvent[];
};

export type ActivityFeedPayload = {
  latest: ActivityFeedSlice;
  older: ActivityFeedSlice;
};

export function cycleSlotFromId(cycleId: string): string | null {
  const match = cycleId.match(/-(\d+)$/);
  return match?.[1] ?? null;
}

export function splitCyclesByLatestBatch(cycles: readonly AgentCycleResult[]): {
  latestBatch: AgentCycleResult[];
  older: AgentCycleResult[];
} {
  const sorted = [...cycles].sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt));

  if (sorted.length === 0) {
    return { latestBatch: [], older: [] };
  }

  const slot = cycleSlotFromId(sorted[0].cycleId);

  if (!slot) {
    return { latestBatch: sorted.slice(0, 1), older: sorted.slice(1) };
  }

  const latestBatch = sorted.filter((cycle) => cycleSlotFromId(cycle.cycleId) === slot);
  const older = sorted.filter((cycle) => cycleSlotFromId(cycle.cycleId) !== slot);

  return { latestBatch, older };
}

function buildSlice(cycles: readonly AgentCycleResult[]): ActivityFeedSlice {
  const ordered = [...cycles].sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt));
  const serialized = ordered.map(serializeCycle);
  const events = [...ordered.flatMap(cycleToActivityEvents)].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)
  );

  return { cycles: serialized, events };
}

export function buildActivityFeedFromCycles(cycles: readonly AgentCycleResult[]): ActivityFeedPayload {
  const limited = [...cycles]
    .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))
    .slice(0, ACTIVITY_FEED_LIMIT);

  const { latestBatch, older } = splitCyclesByLatestBatch(limited);

  return {
    latest: buildSlice(latestBatch),
    older: buildSlice(older),
  };
}

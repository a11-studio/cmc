import { AGENT_CYCLE_INTERVAL_MS } from "@/lib/agent/constants";

export const MIN_VISIBLE_FILLS = 3;

export function latestFillBatch<T extends { createdAt: string }>(
  fills: readonly T[],
  minVisible = MIN_VISIBLE_FILLS
): { latest: T[]; older: T[] } {
  const sorted = [...fills].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  if (sorted.length === 0) {
    return { latest: [], older: [] };
  }

  const newest = Date.parse(sorted[0].createdAt);
  const latest: T[] = [];
  const older: T[] = [];

  for (const fill of sorted) {
    const time = Date.parse(fill.createdAt);

    if (Number.isFinite(time) && newest - time <= AGENT_CYCLE_INTERVAL_MS) {
      latest.push(fill);
    } else {
      older.push(fill);
    }
  }

  if (latest.length < minVisible && older.length > 0) {
    const needed = minVisible - latest.length;
    latest.push(...older.slice(0, needed));
    older.splice(0, needed);
  }

  return { latest, older };
}

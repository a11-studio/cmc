/** Keep the newest `limit` rows in ascending time order (for charts). */
export function latestEquityHistoryRows<T extends { timestamp: string }>(
  rows: readonly T[],
  limit: number
): T[] {
  return [...rows]
    .filter((row) => Number.isFinite(Date.parse(row.timestamp)))
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, limit)
    .reverse();
}

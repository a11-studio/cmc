/** How long a CLAIMED row counts as an active cycle (matches reclaim in durable.ts). */
export const STALE_CYCLE_CLAIM_MS = 10 * 60 * 1000;

export function isFreshCycleClaim(
  startedAt: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!startedAt) {
    return false;
  }

  const started = Date.parse(startedAt);

  if (!Number.isFinite(started)) {
    return false;
  }

  return nowMs - started < STALE_CYCLE_CLAIM_MS;
}

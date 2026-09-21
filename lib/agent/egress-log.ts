import "server-only";

/** Set ARENA_EGRESS_LOG=1 to log hydrate/control sizes (no secrets or full payloads). */
const ENABLED = process.env.ARENA_EGRESS_LOG === "1";

export function logArenaEgress(
  event: string,
  details: Record<string, string | number | boolean | null | undefined>
): void {
  if (!ENABLED) {
    return;
  }

  console.info("[arena-egress]", event, details);
}

export function approximateJsonBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
}

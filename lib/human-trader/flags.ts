export function isArenaHumanTraderEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return env.ARENA_HUMAN_TRADER === "true";
}

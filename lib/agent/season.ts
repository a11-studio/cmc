/**
 * Arena season. Every agent restarts from its initial capital, flat, at this instant.
 *
 * Nothing is deleted: trades, decisions, cycles and snapshots from earlier seasons
 * stay in Supabase. Account hydration, equity charts, the leaderboard, daily
 * winners and the rule review only read rows from this instant on, and account
 * payloads written before it (cash, peak equity, day-start equity) are ignored.
 *
 * Season 2 starts when the rule cores, trend filter and protective exits went live,
 * so their record is not mixed with the model-only era and its accounting bugs.
 */
export const ARENA_SEASON = 2;
export const ARENA_SEASON_START = "2026-11-06T09:44:00.000Z";

export function isInCurrentSeason(iso: string | null | undefined): boolean {
  if (!iso) {
    return false;
  }

  const at = Date.parse(iso);
  return Number.isFinite(at) && at >= Date.parse(ARENA_SEASON_START);
}

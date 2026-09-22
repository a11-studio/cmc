import type { EquityCurvePoint } from "@/types/arena";

/**
 * Richard Donchian positions were wiped in DB during cycles 497233–497236 (Sep 2026).
 * portfolio_snapshots from that window are kept for audit but must not shape UI charts.
 * Cycle 497236 was BLOCKED with cash-only equity while positions were still empty.
 * Display history resumes at 497237 — first valid post-repair COMPLETED portfolio snapshot.
 */
export const RICHARD_DONCHIAN_EQUITY_DISPLAY_RECOVERY = {
  agentId: "richard-donchian",
  firstCorruptedCycleNumber: 497233,
  firstDisplayedPostRepairCycleId: "richard-donchian-497237",
  firstDisplayedPostRepairCycleNumber: 497237,
  firstDisplayedPostRepairTimestamp: "2026-09-22T05:00:11.548+00:00",
  firstDisplayedPostRepairEquity: 10719.8812687263,
} as const;

const DONCHIAN_CYCLE_PREFIX = `${RICHARD_DONCHIAN_EQUITY_DISPLAY_RECOVERY.agentId}-`;

export function parseRichardDonchianCycleNumber(cycleId: string | undefined): number | null {
  if (!cycleId?.startsWith(DONCHIAN_CYCLE_PREFIX)) {
    return null;
  }

  const parsed = Number.parseInt(cycleId.slice(DONCHIAN_CYCLE_PREFIX.length), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isRichardDonchianCorruptedEquitySnapshot(cycleId: string | undefined): boolean {
  const cycleNumber = parseRichardDonchianCycleNumber(cycleId);

  if (cycleNumber == null) {
    return false;
  }

  const { firstCorruptedCycleNumber, firstDisplayedPostRepairCycleNumber } =
    RICHARD_DONCHIAN_EQUITY_DISPLAY_RECOVERY;

  return (
    cycleNumber >= firstCorruptedCycleNumber && cycleNumber < firstDisplayedPostRepairCycleNumber
  );
}

/** Read-model filter for chart equity history (no database writes). */
export function filterAgentPortfolioEquityHistoryForDisplay(
  agentId: string,
  points: readonly EquityCurvePoint[],
): EquityCurvePoint[] {
  if (agentId !== RICHARD_DONCHIAN_EQUITY_DISPLAY_RECOVERY.agentId) {
    return [...points];
  }

  return points.filter((point) => !isRichardDonchianCorruptedEquitySnapshot(point.label));
}

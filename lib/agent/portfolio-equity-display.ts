import type { EquityCurvePoint } from "@/types/arena";

/**
 * Richard Donchian positions were wiped in DB during cycles 497233–497235 (Sep 2026).
 * portfolio_snapshots from that window are kept for audit but must not shape UI charts.
 * Display history resumes at cycle 497236 (manual DB recovery + safeguard deploy).
 */
export const RICHARD_DONCHIAN_EQUITY_DISPLAY_RECOVERY = {
  agentId: "richard-donchian",
  firstCorruptedCycleNumber: 497233,
  recoveryCycleId: "richard-donchian-497236",
  recoveryCycleNumber: 497236,
  recoveryTimestamp: "2026-09-22T03:59:00+00:00",
  recoveryEquity: 10757.575513025735,
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

  const { firstCorruptedCycleNumber, recoveryCycleNumber } = RICHARD_DONCHIAN_EQUITY_DISPLAY_RECOVERY;

  return cycleNumber >= firstCorruptedCycleNumber && cycleNumber < recoveryCycleNumber;
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

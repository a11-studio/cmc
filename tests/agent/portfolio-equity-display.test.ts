import { describe, expect, it } from "vitest";
import {
  RICHARD_DONCHIAN_EQUITY_DISPLAY_RECOVERY,
  filterAgentPortfolioEquityHistoryForDisplay,
  isRichardDonchianCorruptedEquitySnapshot,
} from "@/lib/agent/portfolio-equity-display";
import type { EquityCurvePoint } from "@/types/arena";

function point(cycleId: string, equity: number, at: string): EquityCurvePoint {
  return { equity, at, label: cycleId };
}

describe("filterAgentPortfolioEquityHistoryForDisplay", () => {
  const recovery = RICHARD_DONCHIAN_EQUITY_DISPLAY_RECOVERY;

  const donchianSeries: EquityCurvePoint[] = [
    point("richard-donchian-497231", 10_900, "2026-09-22T01:59:00.000Z"),
    point("richard-donchian-497232", 10_918.54, "2026-09-22T02:59:00.000Z"),
    point("richard-donchian-497233", 0.46, "2026-09-22T03:00:00.000Z"),
    point("richard-donchian-497234", 0.46, "2026-09-22T03:30:00.000Z"),
    point("richard-donchian-497235", 0.46, "2026-09-22T03:45:00.000Z"),
    point("richard-donchian-497236", 0.46, "2026-09-22T04:00:45.000Z"),
    point(
      recovery.firstDisplayedPostRepairCycleId,
      recovery.firstDisplayedPostRepairEquity,
      recovery.firstDisplayedPostRepairTimestamp
    ),
    point("richard-donchian-497238", 10_750, "2026-09-22T06:00:00.000Z"),
  ];

  it("keeps pre-corruption snapshot 497232", () => {
    const filtered = filterAgentPortfolioEquityHistoryForDisplay(recovery.agentId, donchianSeries);
    expect(filtered.some((row) => row.label === "richard-donchian-497232")).toBe(true);
  });

  it("excludes corrupted Donchian snapshots 497233 through 497236", () => {
    const filtered = filterAgentPortfolioEquityHistoryForDisplay(recovery.agentId, donchianSeries);

    expect(filtered.map((row) => row.label)).toEqual([
      "richard-donchian-497231",
      "richard-donchian-497232",
      recovery.firstDisplayedPostRepairCycleId,
      "richard-donchian-497238",
    ]);
  });

  it("includes the first valid post-repair snapshot at cycle 497237", () => {
    const filtered = filterAgentPortfolioEquityHistoryForDisplay(recovery.agentId, donchianSeries);
    const recoveryPoint = filtered.find((row) => row.label === recovery.firstDisplayedPostRepairCycleId);

    expect(recoveryPoint).toEqual({
      equity: recovery.firstDisplayedPostRepairEquity,
      at: recovery.firstDisplayedPostRepairTimestamp,
      label: recovery.firstDisplayedPostRepairCycleId,
    });
  });

  it("includes subsequent valid snapshots after 497237", () => {
    const filtered = filterAgentPortfolioEquityHistoryForDisplay(recovery.agentId, donchianSeries);
    expect(filtered.at(-1)?.label).toBe("richard-donchian-497238");
  });

  it("does not mutate other agents", () => {
    const otherAgentSeries: EquityCurvePoint[] = [
      point("momentum-alpha-497233", 50, "2026-09-22T03:00:00.000Z"),
      point("momentum-alpha-497236", 10_100, "2026-09-22T03:59:00.000Z"),
    ];

    expect(filterAgentPortfolioEquityHistoryForDisplay("momentum-alpha", otherAgentSeries)).toEqual(
      otherAgentSeries
    );
  });

  it("marks only the known corruption cycle interval (display-only, no DB)", () => {
    expect(isRichardDonchianCorruptedEquitySnapshot("richard-donchian-497232")).toBe(false);
    expect(isRichardDonchianCorruptedEquitySnapshot("richard-donchian-497233")).toBe(true);
    expect(isRichardDonchianCorruptedEquitySnapshot("richard-donchian-497235")).toBe(true);
    expect(isRichardDonchianCorruptedEquitySnapshot("richard-donchian-497236")).toBe(true);
    expect(isRichardDonchianCorruptedEquitySnapshot(recovery.firstDisplayedPostRepairCycleId)).toBe(
      false
    );
  });
});

import Link from "next/link";
import { DashboardCard, DashboardCardSubtitle, DashboardCardTitle } from "@/components/arena/dashboard-card";
import { ConfidenceGauge } from "@/components/charts/confidence-gauge";
import { formatRelativeTime } from "@/lib/format";
import { latestDecisionBatch } from "@/lib/arena/decision-batch";
import { cn } from "@/lib/utils";
import type { DecisionRecord, TradeAction } from "@/types/arena";

const ACTION_COLOR: Record<TradeAction, string> = {
  BUY: "text-[#8ADF7B]",
  SELL: "text-[#F87171]",
  SHORT: "text-[#F87171]",
  HOLD: "text-white/55",
};

export function LatestDecisionCard({ decisions }: { decisions: DecisionRecord[] }) {
  const batch = latestDecisionBatch(decisions);

  return (
    <DashboardCard>
      <div className="flex items-start justify-between gap-3">
        <div>
          <DashboardCardTitle>Latest round</DashboardCardTitle>
          <DashboardCardSubtitle>
            {batch.decisions.length === 0
              ? "Waiting for the next cycle"
              : `Average confidence across ${batch.decisions.length} agents`}
          </DashboardCardSubtitle>
        </div>
        {batch.latestAt ? (
          <Link href="/activity" className="shrink-0 pt-1 text-[12px] text-white/35 hover:text-white/70">
            {formatRelativeTime(batch.latestAt)}
          </Link>
        ) : null}
      </div>

      {batch.decisions.length === 0 ? (
        <p className="mt-10 text-sm text-white/40">
          No live decisions yet. The round appears once agents complete a cycle.
        </p>
      ) : (
        <>
          <div className="mx-auto mt-4 flex w-full max-w-[240px] flex-1 items-center">
            <ConfidenceGauge value={batch.averageConfidence} label="avg confidence" />
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-white/8 pt-5 text-[13px]">
            {batch.actionCounts.map((entry) => (
              <span key={entry.action} className="flex items-center gap-1.5">
                <span className={cn("font-medium", ACTION_COLOR[entry.action])}>{entry.action}</span>
                <span className="tabular-nums text-white/45">{entry.count}</span>
              </span>
            ))}
            {batch.blockedCount > 0 ? (
              <span className="text-[#F87171]">{batch.blockedCount} blocked by risk</span>
            ) : null}
          </div>
        </>
      )}
    </DashboardCard>
  );
}

import type { ReactNode } from "react";
import { DashboardCard, DashboardCardSubtitle, DashboardCardTitle } from "@/components/arena/dashboard-card";
import { EquitySparkline } from "@/components/charts/equity-sparkline";
import { SignedPercent, SignedUsd } from "@/components/shared/signed-value";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EquityCurvePoint } from "@/types/arena";

export function ArenaPerformanceCard({
  agentCount,
  pnl,
  returnPercent,
  startingCapital,
  currentEquity,
  series,
  className,
  action,
}: {
  agentCount: number;
  pnl: number;
  returnPercent: number;
  startingCapital: number;
  currentEquity: number;
  series: EquityCurvePoint[];
  className?: string;
  action?: ReactNode;
}) {
  const down = pnl < 0 || returnPercent < 0;

  return (
    <DashboardCard tone={down ? "performance-down" : "performance"} className={className}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <DashboardCardTitle>Arena performance</DashboardCardTitle>
          <DashboardCardSubtitle>
            {agentCount === 1
              ? "Live paper return from Elon Musk"
              : `Combined return across ${agentCount} AI agents`}
          </DashboardCardSubtitle>
        </div>
        {action}
      </div>

      <p className="mt-6">
        <SignedUsd
          value={pnl}
          className={cn(
            "text-[40px] leading-none font-medium tracking-tight",
            pnl >= 0 ? "text-[#8ADF7B]" : "text-[#F87171]"
          )}
        />
      </p>

      <div className="mt-6 h-[165px] shrink-0">
        {series.length >= 2 ? (
          <EquitySparkline points={series} variant="hero" className="h-full" />
        ) : (
          <div className="flex h-full items-end">
            <div className={cn("h-px w-full", down ? "bg-[#F87171]/25" : "bg-[#8ADF7B]/25")} />
          </div>
        )}
      </div>

      <dl className="mt-auto grid grid-cols-3 gap-4 border-t border-white/8 pt-5">
        <div>
          <dt className="text-[12px] text-white/45">Starting capital</dt>
          <dd className="mt-1 text-[15px] font-medium tabular-nums">{formatUsd(startingCapital)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-white/45">Current equity</dt>
          <dd className="mt-1 text-[15px] font-medium tabular-nums">{formatUsd(currentEquity)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-white/45">Return</dt>
          <dd className="mt-1 text-[15px] font-medium">
            <SignedPercent
              value={returnPercent}
              digits={2}
              className={returnPercent < 0 ? "text-[#F87171]" : "text-[#8ADF7B]"}
            />
          </dd>
        </div>
      </dl>
    </DashboardCard>
  );
}

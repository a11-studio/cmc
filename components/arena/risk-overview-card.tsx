import { DashboardCard, DashboardCardTitle } from "@/components/arena/dashboard-card";
import { formatPercent, formatUsd } from "@/lib/format";
import { DEFAULT_RISK_CONSTRAINTS } from "@/lib/risk/constraints";
import type { MomentumAlphaView } from "@/lib/agent/view";

export function RiskOverviewCard({ live }: { live: MomentumAlphaView }) {
  const equity = live.agent.equity;
  const capitalDeployed = live.positions.reduce((sum, position) => sum + Math.abs(position.marketValue), 0);
  const deployablePercent = 100 - DEFAULT_RISK_CONSTRAINTS.minCashPercent;
  const deployedPercent = equity > 0 ? (capitalDeployed / equity) * 100 : 0;
  const riskCapacityUsed = deployablePercent > 0 ? (deployedPercent / deployablePercent) * 100 : 0;
  const largestPosition = live.positions.reduce(
    (max, position) => Math.max(max, Math.abs(position.allocationPercent)),
    0
  );
  const dailyLossPercent =
    live.dayStartEquity > 0 ? Math.max(0, ((live.dayStartEquity - equity) / live.dayStartEquity) * 100) : 0;

  return (
    <DashboardCard>
      <DashboardCardTitle>Risk overview</DashboardCardTitle>
      <p className="mt-1 text-[14px] leading-5 font-medium text-white/50">
        Deterministic limits on Elon Musk
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6">
        <div>
          <dt className="text-[12px] text-white/45">Capital deployed</dt>
          <dd className="mt-1 text-[22px] font-medium tabular-nums">{formatUsd(capitalDeployed)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-white/45">Risk capacity used</dt>
          <dd className="mt-1 text-[22px] font-medium tabular-nums">{formatPercent(riskCapacityUsed, false, 0)}</dd>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-[#00D4CF]"
              style={{ width: `${Math.min(100, Math.max(0, riskCapacityUsed))}%` }}
            />
          </div>
        </div>
        <div>
          <dt className="text-[12px] text-white/45">Largest position</dt>
          <dd className="mt-1 text-[18px] font-medium tabular-nums">{formatPercent(largestPosition, false, 1)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-white/45">Daily loss</dt>
          <dd className="mt-1 text-[18px] font-medium tabular-nums">
            <span className={dailyLossPercent > 0 ? "text-[#F87171]" : "text-white/80"}>
              {formatPercent(dailyLossPercent, false, 1)}
            </span>
            <span className="ml-2 text-[12px] font-normal text-white/35">
              max {formatPercent(DEFAULT_RISK_CONSTRAINTS.maxDailyLossPercent, false, 0)}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-[12px] text-white/45">Drawdown</dt>
          <dd className="mt-1 text-[18px] font-medium tabular-nums">
            {live.agent.drawdownPercent > 0 ? (
              <span className="text-[#F87171]">-{live.agent.drawdownPercent.toFixed(1)}%</span>
            ) : (
              <span className="text-white/40">—</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[12px] text-white/45">Max drawdown</dt>
          <dd className="mt-1 text-[18px] font-medium tabular-nums text-white/70">
            {formatPercent(DEFAULT_RISK_CONSTRAINTS.maxDrawdownPercent, false, 0)}
          </dd>
        </div>
      </dl>
    </DashboardCard>
  );
}

import Link from "next/link";
import { DashboardCard, DashboardCardTitle } from "@/components/arena/dashboard-card";
import { ConfidenceGauge } from "@/components/charts/confidence-gauge";
import { AssetIcon } from "@/components/market/asset-icon";
import { formatRelativeTime, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DecisionRecord, TradeAction } from "@/types/arena";

const ACTION_COLOR: Record<TradeAction, string> = {
  BUY: "text-[#8ADF7B]",
  SELL: "text-[#F87171]",
  SHORT: "text-[#F87171]",
  HOLD: "text-white/70",
};

function riskLabel(decision: DecisionRecord) {
  if (decision.riskVerdict === "APPROVED") {
    return "RISK APPROVED";
  }

  if (decision.riskVerdict === "CONSTRAINED") {
    return "RISK CONSTRAINED";
  }

  if (decision.riskVerdict === "BLOCKED" || decision.status === "Blocked" || decision.status === "Rejected") {
    return "RISK BLOCKED";
  }

  if (decision.status === "Failed") {
    return "FAILED";
  }

  return decision.status.replace(/_/g, " ").toUpperCase();
}

function agentLabel(name: string) {
  return name === "Momentum" || name === "Momentum Alpha" ? "Elon Musk" : name;
}

export function LatestDecisionCard({ decision }: { decision: DecisionRecord | null }) {
  return (
    <DashboardCard>
      <DashboardCardTitle>Latest decision</DashboardCardTitle>

      {decision ? (
        <div className="mt-5 flex flex-1 flex-col">
          <p className="text-[11px] font-medium tracking-[0.16em] text-white/40 uppercase">{agentLabel(decision.agentName)}</p>

          <div className="mx-auto mt-4 w-full max-w-[240px] flex-1">
            <ConfidenceGauge value={decision.confidence} className="mx-auto max-w-[240px]" />
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn("text-[13px] font-medium", ACTION_COLOR[decision.action])}>{decision.action}</span>
              <AssetIcon symbol={decision.symbol} size="sm" />
              <span className="text-[13px] font-medium">{decision.symbol}</span>
            </div>
            <p className="text-[12px] text-white/45 tabular-nums">{decision.allocationPercent.toFixed(0)}% alloc</p>
          </div>

          {decision.reasons[0] ? (
            <p className="mt-3 line-clamp-2 text-[12px] leading-4 text-white/45">{decision.reasons[0]}</p>
          ) : null}

          <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
            <div>
              <p className="text-[11px] font-medium tracking-[0.14em] text-white/40 uppercase">{riskLabel(decision)}</p>
              {decision.notional > 0 && decision.price > 0 ? (
                <p className="mt-1.5 text-[12px] text-white/55">
                  EXECUTED {formatUsd(decision.notional)} @ {formatUsd(decision.price)}
                </p>
              ) : (
                <p className="mt-1.5 text-[12px] text-white/40">{decision.riskCheck}</p>
              )}
            </div>
            <Link href={`/decisions/${decision.id}`} className="text-[12px] text-white/35 hover:text-white/70">
              {formatRelativeTime(decision.createdAt)}
            </Link>
          </div>
        </div>
      ) : (
        <p className="mt-10 text-sm text-white/40">No live decision yet. Waiting for the next cycle.</p>
      )}
    </DashboardCard>
  );
}

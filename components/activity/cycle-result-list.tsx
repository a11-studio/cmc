import Link from "next/link";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { AssetTicker } from "@/components/market/asset-icon";
import { SideBadge } from "@/components/shared/side-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { findAgentDefinition } from "@/lib/agents/registry";
import { formatChartTime, formatUsd } from "@/lib/format";
import type { SerializedCycle } from "@/lib/agent/view";
import { cn } from "@/lib/utils";
import type { TradeAction } from "@/types/arena";
import {
  activityBodyPad,
  activityFeedMinWidth,
  activityHeadPad,
  activityTableColWidths,
} from "@/components/activity/activity-feed-columns";

function cycleWhenIso(cycle: SerializedCycle): string {
  return cycle.snapshotTimestamp ?? cycle.completedAt ?? cycle.startedAt;
}

function statusPresentation(cycle: SerializedCycle): { label: string; className: string } {
  if (cycle.status.startsWith("FAILED")) {
    return {
      label: "Failed",
      className: "bg-negative-muted text-negative",
    };
  }

  if (cycle.status === "BLOCKED") {
    return {
      label: "Blocked",
      className: "bg-warning-muted text-warning",
    };
  }

  if (cycle.status === "COMPLETED" && cycle.riskVerdict === "CONSTRAINED") {
    return {
      label: "Constrained",
      className: "bg-warning-muted text-warning",
    };
  }

  if (cycle.status === "COMPLETED") {
    return {
      label: "Completed",
      className: "bg-positive-muted text-positive",
    };
  }

  return {
    label: cycle.status.replace(/_/g, " "),
    className: "bg-surface-3 text-muted-foreground",
  };
}

function executionSymbol(cycle: SerializedCycle): string | null {
  return cycle.trade?.symbol ?? cycle.decision?.symbol ?? null;
}

function executionAction(cycle: SerializedCycle): TradeAction | null {
  const raw = cycle.executionAction ?? cycle.decision?.action;

  if (raw === "BUY" || raw === "SELL" || raw === "SHORT" || raw === "HOLD") {
    return raw;
  }

  return null;
}

function ConfidenceCell({ cycle }: { cycle: SerializedCycle }) {
  if (cycle.decision) {
    return (
      <div className="relative tabular-nums">
        <p className="font-medium text-foreground">{cycle.decision.confidence}%</p>
        <p className="mt-1 text-xs text-white/45">{cycle.decision.allocationPercent}% size</p>
      </div>
    );
  }

  if (cycle.failure?.stage === "MARKET") {
    return <span className="relative text-white/50">Market unavailable</span>;
  }

  if (cycle.failure?.stage === "DECISION") {
    return <span className="relative text-white/50">Engine unavailable</span>;
  }

  return <span className="relative text-white/35">—</span>;
}

function ExecutionCell({ cycle }: { cycle: SerializedCycle }) {
  const execAction = executionAction(cycle);
  const symbol = executionSymbol(cycle);

  if (cycle.status === "BLOCKED") {
    return <span className="text-white/50">Risk blocked</span>;
  }

  if (cycle.executionOk && execAction && symbol) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <SideBadge action={execAction} />
        <AssetTicker symbol={symbol} size="sm" className="font-medium" />
        {cycle.equity != null ? (
          <span className="tabular-nums text-white/50">{formatUsd(cycle.equity)}</span>
        ) : null}
      </span>
    );
  }

  if (cycle.executionOk && execAction) {
    return (
      <span className="inline-flex items-center gap-2">
        <SideBadge action={execAction} />
        {cycle.equity != null ? (
          <span className="tabular-nums text-white/50">{formatUsd(cycle.equity)}</span>
        ) : null}
      </span>
    );
  }

  return <span className="text-white/50">{cycle.failure?.message ?? "—"}</span>;
}

function CycleResultRow({ cycle }: { cycle: SerializedCycle }) {
  const agent = findAgentDefinition(cycle.agentId);
  const status = statusPresentation(cycle);
  const when = cycleWhenIso(cycle);
  const name = agent?.displayName ?? cycle.strategy;

  return (
    <tr className="relative transition-colors hover:bg-white/[0.025]">
      <td className={cn("border-t border-white/6 align-middle", activityBodyPad)}>
        <Link
          href={`/decisions/${encodeURIComponent(cycle.cycleId)}`}
          aria-label={`${name} cycle — view decision`}
          className="absolute inset-0"
        />
        <time
          dateTime={when}
          suppressHydrationWarning
          className="relative whitespace-nowrap text-xs tabular-nums text-white/45"
        >
          {formatChartTime(when)}
        </time>
      </td>
      <td className={cn("border-t border-white/6 align-middle", activityBodyPad)}>
        <span className="relative flex max-w-full items-center gap-2.5 font-medium">
          {agent ? (
            <AgentAvatar mark={agent.mark} name={agent.displayName} size="sm" />
          ) : (
            <span className="size-8 shrink-0 rounded-full bg-surface-3" aria-hidden />
          )}
          <span className="min-w-0 leading-snug">{name}</span>
        </span>
      </td>
      <td className={cn("border-t border-white/6 align-middle", activityBodyPad)}>
        <div className="relative min-w-0">
          <ExecutionCell cycle={cycle} />
        </div>
      </td>
      <td className={cn("border-t border-white/6 align-middle", activityBodyPad)}>
        <ConfidenceCell cycle={cycle} />
      </td>
      <td className={cn("border-t border-white/6 align-middle text-right", activityBodyPad)}>
        <span
          className={cn(
            "relative inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium",
            status.className
          )}
        >
          {status.label}
        </span>
      </td>
    </tr>
  );
}

export function CycleResultList({ cycles }: { cycles: SerializedCycle[] }) {
  if (cycles.length === 0) {
    return (
      <EmptyState title="No cycles yet." description="Run a cycle or wait for the next hourly slot." />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-1">
      <div className="overflow-x-auto">
        <table
          className={cn(
            "w-full table-fixed border-separate border-spacing-0 text-left text-sm",
            activityFeedMinWidth
          )}
        >
          <colgroup>
            <col style={{ width: activityTableColWidths.time }} />
            <col style={{ width: activityTableColWidths.agent }} />
            <col style={{ width: activityTableColWidths.execution }} />
            <col style={{ width: activityTableColWidths.confidence }} />
            <col style={{ width: activityTableColWidths.status }} />
          </colgroup>
          <thead>
            <tr className="text-[12px] text-white/40">
              <th className={cn(activityHeadPad, "font-medium")}>Time</th>
              <th className={cn(activityHeadPad, "font-medium")}>Agent</th>
              <th className={cn(activityHeadPad, "font-medium")}>Execution</th>
              <th className={cn(activityHeadPad, "font-medium")}>Confidence</th>
              <th className={cn(activityHeadPad, "text-right font-medium")}>Status</th>
            </tr>
          </thead>
          <tbody>
            {cycles.map((cycle) => (
              <CycleResultRow key={cycle.cycleId} cycle={cycle} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

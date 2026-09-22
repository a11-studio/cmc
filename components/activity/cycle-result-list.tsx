import Link from "next/link";
import { AssetTicker } from "@/components/market/asset-icon";
import { formatUsd } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import type { SerializedCycle } from "@/lib/agent/view";
import { cn } from "@/lib/utils";

function statusLabel(cycle: SerializedCycle): string {
  if (cycle.status === "COMPLETED") {
    return cycle.riskVerdict === "CONSTRAINED" ? "CONSTRAINED" : "COMPLETED";
  }

  if (cycle.status === "BLOCKED") {
    return "BLOCKED";
  }

  if (cycle.status.startsWith("FAILED")) {
    return "FAILED";
  }

  return cycle.status;
}

export function CycleResultList({ cycles }: { cycles: SerializedCycle[] }) {
  if (cycles.length === 0) {
    return (
      <EmptyState title="No cycles yet." description="Run a cycle or wait for the next hourly slot." />
    );
  }

  return (
    <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-surface-1">
      {cycles.map((cycle) => (
        <li key={cycle.cycleId} className="px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{cycle.strategy}</span>
              <span className="text-xs tabular-nums text-white/35">{cycle.cycleId}</span>
            </div>
            <span
              className={cn(
                "text-xs font-medium tracking-wide uppercase",
                cycle.status.startsWith("FAILED")
                  ? "text-negative"
                  : cycle.status === "BLOCKED"
                    ? "text-warning"
                    : "text-muted-foreground"
              )}
            >
              {statusLabel(cycle)}
            </span>
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-tertiary">Time</dt>
              <dd className="tabular-nums text-foreground">{cycle.snapshotTimestamp ?? cycle.startedAt}</dd>
            </div>
            <div>
              <dt className="text-xs text-tertiary">Decision</dt>
              <dd className="text-foreground">
                {cycle.decision ? (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span>{cycle.decision.action}</span>
                    <AssetTicker symbol={cycle.decision.symbol} size="xs" />
                    <span>
                      {cycle.decision.allocationPercent}% · {cycle.decision.confidence}%
                    </span>
                  </span>
                ) : cycle.failure?.stage === "MARKET" ? (
                  "CMC unavailable"
                ) : cycle.failure?.stage === "DECISION" ? (
                  "Gemini unavailable"
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-tertiary">Execution</dt>
              <dd className="text-foreground">
                {cycle.status === "BLOCKED"
                  ? "Blocked"
                  : cycle.executionOk
                    ? `${cycle.executionAction}${cycle.equity != null ? ` · ${formatUsd(cycle.equity)}` : ""}`
                    : cycle.failure?.message ?? "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-3">
            <Link
              href={`/decisions/${encodeURIComponent(cycle.cycleId)}`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              View decision
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

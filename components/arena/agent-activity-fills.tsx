"use client";

import { useState } from "react";
import Link from "next/link";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { DashboardCardSubtitle, DashboardCardTitle } from "@/components/arena/dashboard-card";
import { AssetIcon } from "@/components/market/asset-icon";
import { SideBadge } from "@/components/shared/side-badge";
import { formatNumber, formatRelativeTime, formatUsd } from "@/lib/format";
import type { AgentMark } from "@/types/arena";
import type { TradeRow } from "@/types/arena";

export type ActivityFill = TradeRow & {
  agentId: string;
  agentName: string;
  mark: AgentMark;
};

export function AgentActivityFills({
  latest,
  older,
}: {
  latest: ActivityFill[];
  older: ActivityFill[];
}) {
  const [expanded, setExpanded] = useState(false);
  const fills = expanded ? [...latest, ...older] : latest;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <DashboardCardTitle>Agent activity</DashboardCardTitle>
          <DashboardCardSubtitle>Recent fills</DashboardCardSubtitle>
        </div>
        {older.length > 0 ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
            className="shrink-0 pt-1 text-[12px] text-white/35 transition-colors hover:text-white/70"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        ) : null}
      </div>
      <ul className="mt-8 divide-y divide-white/6">
        {fills.map((fill) => (
          <FillRow key={`${fill.agentId}-${fill.id}`} fill={fill} />
        ))}
      </ul>
    </>
  );
}

function FillRow({ fill }: { fill: ActivityFill }) {
  const href = fill.decisionId ? `/decisions/${fill.decisionId}` : `/agents/${fill.agentId}`;

  return (
    <li className="py-3.5 first:pt-0 last:pb-0">
      <Link
        href={href}
        className="flex items-start justify-between gap-4 rounded-[12px] transition-colors hover:bg-white/[0.03]"
      >
        <div className="flex min-w-0 items-start gap-3">
          <AgentAvatar mark={fill.mark} name={fill.agentName} size="sm" />
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-[0.14em] text-white/40 uppercase">
              {fill.agentName}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <AssetIcon symbol={fill.symbol} size="md" />
              <SideBadge action={fill.side} />
              <span className="text-sm font-medium">{fill.symbol}</span>
            </div>
            <p className="mt-1 text-[12px] tabular-nums text-white/40">
              {formatNumber(fill.quantity, 4)} @ {formatUsd(fill.price)}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-medium tabular-nums">{formatUsd(fill.notional)}</p>
          <time className="mt-1 block text-[12px] text-white/35" dateTime={fill.createdAt}>
            {formatRelativeTime(fill.createdAt)}
          </time>
        </div>
      </Link>
    </li>
  );
}

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { StatusBadge } from "@/components/agents/status-badge";
import { DataSourceBadge } from "@/components/shared/data-source-badge";
import { SignedPercent } from "@/components/shared/signed-value";
import { formatUsd } from "@/lib/format";
import type { LeaderboardAgent } from "@/types/arena";

export function Leaderboard({ agents }: { agents: LeaderboardAgent[] }) {
  const ranked = [...agents].sort((a, b) => b.returnPercent - a.returnPercent);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-1">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12">Rank</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Strategy</TableHead>
            <TableHead className="text-right">Equity</TableHead>
            <TableHead className="text-right">Return</TableHead>
            <TableHead className="text-right">Drawdown</TableHead>
            <TableHead className="text-right">Trades</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranked.map((agent, index) => (
            <TableRow key={agent.id} className="relative">
              <TableCell className="text-tertiary tabular-nums">{index + 1}</TableCell>
              <TableCell>
                <Link
                  href={`/agents/${agent.id}`}
                  className="flex items-center gap-2.5 font-medium text-foreground"
                >
                  <AgentAvatar mark={agent.mark} name={agent.name} size="sm" />
                  <span className="flex items-center gap-2">
                    {agent.name}
                    <DataSourceBadge source={agent.dataSource} />
                  </span>
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{agent.strategy}</TableCell>
              <TableCell className="text-right tabular-nums text-foreground">
                {formatUsd(agent.equity)}
              </TableCell>
              <TableCell className="text-right">
                <SignedPercent value={agent.returnPercent} />
              </TableCell>
              <TableCell className="text-right tabular-nums text-negative">
                -{agent.drawdownPercent.toFixed(1)}%
              </TableCell>
              <TableCell className="text-right tabular-nums text-foreground">
                {agent.trades}
              </TableCell>
              <TableCell>
                <StatusBadge status={agent.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

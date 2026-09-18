import Link from "next/link";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { DashboardCard, DashboardCardTitle } from "@/components/arena/dashboard-card";
import { SignedPercent } from "@/components/shared/signed-value";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LeaderboardAgent } from "@/types/arena";

function arenaStatus(agent: LeaderboardAgent) {
  if (agent.status === "ERROR") {
    return { label: "ERROR", className: "text-[#F87171]" };
  }

  if (agent.status === "PAUSED") {
    return { label: "PAUSED", className: "text-white/40" };
  }

  if (agent.runtimeStatus === "LIVE" || agent.dataSource === "live") {
    return { label: "LIVE", className: "text-[#8ADF7B]" };
  }

  if (agent.runtimeStatus === "SIMULATION" || agent.dataSource === "sample") {
    return { label: "SIMULATION", className: "text-white/40" };
  }

  return { label: "READY", className: "text-[#00D4CF]" };
}

function BookSplit({ amount, book }: { amount: number; book: number }) {
  const percent = book > 0 ? (Math.abs(amount) / book) * 100 : 0;

  return (
    <div className="text-right">
      <p className="tabular-nums">{formatUsd(amount)}</p>
      <p className="text-[11px] tabular-nums text-white/40">{percent.toFixed(0)}%</p>
    </div>
  );
}

export function AgentsTableCard({ agents }: { agents: LeaderboardAgent[] }) {
  const ranked = [...agents].sort((left, right) => {
    const leftLive = left.runtimeStatus === "LIVE" || left.dataSource === "live";
    const rightLive = right.runtimeStatus === "LIVE" || right.dataSource === "live";

    if (leftLive !== rightLive) {
      return leftLive ? -1 : 1;
    }

    return right.returnPercent - left.returnPercent;
  });

  return (
    <DashboardCard id="agents" className="scroll-mt-6">
      <DashboardCardTitle>Agents {agents.length}</DashboardCardTitle>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[880px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-[12px] text-white/40">
              <th className="pb-3 font-medium">Agent</th>
              <th className="pb-3 font-medium">Strategy</th>
              <th className="pb-3 text-right font-medium">Equity</th>
              <th className="pb-3 text-right font-medium">Coins</th>
              <th className="pb-3 text-right font-medium">Cash</th>
              <th className="pb-3 text-right font-medium">Return</th>
              <th className="pb-3 text-right font-medium">Drawdown</th>
              <th className="pb-3 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((agent) => {
              const status = arenaStatus(agent);
              const live = agent.runtimeStatus === "LIVE" || agent.dataSource === "live";
              const book = Math.abs(agent.coins) + Math.abs(agent.cash);

              return (
                <tr key={agent.id} className="border-t border-white/6">
                  <td className="border-t border-white/6 py-2.5 pr-4">
                    <Link href={`/agents/${agent.id}`} className="flex items-center gap-2.5 font-medium">
                      <AgentAvatar mark={agent.mark} name={agent.name} size="sm" />
                      <span>{agent.name}</span>
                    </Link>
                  </td>
                  <td className="border-t border-white/6 py-2.5 pr-4 text-white/55">{agent.strategy}</td>
                  <td className="border-t border-white/6 py-2.5 pr-4 text-right tabular-nums">
                    {live ? formatUsd(agent.equity) : "—"}
                  </td>
                  <td className="border-t border-white/6 py-2.5 pr-4">
                    {live ? <BookSplit amount={agent.coins} book={book} /> : <p className="text-right">—</p>}
                  </td>
                  <td className="border-t border-white/6 py-2.5 pr-4">
                    {live ? <BookSplit amount={agent.cash} book={book} /> : <p className="text-right">—</p>}
                  </td>
                  <td className="border-t border-white/6 py-2.5 pr-4 text-right">
                    {live ? <SignedPercent value={agent.returnPercent} digits={1} /> : "—"}
                  </td>
                  <td className="border-t border-white/6 py-2.5 pr-4 text-right tabular-nums text-[#F87171]">
                    {live && agent.drawdownPercent > 0 ? `-${agent.drawdownPercent.toFixed(1)}%` : "—"}
                  </td>
                  <td className={cn("border-t border-white/6 py-2.5 text-right text-[12px] font-medium tracking-[0.12em]", status.className)}>
                    {status.label}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}

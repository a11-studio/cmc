import { AgentActivityCard } from "@/components/arena/agent-activity-card";
import { AgentAllocationCard } from "@/components/arena/agent-allocation-card";
import { AgentsTableCard } from "@/components/arena/agents-table-card";
import { ArenaPerformanceCard } from "@/components/arena/arena-performance-card";
import { LatestDecisionCard } from "@/components/arena/latest-decision-card";
import { RiskOverviewCard } from "@/components/arena/risk-overview-card";
import { PauseTradingButton } from "@/components/agents/pause-trading-button";
import { PersistenceNotice } from "@/components/shared/persistence-notice";
import { combineEquitySeries } from "@/lib/charts/equity";
import type { MomentumAlphaView } from "@/lib/agent/view";
import type { LeaderboardAgent } from "@/types/arena";

export function ArenaDashboard({
  books,
  roster,
  live,
  summary,
  persistenceMode,
  paused,
}: {
  books: MomentumAlphaView[];
  roster: LeaderboardAgent[];
  live: MomentumAlphaView;
  summary: {
    agentCount: number;
    startingCapital: number;
    totalEquity: number;
    pnl: number;
    returnPercent: number;
  };
  persistenceMode: "memory" | "supabase";
  paused: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <ArenaPerformanceCard
          className="md:col-span-2 xl:col-span-1"
          agentCount={summary.agentCount}
          pnl={summary.pnl}
          returnPercent={summary.returnPercent}
          startingCapital={summary.startingCapital}
          currentEquity={summary.totalEquity}
          series={combineEquitySeries(books)}
          action={<PauseTradingButton status={paused ? "PAUSED" : "ACTIVE"} compact />}
        />
        <AgentAllocationCard books={books} />
        <LatestDecisionCard decisions={books.flatMap((book) => book.decisions)} />
        <div className="h-full md:col-span-2 xl:col-span-3">
          <AgentsTableCard agents={roster} />
        </div>
        <RiskOverviewCard live={live} />
        <div className="h-full md:col-span-2">
          <AgentActivityCard books={books} />
        </div>
      </div>
      <PersistenceNotice mode={persistenceMode} />
    </div>
  );
}

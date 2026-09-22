import { AgentActivityCard } from "@/components/arena/agent-activity-card";
import { AgentAllocationCard } from "@/components/arena/agent-allocation-card";
import { AgentsTableCard } from "@/components/arena/agents-table-card";
import { ArenaPerformanceCard } from "@/components/arena/arena-performance-card";
import { LatestDecisionCard } from "@/components/arena/latest-decision-card";
import { RiskOverviewCard } from "@/components/arena/risk-overview-card";
import { PauseTradingButton } from "@/components/agents/pause-trading-button";
import { PersistenceNotice } from "@/components/shared/persistence-notice";
import { combineEquitySeries } from "@/lib/charts/equity";
import { isArenaDebugControlsEnabled, type MomentumAlphaView } from "@/lib/agent/view";
import { allocationBooksFromDashboardLite } from "@/lib/arena/dashboard-lite-allocation";
import { dashboardLiteRoster } from "@/lib/arena/dashboard-lite-build";
import type { DashboardLite } from "@/lib/arena/dashboard-lite-types";
import type { LeaderboardAgent } from "@/types/arena";

type ArenaDashboardProps =
  | {
      mode: "lite";
      lite: DashboardLite;
    }
  | {
      mode: "legacy";
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
    };

export function ArenaDashboard(props: ArenaDashboardProps) {
  if (props.mode === "lite") {
    const { lite } = props;
    const roster = dashboardLiteRoster(lite.agents);
    const allocationBooks = allocationBooksFromDashboardLite(lite, lite.positionsByAgent);

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ArenaPerformanceCard
            className="md:col-span-2 xl:col-span-1"
            agentCount={lite.summary.agentCount}
            pnl={lite.summary.pnl}
            returnPercent={lite.summary.returnPercent}
            startingCapital={lite.summary.startingCapital}
            currentEquity={lite.summary.totalEquity}
            series={lite.combinedEquitySeries}
            action={
              isArenaDebugControlsEnabled() ? (
                <PauseTradingButton status={lite.paused ? "PAUSED" : "ACTIVE"} compact />
              ) : undefined
            }
          />
          <AgentAllocationCard books={allocationBooks} />
          <LatestDecisionCard decisions={lite.latestDecisions} />
          <div className="h-full md:col-span-2 xl:col-span-3">
            <AgentsTableCard agents={roster} />
          </div>
          <RiskOverviewCard
            equity={lite.risk.equity}
            dayStartEquity={lite.risk.dayStartEquity}
            drawdownPercent={lite.agents.find((agent) => agent.id === lite.risk.agentId)?.drawdownPercent ?? 0}
            positions={lite.risk.positions}
          />
          <div className="h-full md:col-span-2">
            <AgentActivityCard recentFills={lite.recentFills} />
          </div>
        </div>
        <PersistenceNotice mode={lite.persistenceMode} />
      </div>
    );
  }

  const { books, roster, live, summary, persistenceMode, paused } = props;

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
          action={
            isArenaDebugControlsEnabled() ? (
              <PauseTradingButton status={paused ? "PAUSED" : "ACTIVE"} compact />
            ) : undefined
          }
        />
        <AgentAllocationCard books={books} />
        <LatestDecisionCard decisions={books.flatMap((book) => book.decisions)} />
        <div className="h-full md:col-span-2 xl:col-span-3">
          <AgentsTableCard agents={roster} />
        </div>
        <RiskOverviewCard
          equity={live.agent.equity}
          dayStartEquity={live.dayStartEquity}
          drawdownPercent={live.agent.drawdownPercent}
          positions={live.positions}
        />
        <div className="h-full md:col-span-2">
          <AgentActivityCard books={books} />
        </div>
      </div>
      <PersistenceNotice mode={persistenceMode} />
    </div>
  );
}

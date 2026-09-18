import { AgentActivityFills, type ActivityFill } from "@/components/arena/agent-activity-fills";
import { DashboardCard, DashboardCardSubtitle, DashboardCardTitle } from "@/components/arena/dashboard-card";
import { latestFillBatch } from "@/lib/arena/activity-fills";
import type { MomentumAlphaView } from "@/lib/agent/view";

function recentFills(books: MomentumAlphaView[], limit = 32): ActivityFill[] {
  return books
    .flatMap((book) =>
      book.trades.map((trade) => ({
        ...trade,
        agentId: book.agent.id,
        agentName: book.agent.name,
        mark: book.agent.mark,
      }))
    )
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, limit);
}

export function AgentActivityCard({ books }: { books: MomentumAlphaView[] }) {
  const { latest, older } = latestFillBatch(recentFills(books));

  return (
    <DashboardCard>
      {latest.length === 0 ? (
        <>
          <DashboardCardTitle>Agent activity</DashboardCardTitle>
          <DashboardCardSubtitle>Recent fills</DashboardCardSubtitle>
          <p className="mt-10 text-sm text-white/40">No fills yet. HOLD cycles stay off this list.</p>
        </>
      ) : (
        <AgentActivityFills latest={latest} older={older} />
      )}
    </DashboardCard>
  );
}

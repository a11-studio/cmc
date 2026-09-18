import { PageHeader } from "@/components/shared/page-header";
import { DataSourceNotice } from "@/components/shared/data-source-notice";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { CycleResultList } from "@/components/activity/cycle-result-list";
import { RunCycleButton } from "@/components/agents/run-cycle-button";
import { Card } from "@/components/ui/card";
import { PersistenceNotice } from "@/components/shared/persistence-notice";
import { getArenaPersistenceMode, getLiveAgentViews } from "@/lib/arena/data";
import { isManualCycleEnabled } from "@/lib/agent/view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Activity",
};

export default async function ActivityPage() {
  const books = await getLiveAgentViews();
  const persistenceMode = getArenaPersistenceMode();
  const cycles = [...books.flatMap((book) => book.cycles)].sort(
    (left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt)
  );
  const events = [...books.flatMap((book) => book.events)].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Activity"
        title="Live cycles"
        description="ANALYZING → DECISION → RISK CHECK → TRADE EXECUTED or BLOCKED."
        actions={isManualCycleEnabled() ? <RunCycleButton /> : undefined}
      />

      <DataSourceNotice source="live" />
      <PersistenceNotice mode={persistenceMode} />

      <CycleResultList cycles={cycles} />

      {events.length > 0 ? (
        <Card className="px-5 py-2">
          <ActivityTimeline events={events} showAgent />
        </Card>
      ) : (
        <Card className="px-5 py-6">
          <p className="text-sm text-tertiary">No live activity yet.</p>
        </Card>
      )}
    </div>
  );
}

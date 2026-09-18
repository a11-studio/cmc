import { PageHeader } from "@/components/shared/page-header";
import { DataSourceNotice } from "@/components/shared/data-source-notice";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { CycleResultList } from "@/components/activity/cycle-result-list";
import { RunCycleButton } from "@/components/agents/run-cycle-button";
import { Card } from "@/components/ui/card";
import { PersistenceNotice } from "@/components/shared/persistence-notice";
import { getArenaPersistenceMode, getMomentumAlphaView } from "@/lib/arena/data";
import { isManualCycleEnabled } from "@/lib/agent/view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Activity",
};

export default async function ActivityPage() {
  const live = await getMomentumAlphaView();
  const persistenceMode = getArenaPersistenceMode();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Activity"
        title="Elon Musk cycle"
        description="ANALYZING → DECISION → RISK CHECK → TRADE EXECUTED or BLOCKED."
        actions={isManualCycleEnabled() ? <RunCycleButton /> : undefined}
      />

      <DataSourceNotice source="live" />
      <PersistenceNotice mode={persistenceMode} />

      <CycleResultList cycles={live.cycles} />

      {live.events.length > 0 ? (
        <Card className="px-5 py-2">
          <ActivityTimeline events={live.events} showAgent />
        </Card>
      ) : (
        <Card className="px-5 py-6">
          <p className="text-sm text-tertiary">No live activity yet.</p>
        </Card>
      )}
    </div>
  );
}

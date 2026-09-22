import { PageHeader } from "@/components/shared/page-header";
import { DataSourceNotice } from "@/components/shared/data-source-notice";
import { ActivityFeedPanel } from "@/components/activity/activity-feed-panel";
import { RunCycleButton } from "@/components/agents/run-cycle-button";
import { PersistenceNotice } from "@/components/shared/persistence-notice";
import { fetchActivityFeed } from "@/lib/arena/activity-feed";
import { getArenaPersistenceMode } from "@/lib/arena/data";
import { isManualCycleEnabled } from "@/lib/agent/view";
import { pageMetadataFromKey } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

export const metadata = pageMetadataFromKey("activity");

export default async function ActivityPage() {
  const persistenceMode = getArenaPersistenceMode();
  const feed = await fetchActivityFeed();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Activity"
        title="Live cycles"
        description="Latest hourly batch across the floor. Older cycles stay behind Show more. ANALYZING → DECISION → RISK CHECK → TRADE EXECUTED or BLOCKED."
        actions={isManualCycleEnabled() ? <RunCycleButton /> : undefined}
      />

      <DataSourceNotice source="live" />
      <PersistenceNotice mode={persistenceMode} />

      <ActivityFeedPanel latest={feed.latest} older={feed.older} />
    </div>
  );
}

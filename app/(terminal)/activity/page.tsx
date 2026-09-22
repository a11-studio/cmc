import { PageHeader } from "@/components/shared/page-header";
import { ActivityFeedPanel } from "@/components/activity/activity-feed-panel";
import { RunCycleButton } from "@/components/agents/run-cycle-button";
import { fetchActivityFeed } from "@/lib/arena/activity-feed";
import { isManualCycleEnabled } from "@/lib/agent/view";
import { pageMetadataFromKey } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

export const metadata = pageMetadataFromKey("activity");

export default async function ActivityPage() {
  const feed = await fetchActivityFeed();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Activity"
        title="Live cycles"
        actions={isManualCycleEnabled() ? <RunCycleButton /> : undefined}
      />

      <ActivityFeedPanel latest={feed.latest} older={feed.older} />
    </div>
  );
}

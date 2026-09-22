import { DailyWinnerGrid } from "@/components/arena/daily-winner-grid";
import { DataSourceNotice } from "@/components/shared/data-source-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PersistenceNotice } from "@/components/shared/persistence-notice";
import { fetchDailyWinners } from "@/lib/arena/daily-winners";
import { getArenaPersistenceMode } from "@/lib/arena/data";
import { pageMetadataFromKey } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

export const metadata = pageMetadataFromKey("winners");

export default async function WinnersPage() {
  const [winners, persistenceMode] = await Promise.all([
    fetchDailyWinners(),
    Promise.resolve(getArenaPersistenceMode()),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Winners"
        title="Daily crown"
        description="One winner per UTC calendar day — whoever grew paper equity the most from the first to the last snapshot that day."
      />

      <DataSourceNotice source="live" />
      <PersistenceNotice mode={persistenceMode} />

      {winners.length > 0 ? (
        <DailyWinnerGrid winners={winners} />
      ) : (
        <EmptyState
          title="No daily winners yet."
          description="After live agents run for a full day with portfolio snapshots saved, each day gets a crown card for the top daily P&amp;L."
        />
      )}
    </div>
  );
}

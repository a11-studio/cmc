import { DailyWinnerGrid } from "@/components/arena/daily-winner-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { fetchDailyWinners } from "@/lib/arena/daily-winners";
import { pageMetadataFromKey } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

export const metadata = pageMetadataFromKey("winners");

export default async function WinnersPage() {
  const winners = await fetchDailyWinners();

  return (
    <div className="space-y-6">
      <PageHeader kicker="Winners" title="Daily crown" />

      {winners.length > 0 ? (
        <DailyWinnerGrid winners={winners} />
      ) : (
        <EmptyState title="No daily winners yet." description="Winners appear after a full UTC day of live snapshots." />
      )}
    </div>
  );
}

import { ArenaDashboard } from "@/components/arena/arena-dashboard";
import { CmcIntelligenceStrip } from "@/components/marketing/cmc-intelligence-strip";
import { getArenaDashboard } from "@/lib/arena/data";
import { pageMetadataFromKey } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

export const metadata = pageMetadataFromKey("home");

export default async function ArenaPage() {
  const dashboard = await getArenaDashboard();

  return (
    <div className="space-y-3">
      <CmcIntelligenceStrip />
      <ArenaDashboard
      books={dashboard.books}
      roster={dashboard.roster}
      live={dashboard.live}
      summary={dashboard.summary}
      persistenceMode={dashboard.persistenceMode}
      paused={dashboard.paused}
      />
    </div>
  );
}

import { ArenaDashboard } from "@/components/arena/arena-dashboard";
import { CmcIntelligenceStrip } from "@/components/marketing/cmc-intelligence-strip";
import { getArenaDashboard } from "@/lib/arena/data";
import { hasServerEnv } from "@/lib/env.server";
import { fetchBtcLiquidationSummary } from "@/lib/market/btc-liquidation-summary";
import { pageMetadataFromKey } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

export const metadata = pageMetadataFromKey("home");

export default async function ArenaPage() {
  const dashboard = await getArenaDashboard();

  let liquidationSummary = null;

  if (hasServerEnv("CMC_API_KEY")) {
    try {
      liquidationSummary = await fetchBtcLiquidationSummary({
        apiKey: process.env.CMC_API_KEY ?? "",
      });
    } catch {
      liquidationSummary = null;
    }
  }

  return (
    <div className="space-y-3">
      <CmcIntelligenceStrip liquidationSummary={liquidationSummary} />
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

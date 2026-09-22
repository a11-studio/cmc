import { ArenaDashboard } from "@/components/arena/arena-dashboard";
import { resolveArenaHomeData } from "@/lib/arena/arena-page-data";
import { pageMetadataFromKey } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

export const metadata = pageMetadataFromKey("home");

export default async function ArenaPage() {
  const home = await resolveArenaHomeData();

  return (
    <div>
      {home.mode === "lite" ? (
        <ArenaDashboard mode="lite" lite={home.lite} />
      ) : (
        <ArenaDashboard
          mode="legacy"
          books={home.legacy.books}
          roster={home.legacy.roster}
          live={home.legacy.live}
          summary={home.legacy.summary}
          persistenceMode={home.legacy.persistenceMode}
          paused={home.legacy.paused}
        />
      )}
    </div>
  );
}

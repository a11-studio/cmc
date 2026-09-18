import { ArenaDashboard } from "@/components/arena/arena-dashboard";
import { getArenaDashboard } from "@/lib/arena/data";

export const dynamic = "force-dynamic";

export default async function ArenaPage() {
  const dashboard = await getArenaDashboard();

  return (
    <ArenaDashboard
      agents={dashboard.agents}
      roster={dashboard.roster}
      live={dashboard.live}
      summary={dashboard.summary}
      persistenceMode={dashboard.persistenceMode}
    />
  );
}

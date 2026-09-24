import "server-only";

import { dashboardLiteFromLegacyViews } from "@/lib/arena/dashboard-lite-build";
import type { DashboardLite } from "@/lib/arena/dashboard-lite-types";
import { fetchDashboardLite } from "@/lib/arena/dashboard-lite";
import { getArenaDashboard } from "@/lib/arena/data";
import { isArenaDashboardLiteEnabled, isSupabasePersistenceConfigured } from "@/lib/env.server";
import type { MomentumAlphaView } from "@/lib/agent/view";
import type { LeaderboardAgent } from "@/types/arena";

export type ArenaHomeLegacyData = Awaited<ReturnType<typeof getArenaDashboard>>;

export type ArenaHomeData =
  | { mode: "lite"; lite: DashboardLite }
  | { mode: "legacy"; legacy: ArenaHomeLegacyData };

export async function resolveArenaHomeData(): Promise<ArenaHomeData> {
  if (!isArenaDashboardLiteEnabled()) {
    return { mode: "legacy", legacy: await getArenaDashboard() };
  }

  if (isSupabasePersistenceConfigured()) {
    try {
      return { mode: "lite", lite: await fetchDashboardLite() };
    } catch (error) {
      console.error("fetchDashboardLite failed; falling back to legacy hydrate", error);
    }
  }

  const legacy = await getArenaDashboard();
  return {
    mode: "lite",
    lite: dashboardLiteFromLegacyViews(legacy.books, legacy.persistenceMode, legacy.paused),
  };
}

export function legacyBooks(data: ArenaHomeData): MomentumAlphaView[] | undefined {
  return data.mode === "legacy" ? data.legacy.books : undefined;
}

export function legacyRoster(data: ArenaHomeData): LeaderboardAgent[] | undefined {
  return data.mode === "legacy" ? data.legacy.roster : undefined;
}

import { ttlCacheKey, getTtlCached, invalidateTtlCache, setTtlCached } from "@/lib/server/ttl-cache";
import type { DashboardLite } from "@/lib/arena/dashboard-lite-types";

export const DASHBOARD_LITE_CACHE_MS = 20_000;

const DASHBOARD_LITE_CACHE_KEY = ttlCacheKey(["arena", "dashboard-lite"]);

export function getCachedDashboardLite(): DashboardLite | undefined {
  return getTtlCached<DashboardLite>(DASHBOARD_LITE_CACHE_KEY);
}

export function setCachedDashboardLite(value: DashboardLite): void {
  setTtlCached(DASHBOARD_LITE_CACHE_KEY, value, DASHBOARD_LITE_CACHE_MS);
}

export function invalidateDashboardLiteCache(): void {
  invalidateTtlCache(DASHBOARD_LITE_CACHE_KEY);
}

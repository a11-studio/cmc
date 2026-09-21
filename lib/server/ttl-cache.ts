/**
 * In-process TTL cache for expensive Supabase reads on the Node server.
 * Not shared across Vercel instances; still cuts duplicate reads within a single
 * instance when /api/shell and RSC loaders run back-to-back.
 *
 * Never use for mutation paths or post-persist reads that must be immediately fresh
 * for trading execution — call `invalidateTtlCache` after writes instead.
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

export const DEFAULT_TTL_CACHE_MS = 10_000;

export function ttlCacheKey(parts: readonly string[]): string {
  return parts.join(":");
}

export function getTtlCached<T>(key: string): T | undefined {
  const entry = store.get(key);

  if (!entry) {
    return undefined;
  }

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }

  return entry.value as T;
}

export function setTtlCached<T>(key: string, value: T, ttlMs = DEFAULT_TTL_CACHE_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidateTtlCache(key: string): void {
  store.delete(key);
}

export function invalidateTtlCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

export function resetTtlCacheForTests(): void {
  store.clear();
}

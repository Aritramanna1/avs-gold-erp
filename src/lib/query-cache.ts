/**
 * MTJ ERP — In-memory TTL query cache
 * Prevents re-computing expensive aggregations on every render.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 30_000; // 30 seconds

export function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): T {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/** Helper: compute only if not in cache */
export function memoize<T>(key: string, compute: () => T, ttlMs = DEFAULT_TTL_MS): T {
  const cached = getCached<T>(key);
  if (cached !== undefined) return cached;
  return setCached(key, compute(), ttlMs);
}

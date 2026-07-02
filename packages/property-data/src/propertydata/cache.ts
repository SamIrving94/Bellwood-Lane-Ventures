/**
 * In-memory cache for PropertyData responses (per server instance).
 *
 * Each PropertyData endpoint costs credits, so we cache aggressively to keep
 * the live form path cheap. This is a small, dependency-free LRU with TTL:
 *   - `cacheGet` evicts on expiry and refreshes recency on a hit (true LRU).
 *   - `cacheSet` evicts the least-recently-used entry once at capacity.
 *
 * It is intentionally bounded (`MAX_CACHE_ENTRIES`) so a long-lived instance
 * can't grow without limit. Long-term this should move to Postgres/Redis so it
 * survives cold starts — see docs/CODE-REVIEW.md — but for the agent quick-form
 * volume profile an in-memory LRU is enough.
 */

export const MAX_CACHE_ENTRIES = 500;

type CacheEntry<T> = { value: T; expiresAt: number };

// Map preserves insertion order; we exploit that for LRU ordering by deleting
// and re-inserting an entry whenever it is read or written.
const cache = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  // Refresh recency: move this key to the most-recently-used position.
  cache.delete(key);
  cache.set(key, entry);
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number) {
  // If the key already exists, delete first so re-insertion moves it to the end.
  cache.delete(key);
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // Evict the least-recently-used entry (the first key in insertion order).
    const lruKey = cache.keys().next().value;
    if (lruKey !== undefined) cache.delete(lruKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Test/maintenance helper — drop every cached entry. */
export function cacheClear() {
  cache.clear();
}

import { beforeEach, describe, expect, it } from 'vitest';
import {
  cacheClear,
  cacheGet,
  cacheSet,
  MAX_CACHE_ENTRIES,
} from '../cache';

describe('propertydata cache', () => {
  beforeEach(() => cacheClear());

  it('round-trips a stored value within its TTL', () => {
    cacheSet('a', { n: 1 }, 60_000);
    expect(cacheGet<{ n: number }>('a')).toEqual({ n: 1 });
    expect(cacheGet('missing')).toBeNull();
  });

  it('treats an expired entry as a miss and evicts it', () => {
    // A non-positive TTL puts expiresAt in the past, so the first read misses.
    cacheSet('stale', 'value', -1);
    expect(cacheGet('stale')).toBeNull();
  });

  it('evicts the least-recently-used entry at capacity, respecting reads', () => {
    // Fill to capacity: keys "k0".."k{MAX-1}", inserted oldest-first.
    for (let i = 0; i < MAX_CACHE_ENTRIES; i++) {
      cacheSet(`k${i}`, i, 60_000);
    }
    // Touch the oldest key so it becomes most-recently-used.
    expect(cacheGet('k0')).toBe(0);

    // One more insert forces a single eviction. Because k0 was just read, the
    // now-oldest entry (k1) is evicted instead.
    cacheSet('overflow', 'x', 60_000);

    expect(cacheGet('k0')).toBe(0); // survived — was refreshed by the read
    expect(cacheGet('k1')).toBeNull(); // evicted as the LRU entry
    expect(cacheGet('overflow')).toBe('x');
  });
});

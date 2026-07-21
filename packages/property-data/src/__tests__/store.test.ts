import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __clearMemoryCache, getFloodRisk } from '../propertydata';
import { __resetRateLimiter } from '../rate-limiter';
import { setPersistentStore, type PersistentCacheStore } from '../store';

// The durable cache is the #1 lever against wasted PropertyData credits (and a
// compounding cause of the lead-appraise 504s): a cold-started instance, with an
// empty in-memory cache, must serve a still-fresh response from the persistent
// store instead of re-buying it. Exercised end-to-end through getFloodRisk (a
// simple endpoint that routes through fetchPropertyData); the network is stubbed.

const VALID_BODY = JSON.stringify({
  status: 'ok',
  result: { rivers_and_sea: 'Low', surface_water: 'Low' },
});

function okResponse() {
  return new Response(VALID_BODY, {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function makeMockStore() {
  const map = new Map<string, { value: unknown; expiresAt: number }>();
  const store: PersistentCacheStore = {
    get: vi.fn(async (key: string) => map.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown, expiresAt: number) => {
      map.set(key, { value, expiresAt });
    }),
  };
  return { store, map };
}

describe('fetchPropertyData durable cache (via getFloodRisk)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __clearMemoryCache();
    __resetRateLimiter();
    setPersistentStore(null);
    fetchMock = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    setPersistentStore(null);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('writes through to the persistent store on a live fetch', async () => {
    const { store, map } = makeMockStore();
    setPersistentStore(store);

    const res = await getFloodRisk('SW1A 2AA');

    expect(res).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await Promise.resolve(); // flush the fire-and-forget write
    expect(store.set).toHaveBeenCalledTimes(1);
    expect(map.size).toBe(1);
  });

  it('serves from the persistent store after a cold start, skipping the live fetch', async () => {
    const { store } = makeMockStore();
    setPersistentStore(store);

    await getFloodRisk('SW1A 2AA');
    await Promise.resolve(); // flush write-back
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Cold start: in-memory cache emptied, persistent store survives.
    __clearMemoryCache();
    const res2 = await getFloodRisk('SW1A 2AA');

    expect(res2).not.toBeNull();
    // No second live fetch — the durable cache saved the credit.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.get).toHaveBeenCalled();
  });

  it('re-fetches when the persistent entry has expired', async () => {
    const { store, map } = makeMockStore();
    setPersistentStore(store);

    await getFloodRisk('SW1A 2AA');
    await Promise.resolve();
    for (const [k, v] of map) map.set(k, { ...v, expiresAt: Date.now() - 1 });
    __clearMemoryCache();
    fetchMock.mockClear();

    await getFloodRisk('SW1A 2AA');
    expect(fetchMock).toHaveBeenCalledTimes(1); // had to buy it again
  });

  it('behaves as in-memory-only when no persistent store is registered', async () => {
    await getFloodRisk('SW1A 2AA');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Second call within the same instance hits the in-memory cache.
    await getFloodRisk('SW1A 2AA');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

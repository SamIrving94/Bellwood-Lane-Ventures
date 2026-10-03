import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PropertyDataUnavailableError,
  __clearMemoryCache,
  getFloodRisk,
  getFreeholdTitles,
} from '../propertydata';
import { __resetRateLimiter } from '../rate-limiter';
import { type PersistentCacheStore, setPersistentStore } from '../store';

// The rails every live PropertyData request now runs on, checked against the
// API documentation (docs/setup/propertydata-api-reference.md):
//   - the key travels as a Bearer header, never in the URL;
//   - 429 (X14) and 503 (X20) get exactly one retry after Retry-After;
//   - a durable row is held to the 60-day licence limit from the moment it was
//     stored, whatever TTL it was written with;
//   - "1 per 10 results" endpoints log what the call actually cost.

const DAY_MS = 24 * 60 * 60 * 1000;

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

const FLOOD_BODY = {
  status: 'success',
  postcode: 'M14 5XY',
  flood_risk: 'Low',
};

function makeMockStore() {
  const map = new Map<
    string,
    { value: unknown; expiresAt: number; storedAt?: number }
  >();
  const store: PersistentCacheStore = {
    get: vi.fn((key: string) => Promise.resolve(map.get(key) ?? null)),
    set: vi.fn((key: string, value: unknown, expiresAt: number) => {
      map.set(key, { value, expiresAt, storedAt: Date.now() });
      return Promise.resolve();
    }),
    delete: vi.fn((key: string) => {
      map.delete(key);
      return Promise.resolve();
    }),
  };
  return { store, map };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __clearMemoryCache();
  __resetRateLimiter();
  setPersistentStore(null);
  fetchMock = vi.fn(async () => jsonResponse(FLOOD_BODY));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  setPersistentStore(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the API key stays out of the URL', () => {
  it('sends it as a Bearer header and leaves the query string clean', async () => {
    await getFloodRisk('M14 5XY');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('test-key');
    expect(url).not.toContain('key=');
    expect(url).toContain('postcode=M145XY');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-key'
    );
  });
});

describe('retry on the two "wait and try again" statuses', () => {
  it('retries a 429 once, after the Retry-After the server asked for', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ status: 'error', code: 'X14' }, 429, {
          'retry-after': '1',
        })
      )
      .mockResolvedValueOnce(jsonResponse(FLOOD_BODY));

    const started = Date.now();
    const res = await getFloodRisk('M14 5XY');

    expect(res?.floodRisk).toBe('Low');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Honoured the header (1s), not the 2.5s default.
    const waited = Date.now() - started;
    expect(waited).toBeGreaterThanOrEqual(900);
    expect(waited).toBeLessThan(2400);
  });

  it('retries a 503 (X20 server busy) the same way', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ status: 'error', code: 'X20' }, 503, {
          'retry-after': '1',
        })
      )
      .mockResolvedValueOnce(jsonResponse(FLOOD_BODY));

    const res = await getFloodRisk('M14 5XY');

    expect(res?.floodRisk).toBe('Low');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after one retry and reports the failure', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'error', code: 'X14' }, 429, {
        'retry-after': '1',
      })
    );

    await expect(getFloodRisk('M14 5XY')).rejects.toBeInstanceOf(
      PropertyDataUnavailableError
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('the durable tier honours the 60-day licence limit', () => {
  const key = '/flood-risk:{"postcode":"M145XY"}';

  it('evicts and re-buys a row stored more than 60 days ago, whatever its TTL', async () => {
    const { store, map } = makeMockStore();
    map.set(key, {
      value: { status: 'success', flood_risk: 'High' },
      expiresAt: Date.now() + 20 * DAY_MS, // still "live" under its old 90-day TTL
      storedAt: Date.now() - 61 * DAY_MS,
    });
    setPersistentStore(store);

    const res = await getFloodRisk('M14 5XY');

    expect(store.delete).toHaveBeenCalledWith(key);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res?.floodRisk).toBe('Low'); // the fresh answer, not the stale one
  });

  it('evicts a row with no stored-at that could only have come from a longer TTL', async () => {
    const { store, map } = makeMockStore();
    map.set(key, {
      value: { status: 'success', flood_risk: 'High' },
      expiresAt: Date.now() + 80 * DAY_MS, // > 60 days left ⇒ written under 90d
    });
    setPersistentStore(store);

    await getFloodRisk('M14 5XY');

    expect(store.delete).toHaveBeenCalledWith(key);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still serves a row stored 10 days ago without a network call', async () => {
    const { store, map } = makeMockStore();
    map.set(key, {
      value: { status: 'success', flood_risk: 'High' },
      expiresAt: Date.now() + 50 * DAY_MS,
      storedAt: Date.now() - 10 * DAY_MS,
    });
    setPersistentStore(store);

    const res = await getFloodRisk('M14 5XY');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.delete).not.toHaveBeenCalled();
    expect(res?.floodRisk).toBe('High');
  });

  it('never writes a durable row that outlives 60 days', async () => {
    const { store } = makeMockStore();
    setPersistentStore(store);

    await getFloodRisk('M14 5XY');
    await Promise.resolve();

    const [, , expiresAt] = (store.set as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, unknown, number];
    expect(expiresAt - Date.now()).toBeLessThanOrEqual(60 * DAY_MS);
  });
});

describe('spend log for "1 per 10 results" endpoints', () => {
  it('logs what the call actually cost when the body says so', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 'success',
        result_count: 25,
        api_calls_cost: 3,
        data: [{ title_number: 'DU000001', class: 'Absolute freehold title' }],
      })
    );

    await getFreeholdTitles('M14 5XY');

    const line = info.mock.calls
      .map((c) => String(c[0]))
      .find((s) => s.includes('/freeholds'));
    expect(line).toContain('+3 credits');
  });
});

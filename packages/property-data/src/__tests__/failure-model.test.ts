import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PropertyDataUnavailableError,
  __clearMemoryCache,
  getEpcByPostcode,
  getEpcByPostcodeResult,
  getFloodRisk,
  runPreflightChecks,
} from '../propertydata';
import { __resetRateLimiter } from '../rate-limiter';
import { setPersistentStore, type PersistentCacheStore } from '../store';

// The bug these lock down: every failure mode collapsed to `null`, and callers
// read `null` as "the register holds nothing for this address". A 429 on
// /energy-efficiency therefore produced `isLowEpc: false` with the reasoning
// line "EPC: no certificate matched on this address", and a 429 on /freeholds
// cleared the short-lease flag — a HIGHER offer on exactly the stock we
// discount, with `PropertySnapshot.errors` empty and source health reporting ok.

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const EPC_BODY = {
  status: 'ok',
  result: {
    properties: [
      { address: '12 Test Street', current_energy_rating: 'F' },
    ],
  },
};

/** Upstream renamed `properties` → `dwellings`. Still passes the all-optional schema. */
const EPC_DRIFT_BODY = {
  status: 'ok',
  result: { dwellings: [{ address: '12 Test Street' }] },
};

const EMPTY_POSTCODE_BODY = { status: 'ok', result: { properties: [] } };

/**
 * Endpoint-aware stub for the four calls runPreflightChecks fans out to. Every
 * one returns a well-formed body that simply holds no records — the case that
 * must NOT read as degraded.
 */
function preflightEmptyResponse(url: string) {
  if (url.includes('/demand')) {
    return jsonResponse({
      status: 'ok',
      result: { sales_demand_score: 50, days_on_market_average: 60 },
    });
  }
  if (url.includes('/growth')) {
    return jsonResponse({ status: 'ok', result: { annual_growth: 0 } });
  }
  return jsonResponse(EMPTY_POSTCODE_BODY);
}

function makeMockStore() {
  const map = new Map<string, { value: unknown; expiresAt: number }>();
  const store: PersistentCacheStore = {
    get: vi.fn(async (key: string) => map.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown, expiresAt: number) => {
      map.set(key, { value, expiresAt });
    }),
    delete: vi.fn(async (key: string) => {
      map.delete(key);
    }),
  };
  return { store, map };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __clearMemoryCache();
  __resetRateLimiter();
  setPersistentStore(null);
  fetchMock = vi.fn(async () => jsonResponse(EPC_BODY));
  vi.stubGlobal('fetch', fetchMock);
  // The drift path logs at error level on purpose; keep the test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  setPersistentStore(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a failed lookup is not an absence', () => {
  it('surfaces a 500 as outcome "failed", not an empty register', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'boom' }, 500));

    const res = await getEpcByPostcodeResult('M14 5XY');

    expect(res.outcome).toBe('failed');
    // The failure branch carries no `value` at all — a caller cannot reach data
    // it does not have without narrowing first.
    expect(res).not.toHaveProperty('value');
  });

  it('throws from the legacy helper rather than returning []', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'boom' }, 500));

    await expect(getEpcByPostcode('M14 5XY')).rejects.toBeInstanceOf(
      PropertyDataUnavailableError,
    );
  });

  it('still returns [] for a genuinely empty postcode', async () => {
    fetchMock.mockResolvedValue(jsonResponse(EMPTY_POSTCODE_BODY));

    await expect(getEpcByPostcode('M14 5XY')).resolves.toEqual([]);
  });

  it('marks the preflight degraded and omits the EPC factor when the lookup fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'rate limited' }, 500));

    const pre = await runPreflightChecks({
      postcode: 'M14 5XY',
      address: '12 Test Street',
    });

    expect(pre.degraded).toBe(true);
    expect(pre.failedSources).toContain('epc');
    expect(pre.failedSources).toContain('tenure');
    expect(pre.epc.status).toBe('unavailable');
    expect(pre.tenure.status).toBe('unavailable');
    // The old behaviour: a confident zero plus a reasoning line that reads like
    // a finding. Both must be gone.
    expect(pre.epc.isLowEpc).toBe(false);
    expect(pre.offerAdjustment).toBe(0);
    expect(pre.reasoning.join('\n')).not.toContain(
      'no certificate matched on this address',
    );
    expect(pre.reasoning.join('\n')).toContain('EPC: lookup UNAVAILABLE');
    expect(pre.reasoning.join('\n')).toContain(
      'short-lease screen NOT performed',
    );
  });

  it('does not mark the preflight degraded when the registers are simply empty', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      preflightEmptyResponse(url),
    );

    const pre = await runPreflightChecks({
      postcode: 'M14 5XY',
      address: '12 Test Street',
    });

    expect(pre.degraded).toBe(false);
    expect(pre.failedSources).toEqual([]);
    expect(pre.epc.status).toBe('ok');
    expect(pre.reasoning.join('\n')).toContain(
      'EPC: no certificate matched on this address',
    );
  });
});

describe('upstream drift is a failure, and is never cached', () => {
  it('rejects a response that validates but carries none of the expected fields', async () => {
    fetchMock.mockResolvedValue(jsonResponse(EPC_DRIFT_BODY));

    const res = await getEpcByPostcodeResult('M14 5XY');

    expect(res.outcome).toBe('failed');
    if (res.outcome === 'failed') {
      expect(res.error).toContain('schema drift');
    }
  });

  it('writes drift to neither cache tier, so the next call re-fetches', async () => {
    const { store, map } = makeMockStore();
    setPersistentStore(store);
    fetchMock.mockResolvedValue(jsonResponse(EPC_DRIFT_BODY));

    await getEpcByPostcodeResult('M14 5XY');
    await Promise.resolve(); // flush any fire-and-forget write

    expect(store.set).not.toHaveBeenCalled();
    expect(map.size).toBe(0);

    // Not memoised either — a 90-day TTL on drift used to poison every instance.
    await getEpcByPostcodeResult('M14 5XY');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('the durable tier revalidates what it serves', () => {
  it('treats a schema-mismatched durable row as a miss and invalidates it', async () => {
    const { store, map } = makeMockStore();
    // A row written by an older code version against an older upstream shape:
    // `rivers_and_sea` used to be numeric. It survives deploys and is shared
    // across instances, and the durable path used to hand it back as `T`.
    const key = '/flood-risk:{"postcode":"M145XY"}';
    map.set(key, {
      value: { status: 'ok', result: { rivers_and_sea: 42 } },
      expiresAt: Date.now() + 60_000,
    });
    setPersistentStore(store);
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'ok', result: { rivers_and_sea: 'Low' } }),
    );

    const res = await getFloodRisk('M14 5XY');

    // Bought fresh instead of served stale-and-wrong.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res?.result?.rivers_and_sea).toBe('Low');
    expect(store.delete).toHaveBeenCalledWith(key);
  });

  it('treats a durable row that validates but is hollow as a miss', async () => {
    const { store, map } = makeMockStore();
    const key = '/flood-risk:{"postcode":"M145XY"}';
    map.set(key, {
      value: { status: 'ok', result: {} },
      expiresAt: Date.now() + 60_000,
    });
    setPersistentStore(store);
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'ok', result: { surface_water: 'Very Low' } }),
    );

    await getFloodRisk('M14 5XY');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.delete).toHaveBeenCalledWith(key);
  });

  it('still serves a durable row that revalidates cleanly', async () => {
    const { store, map } = makeMockStore();
    map.set('/flood-risk:{"postcode":"M145XY"}', {
      value: { status: 'ok', result: { rivers_and_sea: 'High' } },
      expiresAt: Date.now() + 60_000,
    });
    setPersistentStore(store);

    const res = await getFloodRisk('M14 5XY');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res?.result?.rivers_and_sea).toBe('High');
    expect(store.delete).not.toHaveBeenCalled();
  });
});

describe('cache keys are postcode-case-insensitive', () => {
  it('bills "m14 5xy" and "M14 5XY" as one entry, not two', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'ok', result: { rivers_and_sea: 'Low' } }),
    );

    await getFloodRisk('m14 5xy');
    await getFloodRisk('M14 5XY');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

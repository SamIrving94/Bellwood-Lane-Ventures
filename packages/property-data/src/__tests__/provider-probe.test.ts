/**
 * Health probes keep the error the everyday clients swallow. These lock down
 * the line between "the provider answered" (ok, even when empty) and "we
 * could not get an answer" (failing, with the reason). No live network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { probeEpc } from '../epc';
import { probeOsPlaces } from '../os-places';
import { __clearMemoryCache, probePropertyData } from '../propertydata';
import { __resetRateLimiter } from '../rate-limiter';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  __clearMemoryCache();
  __resetRateLimiter();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('probeOsPlaces', () => {
  beforeEach(() => vi.stubEnv('OS_PLACES_API_KEY', 'os-test-key'));

  it('is ok when OS answers', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ header: { totalresults: 4 }, results: [{}] })
    );
    const res = await probeOsPlaces('SW1A 2AA');
    expect(res).toEqual({ ok: true, detail: '4 addresses in SW1A 2AA' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('maxresults=1');
  });

  it('fails with the reason on a rejected key (the 18 Oct 2026 case)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 401));
    expect(await probeOsPlaces('SW1A 2AA')).toEqual({
      ok: false,
      error: 'OS Places: invalid API key',
    });
  });

  it('treats 400 (unknown postcode) as a healthy reply', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 400));
    expect((await probeOsPlaces('ZZ9 9ZZ')).ok).toBe(true);
  });

  it('fails without calling out when no key is set', async () => {
    vi.stubEnv('OS_PLACES_API_KEY', '');
    expect(await probeOsPlaces('SW1A 2AA')).toEqual({
      ok: false,
      error: 'OS_PLACES_API_KEY not set',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('probeEpc', () => {
  beforeEach(() => vi.stubEnv('EPC_API_TOKEN', 'epc-test-token'));

  it('is ok when the register answers', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: [{ certificateNumber: '0000', postcode: 'X' }] })
    );
    const res = await probeEpc('SW1A 2AA');
    expect(res.ok).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toContain('page_size=1');
  });

  it('treats 404 (no certificates) as a healthy reply', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 404));
    expect((await probeEpc('SW1A 2AA')).ok).toBe(true);
  });

  it('fails with the reason on a rejected token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 401));
    expect(await probeEpc('SW1A 2AA')).toEqual({
      ok: false,
      error: 'EPC API: invalid bearer token (EPC_API_TOKEN)',
    });
  });

  it('fails when the network throws', async () => {
    fetchMock.mockRejectedValue(new Error('fetch failed'));
    expect(await probeEpc('SW1A 2AA')).toEqual({
      ok: false,
      error: 'fetch failed',
    });
  });
});

describe('probePropertyData', () => {
  it('reads the free credits endpoint and reports the balance', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'success', result: { credits_remaining: 812 } })
    );
    expect(await probePropertyData()).toEqual({
      ok: true,
      detail: '812 credits remaining',
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/account/credits');
  });

  it('fails with the reason on a rejected key', async () => {
    fetchMock.mockResolvedValue(
      new Response('Invalid API key', { status: 401 })
    );
    const res = await probePropertyData();
    expect(res.ok).toBe(false);
  });
});

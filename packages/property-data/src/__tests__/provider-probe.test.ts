/**
 * Health probes keep the error the everyday clients swallow. These lock down
 * the line between "the provider answered" (ok, even when empty) and "we
 * could not get an answer" (failing, with the reason). No live network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { probeEpc } from '../epc';
import {
  __clearMemoryCache,
  probePostcodeUprns,
  probePropertyData,
} from '../propertydata';
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

describe('probePostcodeUprns', () => {
  it('is healthy when PropertyData returns homes', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 'success',
        data: [
          { uprn: 1, address: '1 A Road', classificationCode: 'RD04' },
          { uprn: 2, address: 'Shop', classificationCode: 'CR08' },
        ],
      })
    );
    expect(await probePostcodeUprns('SW6 3EF')).toEqual({
      ok: true,
      detail: '1 homes in SW6 3EF',
    });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/uprns');
    expect(url).toContain('results=20');
  });

  it('does not share the 60-day cache, so every run really calls out', async () => {
    const body = {
      status: 'success',
      data: [{ uprn: 1, address: '1 A Road', classificationCode: 'RD04' }],
    };
    fetchMock.mockImplementation(async () => jsonResponse(body));
    await probePostcodeUprns('SW6 3EF');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 2 * 60 * 1000);
    await probePostcodeUprns('SW6 3EF');
    vi.useRealTimers();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails when the answer holds no homes', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 'success',
        data: [{ uprn: 2, address: 'Shop', classificationCode: 'CR08' }],
      })
    );
    expect((await probePostcodeUprns('SW6 3EF')).ok).toBe(false);
  });

  it('fails with the reason on a rejected key', async () => {
    fetchMock.mockResolvedValue(
      new Response('Invalid API key', { status: 401 })
    );
    const res = await probePostcodeUprns('SW6 3EF');
    expect(res.ok).toBe(false);
  });
});

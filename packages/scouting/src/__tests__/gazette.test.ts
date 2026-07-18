/**
 * Gazette probate source — resilience + visibility contract.
 *
 * These lock the two behaviours we added after a silent HTTP-500 skip let the
 * scout run to 0 leads without raising an alert:
 *   1. Requests carry a descriptive User-Agent (the gov WAF 5xx's UA-less bots).
 *   2. Transient 5xx are retried; a persistent LIST failure THROWS so the
 *      scouting pipeline records sourceErrors.gazette and alerts the founder —
 *      it must never silently return [].
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGazetteProbateNotices } from '../gazette';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('fetchGazetteProbateNotices — resilience', () => {
  it('sends a descriptive User-Agent on the list request', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { entry: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchGazetteProbateNotices(30, 10);

    expect(fetchMock).toHaveBeenCalled();
    const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = firstCall[1].headers as Record<string, string>;
    expect(headers['User-Agent']).toMatch(/Bellwood/i);
  });

  it('retries a transient 5xx and then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, null))
      .mockResolvedValueOnce(jsonResponse(200, { entry: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const leads = await fetchGazetteProbateNotices(30, 10);

    expect(leads).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('THROWS on a persistent list HTTP failure (never silently returns [])', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(500, null));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchGazetteProbateNotices(30, 10)).rejects.toThrow(/HTTP 500/);
    // 3 attempts before giving up.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('THROWS on a persistent network error', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchGazetteProbateNotices(30, 10)).rejects.toThrow(/ECONNRESET/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

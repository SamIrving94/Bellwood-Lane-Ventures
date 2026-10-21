/**
 * PropertyData refuses a /sourced-properties call with more than five lists
 * ("Too many lists: maximum 5 per request", code 1108). Market signals asked
 * for seven in one call, so every valuation got none (seen 21 Oct 2026).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __clearMemoryCache, getSubjectMarketSignals } from '../propertydata';
import { __resetRateLimiter } from '../rate-limiter';
import { setPersistentStore } from '../store';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __clearMemoryCache();
  __resetRateLimiter();
  setPersistentStore(null);
  fetchMock = vi.fn(async (url: string) => {
    const lists = new URL(url).searchParams.get('list')?.split(',') ?? [];
    if (lists.length > 5) {
      return json(
        { status: 'error', code: '1108', message: 'Too many lists' },
        422
      );
    }
    return json({ status: 'success', properties: [] });
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getSubjectMarketSignals', () => {
  it('asks for the seven lists in calls of at most five', async () => {
    await expect(
      getSubjectMarketSignals({ postcode: 'SE13 5EY' })
    ).resolves.toBeDefined();
    const asked = fetchMock.mock.calls.map(
      (c) => new URL(String(c[0])).searchParams.get('list')?.split(',') ?? []
    );
    expect(asked.every((l) => l.length <= 5)).toBe(true);
    expect(asked.flat()).toHaveLength(7);
  });

  it('still answers when one chunk fails', async () => {
    let calls = 0;
    fetchMock.mockImplementation(async () => {
      calls++;
      return calls === 1
        ? new Response('busy', { status: 500 })
        : json({ status: 'success', properties: [] });
    });
    await expect(
      getSubjectMarketSignals({ postcode: 'SE13 5EY' })
    ).resolves.toBeDefined();
  });

  it('fails loudly when every chunk fails', async () => {
    fetchMock.mockImplementation(
      async () => new Response('down', { status: 500 })
    );
    await expect(
      getSubjectMarketSignals({ postcode: 'SE13 5EY' })
    ).rejects.toBeDefined();
  });
});

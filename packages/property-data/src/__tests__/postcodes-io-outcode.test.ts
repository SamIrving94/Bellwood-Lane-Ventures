/**
 * Outcode resolution — the plumbing that replaced the `"<DISTRICT> 1AA"`
 * fabrication in the scouting area-add flow (the SW3 incident).
 *
 * The caching contract is the point of most of these tests: a 404 is a fact
 * about the outcode and is cached, a 500/timeout is a fact about the network
 * and must NOT be cached, or a blip becomes a 30-day outage for that
 * district.
 *
 * The module cache is module-level and persists across tests in this file,
 * so every test uses its own outcode.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupOutcode, seedPostcodeForOutcode } from '../postcodes-io';

type Handler = (url: string) => Response | Promise<Response>;

let handler: Handler;
let calls: string[];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  calls = [];
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return handler(url);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('lookupOutcode', () => {
  it('resolves a real outcode to its centroid', async () => {
    handler = () =>
      json(200, { result: { latitude: 51.489, longitude: -0.166 } });
    const r = await lookupOutcode('AB10');
    expect(r).toEqual({
      outcome: 'found',
      centroid: { latitude: 51.489, longitude: -0.166 },
    });
  });

  it('caches a 404 negative — ZZ99 will not exist tomorrow either', async () => {
    handler = () => json(404, { status: 404, error: 'Outcode not found' });
    expect(await lookupOutcode('ZZ98')).toEqual({ outcome: 'not-found' });
    expect(await lookupOutcode('ZZ98')).toEqual({ outcome: 'not-found' });
    expect(calls.length).toBe(1);
  });

  it('does NOT cache a 500 — the next attempt must retry the network', async () => {
    let status = 500;
    handler = () =>
      status === 500
        ? json(500, { error: 'boom' })
        : json(200, { result: { latitude: 1, longitude: 2 } });
    expect(await lookupOutcode('AB11')).toEqual({ outcome: 'unavailable' });
    status = 200;
    expect(await lookupOutcode('AB11')).toEqual({
      outcome: 'found',
      centroid: { latitude: 1, longitude: 2 },
    });
    expect(calls.length).toBe(2);
  });

  it('treats a network error as unavailable, not not-found', async () => {
    handler = () => {
      throw new Error('ECONNRESET');
    };
    expect(await lookupOutcode('AB12')).toEqual({ outcome: 'unavailable' });
  });
});

describe('seedPostcodeForOutcode', () => {
  it('returns the first reverse-geocoded postcode IN the requested district', async () => {
    handler = (url) => {
      if (url.includes('/outcodes/'))
        return json(200, { result: { latitude: 51.55, longitude: -0.1 } });
      // Boundary case: the nearest postcode belongs to the NEIGHBOURING
      // district. The N5 hit must be skipped in favour of the N4 one.
      return json(200, {
        result: [
          { postcode: 'N5 2QA', outcode: 'N5' },
          { postcode: 'N4 1BH', outcode: 'N4' },
        ],
      });
    };
    const r = await seedPostcodeForOutcode('N4');
    expect(r).toEqual({ outcome: 'found', postcode: 'N4 1BH' });
  });

  it('widens the radius when the centroid sits on postcode-free ground', async () => {
    // The N4/NW5 lesson: centroids in parks return an empty first pass.
    handler = (url) => {
      if (url.includes('/outcodes/'))
        return json(200, { result: { latitude: 51.55, longitude: -0.09 } });
      if (url.includes('radius=1000')) return json(200, { result: null });
      return json(200, {
        result: [{ postcode: 'NW5 3EW', outcode: 'NW5' }],
      });
    };
    const r = await seedPostcodeForOutcode('NW5');
    expect(r).toEqual({ outcome: 'found', postcode: 'NW5 3EW' });
    expect(calls.filter((u) => u.includes('radius=')).length).toBe(2);
  });

  it('falls back to the sector scan when reverse geocoding drowns in a dense city centre', async () => {
    // The B2 case: both radius passes return only NEIGHBOURING districts,
    // because central Birmingham fills the result cap before any B2
    // postcode appears. The sector scan must find B2 2AB — and must skip
    // the B21/B23 pollution the text search returns for other sectors.
    handler = (url) => {
      if (url.includes('/outcodes/'))
        return json(200, { result: { latitude: 52.487, longitude: -1.897 } });
      if (url.includes('radius='))
        return json(200, {
          result: [{ postcode: 'B1 2EP', outcode: 'B1' }],
        });
      // text search: sector 2 has real B2 hits, everything else pollutes
      if (url.includes(encodeURIComponent('B2 2')))
        return json(200, { result: [{ postcode: 'B2 2AB' }] });
      return json(200, { result: [{ postcode: 'B21 0AB' }] });
    };
    const r = await seedPostcodeForOutcode('B2');
    expect(r).toEqual({ outcome: 'found', postcode: 'B2 2AB' });
  });

  it('propagates not-found for a nonexistent district — never fabricates', async () => {
    handler = () => json(404, { status: 404, error: 'Outcode not found' });
    expect(await seedPostcodeForOutcode('ZZ97')).toEqual({
      outcome: 'not-found',
    });
  });

  it('propagates unavailable when the reverse geocode fails', async () => {
    handler = (url) => {
      if (url.includes('/outcodes/'))
        return json(200, { result: { latitude: 51.5, longitude: -0.1 } });
      return json(500, { error: 'boom' });
    };
    expect(await seedPostcodeForOutcode('AB13')).toEqual({
      outcome: 'unavailable',
    });
  });
});

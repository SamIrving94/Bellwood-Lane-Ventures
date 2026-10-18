/**
 * PropertyData /uprns as the UPRN matcher's second source (Oct 2026, replacing
 * OS Places). The body below is trimmed from a real response for SW6 3EF
 * (The Piper Building): homes, the block's own "Property Shell" row, and the
 * offices on its ground floor. Only the homes may ever be matched.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __clearMemoryCache, getPostcodeUprnsResult } from '../propertydata';
import { __resetRateLimiter } from '../rate-limiter';
import { setPersistentStore } from '../store';
import { resolveUprn } from '../uprn';

const row = (uprn: number, address: string, code: string, desc: string) => ({
  uprn,
  address,
  addressParts: {},
  lat: '51.46595360',
  lng: '-0.19314730',
  classificationCode: code,
  classificationCodeDesc: desc,
});

const SW6_3EF = {
  status: 'success',
  postcode: 'SW6 3EF',
  strict_postcode_mode: true,
  api_calls_cost: 9,
  data: [
    row(
      34063172,
      '39, THE PIPER BUILDING, PETERBOROUGH ROAD, LONDON, SW6 3EF',
      'RD06',
      'Flat'
    ),
    row(
      34063189,
      '56, THE PIPER BUILDING, PETERBOROUGH ROAD, LONDON, SW6 3EF',
      'RD06',
      'Flat'
    ),
    row(
      34063133,
      'THE PIPER BUILDING, PETERBOROUGH ROAD, LONDON, SW6 3EF',
      'PP',
      'Property Shell'
    ),
    row(
      34063140,
      'UNIT 3, THE PIPER BUILDING, PETERBOROUGH ROAD, LONDON, SW6 3EF',
      'CO01',
      'Office / Work Studio'
    ),
    row(
      34063150,
      '57, THE PIPER BUILDING, PETERBOROUGH ROAD, LONDON, SW6 3EF',
      'CH02',
      'Holiday Let'
    ),
  ],
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __clearMemoryCache();
  __resetRateLimiter();
  setPersistentStore(null);
  fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(SW6_3EF), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
  );
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getPostcodeUprnsResult', () => {
  it('keeps the homes (holiday lets too) and drops the block shell and the offices', async () => {
    const r = await getPostcodeUprnsResult('SW6 3EF');
    expect(r.outcome).toBe('ok');
    expect(r.outcome === 'ok' && r.value.map((h) => h.uprn)).toEqual([
      '34063172',
      '34063189',
      '34063150',
    ]);
  });

  it('asks for this postcode only, with the full 200-home page', async () => {
    await getPostcodeUprnsResult('SW6 3EF');
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.pathname).toBe('/uprns');
    expect(url.searchParams.get('strict')).toBe('true');
    expect(url.searchParams.get('results')).toBe('200');
    // The key travels in the Authorization header, never the URL.
    expect(url.searchParams.has('key')).toBe(false);
  });

  it('a failed call is a failure, not an empty postcode', async () => {
    fetchMock.mockResolvedValueOnce(new Response('busy', { status: 500 }));
    const r = await getPostcodeUprnsResult('SW6 3EF');
    expect(r.outcome).toBe('failed');
  });
});

describe('resolveUprn with PropertyData as the second source', () => {
  const epcFlat39 = [
    {
      uprn: '34063172',
      address: 'Flat 39, The Piper Building, Peterborough Road',
    },
  ];

  it('EPC and PropertyData agree on flat 39: high', async () => {
    const r = await resolveUprn(
      {
        address: '39, THE PIPER BUILDING, PETERBOROUGH ROAD, LONDON',
        postcode: 'SW6 3EF',
      },
      {
        epc: async () => epcFlat39,
        addresses: async () =>
          await getPostcodeUprnsResult('SW6 3EF').then((x) =>
            x.outcome === 'ok' ? x.value : null
          ),
      }
    );
    expect(r).toEqual({
      uprn: '34063172',
      confidence: 'high',
      sources: ['epc', 'propertydata'],
      reason: null,
    });
  });

  it('a lead naming only the block never gets the block shell', async () => {
    const r = await resolveUprn(
      {
        address: 'The Piper Building, Peterborough Road, London',
        postcode: 'SW6 3EF',
      },
      {
        epc: async () => [],
        addresses: async () =>
          await getPostcodeUprnsResult('SW6 3EF').then((x) =>
            x.outcome === 'ok' ? x.value : null
          ),
      }
    );
    expect(r.uprn).toBeNull();
  });

  it('PropertyData down, EPC matches: medium, from EPC alone', async () => {
    const r = await resolveUprn(
      {
        address: '39, THE PIPER BUILDING, PETERBOROUGH ROAD, LONDON',
        postcode: 'SW6 3EF',
      },
      { epc: async () => epcFlat39, addresses: async () => null }
    );
    expect(r).toMatchObject({
      uprn: '34063172',
      confidence: 'medium',
      sources: ['epc'],
    });
  });
});

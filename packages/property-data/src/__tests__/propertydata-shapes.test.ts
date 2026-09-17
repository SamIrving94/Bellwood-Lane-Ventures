import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __clearMemoryCache,
  getAgentsByPostcode,
  getCouncilTax,
  getEpcByPostcode,
  getFloodRisk,
  getFloorAreaRows,
  getFreeholdTitles,
  getGrowth,
  getMarketDemand,
  getMarketDemandResult,
  getPricesPerSqf,
  getPropertyFloorArea,
  getSoldPrices,
  getTenureByPostcode,
  getTenureByPostcodeResult,
  getYields,
  runPreflightChecks,
  topSaleAgents,
} from '../propertydata';
import { __resetRateLimiter } from '../rate-limiter';
import { type PersistentCacheStore, setPersistentStore } from '../store';
import {
  LEGACY_RESULT_SHAPE_BODY,
  fixtureFor,
} from './fixtures/propertydata-responses';

// One test per endpoint, each feeding the SAVED real response (see the fixtures
// module) through its getter and asserting the typed reading. These are the
// contract: the eleven schemas rewritten on 2026-09-13 read only fields that
// exist in these bodies. If PropertyData changes shape, re-probe and replace
// the fixture — never edit it to make a test pass.

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __clearMemoryCache();
  __resetRateLimiter();
  setPersistentStore(null);
  fetchMock = vi.fn(async (url: string) => jsonResponse(fixtureFor(url)));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  setPersistentStore(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('/demand', () => {
  it('reads the top-level rating and days on market', async () => {
    const d = await getMarketDemand('DL2 3JP');
    expect(d).toEqual({
      demandRating: 'Balanced market',
      daysOnMarket: 277,
      totalForSale: 19,
      averageSalesPerMonth: 2,
      turnoverPerMonthPct: 11,
      monthsOfInventory: 9.1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('/flood-risk', () => {
  it('reads the single top-level flood_risk band', async () => {
    await expect(getFloodRisk('DL2 3JP')).resolves.toEqual({
      floodRisk: 'Very Low',
    });
  });
});

describe('/agents', () => {
  it('flattens the per-portal sale and rent rankings', async () => {
    const rows = await getAgentsByPostcode('DL2 3JP');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({
      name: 'Hunters',
      portal: 'zoopla.co.uk',
      market: 'sale',
      rank: 1,
      branches: ['Bishop Auckland'],
      unitsOffered: 6,
      totalValue: 982500,
      averageValue: 123125,
    });
    expect(rows.find((r) => r.market === 'rent')?.name).toBe('Bridgfords');
  });

  it('collapses the same brand across portals, taking the larger units figure', () => {
    return getAgentsByPostcode('DL2 3JP').then((rows) => {
      const top = topSaleAgents(rows);
      expect(top.map((a) => a.name)).toEqual(['Hunters', 'Bridgfords']);
      // Hunters: 6 on Zoopla, 3 on OTM → 6, not 9 (syndicated stock).
      expect(top[0]).toEqual({
        name: 'Hunters',
        branches: ['Bishop Auckland', 'Darlington'],
        unitsOffered: 6,
      });
      expect(topSaleAgents(rows, 1)).toHaveLength(1);
    });
  });
});

describe('/sold-prices', () => {
  it('reads data.average and data.raw_data, in pence, with the postcode lifted off the address', async () => {
    const sold = await getSoldPrices('DL2 3JP', { maxAgeMonths: 18 });
    expect(sold?.averagePricePence).toBe(19_715_000);
    expect(sold?.medianPricePence).toBeNull();
    expect(sold?.transactions).toHaveLength(3);
    expect(sold?.transactions[0]).toEqual({
      address: '48, Redacted Green, Staindrop, DL2 3LD',
      postcode: 'DL2 3LD',
      pricePence: 24_000_000,
      date: '2025-06-27',
      propertyType: 'terraced_house',
      tenure: 'freehold',
      lat: 54.5795656,
      lng: -1.8089884,
      bedrooms: 3,
      distanceMiles: 0.03,
    });
    // A null bedrooms count is a real value on this endpoint, not a drop.
    expect(sold?.transactions[1]?.bedrooms).toBeNull();
    expect(sold?.transactions[1]?.postcode).toBe('DL2 3NH');
  });
});

describe('/yields', () => {
  it('parses the long-let gross yield percent string', async () => {
    await expect(getYields('DL2 3JP')).resolves.toEqual({
      averageYieldPct: 2.8,
      lowYieldPct: null,
      highYieldPct: null,
    });
  });
});

describe('/growth', () => {
  it('reads the yearly tuple series and derives 12-month and 5-year change', async () => {
    const g = await getGrowth('DL2 3JP');
    expect(g?.series).toHaveLength(7);
    expect(g?.series[0]).toEqual({
      label: 'Sep 2020',
      averagePricePence: 21_437_300,
      growthPct: null,
    });
    expect(g?.annualGrowthPct).toBe(-3.9);
    // Sep 2021 → Sep 2026: 231,365 → 240,040.
    expect(g?.fiveYearGrowthPct).toBe(3.7);
    expect(g?.forecastGrowthPct).toBeNull();
    expect(g?.forecastPeriodMonths).toBeNull();
  });
});

describe('/council-tax', () => {
  it('parses the band table (pound strings) and per-address bands', async () => {
    const ct = await getCouncilTax('DL2 3JP');
    expect(ct?.council).toBe('Durham');
    expect(ct?.year).toBe('2026/27');
    expect(ct?.bandsByLetter).toEqual({
      A: 1748.1,
      B: 2039.45,
      C: 2330.8,
      D: 2622.15,
      E: 3204.85,
      F: 3787.55,
      G: 4370.25,
      H: 5244.3,
    });
    expect(ct?.propertyBands).toEqual([
      { address: 'REDACTED 38, NORTH GREEN, STAINDROP, DARLINGTON', band: 'B' },
      { address: '40, NORTH GREEN, STAINDROP, DARLINGTON', band: 'C' },
    ]);
    expect(ct?.averageAnnualBill).toBeNull();
    expect(ct?.band).toBeNull();
  });
});

describe('/floor-areas', () => {
  it('converts square_feet to m² and keeps habitable rooms', async () => {
    const rows = await getFloorAreaRows('DL2 3JP');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      address: '34a Redacted Green, Staindrop',
      floorAreaSqm: 112, // 1206 sq ft × 0.09290304 = 112.04
      bedrooms: null,
      propertyType: null,
      habitableRooms: 6,
      inspectionDate: '2025-04-09T23:00:00.000000Z',
    });
    expect(rows[1]?.floorAreaSqm).toBe(80); // 861 sq ft = 79.99 m²
  });

  it('resolves one property by house number, and refuses to guess without one', async () => {
    await expect(
      getPropertyFloorArea({ postcode: 'DL2 3JP', address: '34A North Green' })
    ).resolves.toEqual({
      floorAreaSqm: 112,
      matchedAddress: '34a Redacted Green, Staindrop',
      matchSource: 'house_number',
    });
    // Street-only address: the register has no type/bedrooms to match on.
    await expect(
      getPropertyFloorArea({
        postcode: 'DL2 3JP',
        address: 'North Green',
        propertyType: 'terraced',
        bedrooms: 3,
      })
    ).resolves.toBeNull();
    // Numbered but not in the register.
    await expect(
      getPropertyFloorArea({ postcode: 'DL2 3JP', address: '99 North Green' })
    ).resolves.toBeNull();
  });
});

describe('/prices-per-sqf', () => {
  it('reads data.average as £/sqft', async () => {
    await expect(getPricesPerSqf('DL2 3JP')).resolves.toEqual({
      averagePerSqft: 210,
      medianPerSqft: null,
      pointsAnalysed: 20,
    });
  });
});

describe('/freeholds', () => {
  it('reads the freehold titles and their polygon leasehold counts', async () => {
    const titles = await getFreeholdTitles('DL2 3JP');
    expect(titles).toHaveLength(2);
    expect(titles[0]).toEqual({
      titleNumber: 'DU221229',
      titleClass: 'Absolute freehold title',
      polygons: [
        {
          lat: 54.580011441809,
          lng: -1.8092848843038,
          distanceMiles: 0,
          leaseholds: 0,
        },
      ],
    });
    expect(titles[1]?.polygons[0]?.leaseholds).toBe(3);
  });

  it('reports per-address tenure as unavailable without spending a call', async () => {
    const res = await getTenureByPostcodeResult('DL2 3JP');
    expect(res.outcome).toBe('failed');
    if (res.outcome === 'failed') {
      expect(res.error).toContain('no per-address tenure');
    }
    await expect(getTenureByPostcode('DL2 3JP')).rejects.toThrow(
      /no per-address tenure/
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('/energy-efficiency', () => {
  it('reads the top-level energy_efficiency rows', async () => {
    const rows = await getEpcByPostcode('DL2 3JP');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      address: '34a Redacted Green, Staindrop',
      rating: 'C',
      efficiency: 70,
      potentialRating: null,
      propertyType: null,
      inspectionDate: '2025-04-09T23:00:00.000000Z',
    });
  });
});

describe('preflight on the real shapes', () => {
  it('scores EPC, demand and growth; only tenure is unavailable', async () => {
    const pre = await runPreflightChecks({
      postcode: 'DL2 3JP',
      address: '34a Redacted Green',
    });
    expect(pre.failedSources).toEqual(['tenure']);
    expect(pre.epc.status).toBe('ok');
    expect(pre.epc.rating).toBe('C');
    expect(pre.marketTemperature.status).toBe('ok');
    expect(pre.marketTemperature.demandScore).toBeNull();
    expect(pre.marketTemperature.demandRating).toBe('Balanced market');
    expect(pre.marketTemperature.daysOnMarketAvg).toBe(277);
    expect(pre.marketTemperature.annualGrowthPct).toBe(-3.9);
    // −3.9% / 10 → −0.39 → 'cool' → −2% on the offer.
    expect(pre.marketTemperature.band).toBe('cool');
    expect(pre.offerAdjustment).toBe(-0.02);
    expect(pre.reasoning.join('\n')).toContain(
      'Market: cool (balanced market, 277 days on market), 12-month change -3.9%'
    );
    expect(pre.reasoning.join('\n')).toContain(
      'short-lease screen NOT performed'
    );
  });
});

describe('drift guard', () => {
  it('still rejects the old result-wrapped shape and never caches it', async () => {
    const map = new Map<string, { value: unknown; expiresAt: number }>();
    const store: PersistentCacheStore = {
      get: vi.fn(async (key: string) => map.get(key) ?? null),
      set: vi.fn(async (key: string, value: unknown, expiresAt: number) => {
        map.set(key, { value, expiresAt });
      }),
    };
    setPersistentStore(store);
    fetchMock.mockResolvedValue(jsonResponse(LEGACY_RESULT_SHAPE_BODY));

    const res = await getMarketDemandResult('DL2 3JP');

    expect(res.outcome).toBe('failed');
    if (res.outcome === 'failed') {
      expect(res.error).toContain('schema drift');
    }
    await Promise.resolve();
    expect(store.set).not.toHaveBeenCalled();
    expect(map.size).toBe(0);
    await getMarketDemandResult('DL2 3JP');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

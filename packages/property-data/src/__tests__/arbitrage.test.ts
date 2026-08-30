/**
 * Refurb-arbitrage model tests (arbitrage.ts + the EPC search-row parser).
 *
 * The matcher tests are the load-bearing ones: this model's stated contract
 * is precision over recall (a wrong pair silently poisons a median), so most
 * cases here assert that a plausible-but-uncertain match is REJECTED.
 *
 * SPARQL fixture shape mirrors the standard W3C SPARQL JSON results format
 * served by landregistry.data.gov.uk/landregistry/query. No live network.
 */

import { describe, expect, it } from 'vitest';
import {
  type SoldSale,
  buildDistrictSalesQuery,
  conditionProxyFromBand,
  isArbitrageHouse,
  matchSaleToEpcRow,
  median,
  parseSparqlSales,
  poundsPerSqft,
  primaryDesignator,
  summariseDistrictArbitrage,
} from '../arbitrage';
import { type EpcSearchRow, parseDomesticSearchRows } from '../epc';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sale(overrides: Partial<SoldSale> = {}): SoldSale {
  return {
    pricePounds: 950_000,
    date: '2026-03-14',
    paon: '12',
    saon: null,
    street: 'ACACIA ROAD',
    postcode: 'SE22 8EW',
    propertyType: 'terraced',
    newBuild: false,
    ...overrides,
  };
}

function epcRow(overrides: Partial<EpcSearchRow> = {}): EpcSearchRow {
  return {
    certificateNumber: '0000-1111-2222-3333-4444',
    address: '12 Acacia Road',
    postcode: 'SE22 8EW',
    band: 'F',
    registrationDate: '2024-05-01',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SPARQL query builder
// ---------------------------------------------------------------------------

describe('buildDistrictSalesQuery', () => {
  it('binds the district prefix with a trailing space so SE2 never swallows SE22', () => {
    const q = buildDistrictSalesQuery('SE2', '2024-08-29');
    expect(q).toContain('STRSTARTS(?postcode, "SE2 ")');
    expect(q).not.toContain('"SE2")');
  });

  it('restricts to standard (category A) transactions', () => {
    expect(buildDistrictSalesQuery('W11', '2024-01-01')).toContain(
      'standardPricePaidTransaction'
    );
  });

  it('rejects non-district and non-ISO inputs rather than interpolating them', () => {
    expect(() => buildDistrictSalesQuery('SE22 8EW', '2024-01-01')).toThrow();
    expect(() => buildDistrictSalesQuery('"} UNION', '2024-01-01')).toThrow();
    expect(() => buildDistrictSalesQuery('SE22', 'last year')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// SPARQL result parsing
// ---------------------------------------------------------------------------

describe('parseSparqlSales', () => {
  const fixture = {
    head: { vars: ['amount', 'date', 'paon', 'street', 'postcode', 'ptype'] },
    results: {
      bindings: [
        {
          amount: { type: 'literal', value: '950000' },
          date: { type: 'literal', value: '2026-03-14' },
          paon: { type: 'literal', value: '12' },
          street: { type: 'literal', value: 'ACACIA ROAD' },
          postcode: { type: 'literal', value: 'SE22 8EW' },
          ptype: {
            type: 'uri',
            value: 'http://landregistry.data.gov.uk/def/common/terraced',
          },
          newBuild: { type: 'literal', value: 'false' },
        },
        {
          amount: { type: 'literal', value: '410000' },
          date: { type: 'literal', value: '2025-11-02' },
          paon: { type: 'literal', value: '7' },
          saon: { type: 'literal', value: 'FLAT 2' },
          street: { type: 'literal', value: 'ACACIA ROAD' },
          postcode: { type: 'literal', value: 'SE22 8EW' },
          ptype: {
            type: 'uri',
            value: 'http://landregistry.data.gov.uk/def/common/flat-maisonette',
          },
        },
        // Unusable: no price — dropped, not defaulted.
        {
          date: { type: 'literal', value: '2025-01-01' },
          postcode: { type: 'literal', value: 'SE22 8EW' },
        },
      ],
    },
  };

  it('flattens bindings, maps property-type URIs and drops unusable rows', () => {
    const sales = parseSparqlSales(fixture);
    expect(sales).toHaveLength(2);
    expect(sales[0]).toMatchObject({
      pricePounds: 950_000,
      date: '2026-03-14',
      paon: '12',
      propertyType: 'terraced',
      newBuild: false,
    });
    expect(sales[1]).toMatchObject({
      saon: 'FLAT 2',
      propertyType: 'flat-maisonette',
    });
  });

  it('returns [] for malformed bodies', () => {
    expect(parseSparqlSales(null)).toEqual([]);
    expect(parseSparqlSales({ results: {} })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// House filter
// ---------------------------------------------------------------------------

describe('isArbitrageHouse', () => {
  it('keeps second-hand D/S/T houses', () => {
    expect(isArbitrageHouse(sale())).toBe(true);
    expect(isArbitrageHouse(sale({ propertyType: 'detached' }))).toBe(true);
  });

  it('rejects flats, sub-units and new builds', () => {
    expect(isArbitrageHouse(sale({ propertyType: 'flat-maisonette' }))).toBe(
      false
    );
    expect(isArbitrageHouse(sale({ saon: 'FLAT 1' }))).toBe(false);
    expect(isArbitrageHouse(sale({ newBuild: true }))).toBe(false);
    expect(isArbitrageHouse(sale({ propertyType: 'other' }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Designators + matching (the precision contract)
// ---------------------------------------------------------------------------

describe('primaryDesignator', () => {
  it('reads number tokens, with suffix letters', () => {
    expect(primaryDesignator('12')).toEqual({ kind: 'number', token: '12' });
    expect(primaryDesignator('12a')).toEqual({ kind: 'number', token: '12A' });
  });

  it('reads house names', () => {
    expect(primaryDesignator('Rose Cottage')).toEqual({
      kind: 'name',
      token: 'ROSE COTTAGE',
    });
  });

  it('refuses ranges and ambiguous shapes rather than guessing', () => {
    expect(primaryDesignator('12 - 14')).toBeNull();
    expect(primaryDesignator('12-14')).toBeNull();
    expect(primaryDesignator('12 TO 14')).toBeNull();
    expect(primaryDesignator('ROSE COTTAGE 3')).toBeNull();
    expect(primaryDesignator(null)).toBeNull();
    expect(primaryDesignator('')).toBeNull();
  });
});

describe('matchSaleToEpcRow', () => {
  it('matches a plain numbered house with street evidence', () => {
    const row = matchSaleToEpcRow(sale(), [
      epcRow({ address: '12, Acacia Road' }),
    ]);
    expect(row?.certificateNumber).toBe('0000-1111-2222-3333-4444');
  });

  it('never lets 12 match 12A, 112 or 120', () => {
    const rows = [
      epcRow({ address: '12A Acacia Road', certificateNumber: 'A' }),
      epcRow({ address: '112 Acacia Road', certificateNumber: 'B' }),
      epcRow({ address: '120 Acacia Road', certificateNumber: 'C' }),
    ];
    expect(matchSaleToEpcRow(sale({ paon: '12' }), rows)).toBeNull();
  });

  it('never pairs a house sale with a flat certificate at the same number', () => {
    const rows = [
      epcRow({ address: 'Flat 1, 12 Acacia Road', certificateNumber: 'F' }),
    ];
    expect(matchSaleToEpcRow(sale(), rows)).toBeNull();
  });

  it('requires distinctive street evidence when the sale has a street', () => {
    const rows = [epcRow({ address: '12 Bellamy Grove' })];
    expect(matchSaleToEpcRow(sale({ street: 'ACACIA ROAD' }), rows)).toBeNull();
  });

  it('matches house names in full', () => {
    const rows = [
      epcRow({ address: 'Rose Cottage, Acacia Road', certificateNumber: 'N' }),
    ];
    const hit = matchSaleToEpcRow(sale({ paon: 'ROSE COTTAGE' }), rows);
    expect(hit?.certificateNumber).toBe('N');
  });

  it('prefers the most recently registered certificate on a tie', () => {
    const rows = [
      epcRow({ certificateNumber: 'OLD', registrationDate: '2012-01-01' }),
      epcRow({ certificateNumber: 'NEW', registrationDate: '2025-06-01' }),
    ];
    expect(matchSaleToEpcRow(sale(), rows)?.certificateNumber).toBe('NEW');
  });

  it('returns null for range PAONs — a range to one certificate is a guess', () => {
    expect(matchSaleToEpcRow(sale({ paon: '12-14' }), [epcRow()])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Condition proxy + statistics
// ---------------------------------------------------------------------------

describe('conditionProxyFromBand', () => {
  it('maps F/G to unmodernised and A–C to refurbished', () => {
    expect(conditionProxyFromBand('G')).toBe('unmodernised');
    expect(conditionProxyFromBand('f')).toBe('unmodernised');
    expect(conditionProxyFromBand('A')).toBe('refurbished');
    expect(conditionProxyFromBand('c')).toBe('refurbished');
  });

  it('excludes ambiguous D/E and unknowns rather than forcing a side', () => {
    expect(conditionProxyFromBand('D')).toBeNull();
    expect(conditionProxyFromBand('E')).toBeNull();
    expect(conditionProxyFromBand(null)).toBeNull();
    expect(conditionProxyFromBand('Z')).toBeNull();
  });
});

describe('median / poundsPerSqft', () => {
  it('computes odd and even medians', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('converts sqm to sqft pricing', () => {
    // £1,076,390 over 100 sqm = £1,000/sqft (100 sqm = 1076.39 sqft).
    expect(poundsPerSqft(1_076_390, 100)).toBeCloseTo(1000, 0);
  });
});

describe('summariseDistrictArbitrage', () => {
  const pair = (band: string, pricePounds: number, floorAreaSqm = 100) => ({
    pricePounds,
    date: '2026-01-01',
    floorAreaSqm,
    band,
    epcAddress: 'x',
  });

  it('reports a measured spread when both sides clear the sample floor', () => {
    const pairs = [
      ...Array.from({ length: 5 }, () => pair('F', 700_000)),
      ...Array.from({ length: 5 }, () => pair('B', 1_100_000)),
    ];
    const r = summariseDistrictArbitrage('se22', 40, pairs);
    expect(r.district).toBe('SE22');
    expect(r.confidence).toBe('measured');
    expect(r.unmodernised.n).toBe(5);
    expect(r.refurbished.n).toBe(5);
    expect(r.spreadPoundsPerSqft).toBe(
      (r.refurbished.medianPoundsPerSqft ?? 0) -
        (r.unmodernised.medianPoundsPerSqft ?? 0)
    );
    expect(r.spreadPct).toBeGreaterThan(0);
  });

  it('reports insufficient below the floor instead of ranking thin evidence', () => {
    const pairs = [
      ...Array.from({ length: 4 }, () => pair('F', 700_000)),
      ...Array.from({ length: 9 }, () => pair('B', 1_100_000)),
    ];
    const r = summariseDistrictArbitrage('SE22', 40, pairs);
    expect(r.confidence).toBe('insufficient');
    expect(r.spreadPoundsPerSqft).toBeNull();
    expect(r.spreadPct).toBeNull();
  });

  it('drops D/E pairs and out-of-bounds areas/prices from the usable set', () => {
    const pairs = [
      pair('D', 800_000), // ambiguous band
      pair('F', 700_000, 10), // implausible floor area
      pair('F', 700_000, 900), // implausible floor area
      pair('F', 30_000), // implausible price
      pair('F', 700_000), // the one usable pair
    ];
    const r = summariseDistrictArbitrage('SE22', 5, pairs);
    expect(r.matched).toBe(5);
    expect(r.usable).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// EPC search-row parsing (whole-postcode view)
// ---------------------------------------------------------------------------

describe('parseDomesticSearchRows', () => {
  it('parses addressLine parts, single address strings, and drops keyless rows', () => {
    const rows = parseDomesticSearchRows({
      data: [
        {
          addressLine1: '12 Acacia Road',
          addressLine2: null,
          certificateNumber: 'C1',
          currentEnergyEfficiencyBand: 'f',
          postcode: 'SE22 8EW',
          registrationDate: '2024-05-01',
        },
        {
          address: 'Rose Cottage, Acacia Road',
          certificateNumber: 'C2',
          currentEnergyEfficiencyBand: 'B',
          postcode: 'SE22 8EW',
        },
        // No certificate number → cannot key the follow-up fetch → dropped.
        { addressLine1: '99 Acacia Road', currentEnergyEfficiencyBand: 'C' },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      certificateNumber: 'C1',
      address: '12 Acacia Road',
      band: 'F',
    });
    expect(rows[1]).toMatchObject({
      certificateNumber: 'C2',
      address: 'Rose Cottage, Acacia Road',
      band: 'B',
    });
  });

  it('returns [] for malformed bodies', () => {
    expect(parseDomesticSearchRows(null)).toEqual([]);
    expect(parseDomesticSearchRows({})).toEqual([]);
  });
});

/**
 * Sector comps (hmlr-sector.ts) — the pure pieces. No live network.
 *
 * The load-bearing cases are the ones that REJECT: a sector that cannot be
 * parsed returns null (never a guess), and rows that are not a like-for-like
 * sale (new build, sub-unit of a house, sub-£50k transfer) are dropped.
 */

import { describe, expect, it } from 'vitest';
import type { SoldSale } from '../arbitrage';
import {
  buildSectorSalesQuery,
  postcodeSector,
  toSectorTransactions,
} from '../hmlr-sector';

const sale = (over: Partial<SoldSale> = {}): SoldSale => ({
  pricePounds: 725_000,
  date: '2026-03-14',
  paon: '31',
  saon: null,
  street: 'BRIAR AVENUE',
  postcode: 'SW16 3AB',
  propertyType: 'semi-detached',
  newBuild: false,
  ...over,
});

describe('postcodeSector', () => {
  it('takes the outward code plus the inward digit', () => {
    expect(postcodeSector('SW16 3AA')).toBe('SW16 3');
    expect(postcodeSector('sw163aa')).toBe('SW16 3');
    expect(postcodeSector('M14 5AB')).toBe('M14 5');
    expect(postcodeSector('EC1A 1BB')).toBe('EC1A 1');
    expect(postcodeSector('W1A 0AX')).toBe('W1A 0');
  });

  it('returns null for a partial or malformed postcode rather than guessing', () => {
    expect(postcodeSector('SW16')).toBeNull();
    expect(postcodeSector('SW16 3')).toBeNull();
    expect(postcodeSector('')).toBeNull();
    expect(postcodeSector('not a postcode')).toBeNull();
  });
});

describe('buildSectorSalesQuery', () => {
  it('filters on the sector prefix, the property type and category A', () => {
    const q = buildSectorSalesQuery('SW16 3', 'semi-detached', '2024-09-01');
    expect(q).toContain('FILTER(STRSTARTS(?postcode, "SW16 3"))');
    expect(q).toContain(
      'lrppi:propertyType <http://landregistry.data.gov.uk/def/common/semi-detached>'
    );
    expect(q).toContain('lrppi:standardPricePaidTransaction');
    expect(q).toContain('"2024-09-01"^^xsd:date');
    expect(q).toContain('ORDER BY DESC(?date)');
    expect(q).toContain('LIMIT 60');
  });

  it('rejects a district or a full postcode in place of a sector', () => {
    expect(() =>
      buildSectorSalesQuery('SW16', 'terraced', '2024-09-01')
    ).toThrow(/sector/);
    expect(() =>
      buildSectorSalesQuery('SW16 3AA', 'terraced', '2024-09-01')
    ).toThrow(/sector/);
    expect(() =>
      buildSectorSalesQuery('SW16 3', 'terraced', '01/09/2024')
    ).toThrow(/ISO/);
  });
});

describe('toSectorTransactions', () => {
  it('maps a like-for-like sale into the AVM comp shape with real provenance', () => {
    const [t] = toSectorTransactions([sale()], 'semi-detached');
    expect(t).toMatchObject({
      price: 725_000,
      date: '2026-03-14',
      propertyType: 'semi-detached',
      provenance: 'hmlr_ppd',
      address: '31 BRIAR AVENUE',
      postcode: 'SW16 3AB',
    });
  });

  it('drops new builds, sub-units of houses and sub-£50k transfers', () => {
    const rows = [
      sale({ newBuild: true }),
      sale({ saon: 'FLAT 2' }),
      sale({ pricePounds: 12_000 }),
      sale({ paon: '33' }),
    ];
    const out = toSectorTransactions(rows, 'semi-detached');
    expect(out).toHaveLength(1);
    expect(out[0]?.address).toBe('33 BRIAR AVENUE');
  });

  it('keeps a SAON when the subject is a flat', () => {
    const out = toSectorTransactions(
      [sale({ saon: 'FLAT 2', propertyType: 'flat-maisonette' })],
      'flat'
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.address).toBe('FLAT 2 31 BRIAR AVENUE');
  });
});

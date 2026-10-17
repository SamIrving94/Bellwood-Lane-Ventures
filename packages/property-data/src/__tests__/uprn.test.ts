/**
 * UPRN resolver tests — strict matching, no network (lookups are stubbed).
 *
 * The cases are the ways a loose matcher hands back the WRONG property:
 * 12 vs 12A/112, a house vs its flats, flat 1 vs flat 2, a street with no
 * house in it, and two sources that disagree.
 */

import { describe, expect, it } from 'vitest';
import { parseDomesticSearchRows } from '../epc';
import {
  type UprnCandidate,
  type UprnLookups,
  addressKey,
  matchCandidates,
  resolveUprn,
} from '../uprn';

const PC = 'SE22 8EW';

function lookups(
  epc: UprnCandidate[] | null,
  os: UprnCandidate[] | null
): UprnLookups {
  return { epc: async () => epc, os: async () => os };
}

const street: UprnCandidate[] = [
  { uprn: '100', address: '12 Acacia Road' },
  { uprn: '101', address: '12A Acacia Road' },
  { uprn: '102', address: '112 Acacia Road' },
  { uprn: '103', address: '14 Acacia Road' },
];

describe('addressKey', () => {
  it('reads house number, street and no unit', () => {
    const k = addressKey('12 Acacia Road, London SE22 8EW');
    expect(k.unit).toBeNull();
    expect(k.designator).toEqual({ kind: 'number', token: '12' });
    expect(k.street).toBe('ACACIA');
  });

  it('reads "Flat 2, 12 …" as flat 2 of number 12', () => {
    const k = addressKey('Flat 2, 12 Acacia Road');
    expect(k.unit).toBe('FLAT:2');
    expect(k.designator?.token).toBe('12');
  });

  it('reads OS-style "2, 12 …" as flat 2 of number 12, not house 2', () => {
    const k = addressKey('2, 12, ACACIA ROAD, LONDON, SE22 8EW');
    expect(k.unit).toBe('FLAT:2');
    expect(k.designator?.token).toBe('12');
  });

  it('reads "First Floor Flat, 12 …" as a floor, not flat 12', () => {
    const k = addressKey('First Floor Flat, 12 Acacia Road');
    expect(k.unit).toBe('FLOOR:FIRST');
    expect(k.designator?.token).toBe('12');
  });

  it('refuses a number range', () => {
    expect(addressKey('12-14 Acacia Road').designator).toBeNull();
  });

  it('refuses a street with no house in it', () => {
    expect(addressKey('Acacia Road, London').designator).toBeNull();
  });

  it('reads a named house', () => {
    expect(addressKey('Rose Cottage, Acacia Road').designator).toEqual({
      kind: 'name',
      token: 'ROSE COTTAGE',
    });
  });
});

describe('matchCandidates', () => {
  it('never lets 12 match 12A or 112', () => {
    expect(matchCandidates(addressKey('12 Acacia Road'), street)).toEqual({
      kind: 'match',
      uprn: '100',
    });
  });

  it('never pairs a house with one of its flats', () => {
    const flats = [
      { uprn: '201', address: 'Flat 1, 12 Acacia Road' },
      { uprn: '202', address: 'Flat 2, 12 Acacia Road' },
    ];
    expect(matchCandidates(addressKey('12 Acacia Road'), flats).kind).toBe(
      'none'
    );
  });

  it('matches the right flat and only that flat', () => {
    const flats = [
      { uprn: '201', address: 'Flat 1, 12 Acacia Road' },
      { uprn: '202', address: 'Flat 2, 12 Acacia Road' },
    ];
    expect(
      matchCandidates(addressKey('Flat 2, 12 Acacia Road'), flats)
    ).toEqual({ kind: 'match', uprn: '202' });
  });

  it('never resolves "Flat, 12 …" (which flat?)', () => {
    const flats = [{ uprn: '201', address: 'Flat 1, 12 Acacia Road' }];
    expect(
      matchCandidates(addressKey('Flat, 12 Acacia Road'), flats).kind
    ).toBe('none');
  });

  it('requires the street word when the lead has one', () => {
    const other = [{ uprn: '300', address: '12 Bellamy Grove' }];
    expect(matchCandidates(addressKey('12 Acacia Road'), other).kind).toBe(
      'none'
    );
  });

  it('counts re-lodged certificates with one UPRN as one match', () => {
    const relodged = [
      { uprn: '100', address: '12 Acacia Road' },
      { uprn: '100', address: '12, Acacia Road' },
    ];
    expect(matchCandidates(addressKey('12 Acacia Road'), relodged).kind).toBe(
      'match'
    );
  });

  it('calls two different UPRNs at one address ambiguous', () => {
    const dupes = [
      { uprn: '100', address: '12 Acacia Road' },
      { uprn: '999', address: '12 Acacia Road' },
    ];
    expect(matchCandidates(addressKey('12 Acacia Road'), dupes).kind).toBe(
      'ambiguous'
    );
  });

  it('skips candidates with no UPRN rather than inventing one', () => {
    const noUprn = [{ uprn: null, address: '12 Acacia Road' }];
    expect(matchCandidates(addressKey('12 Acacia Road'), noUprn).kind).toBe(
      'none'
    );
  });
});

describe('resolveUprn', () => {
  const lead = { address: '12 Acacia Road, London', postcode: PC };

  it('is high confidence when EPC and OS Places agree', async () => {
    const r = await resolveUprn(lead, lookups(street, street));
    expect(r).toEqual({
      uprn: '100',
      confidence: 'high',
      sources: ['epc', 'os_places'],
      reason: null,
    });
  });

  it('is medium confidence on one source when the other cannot answer', async () => {
    const r = await resolveUprn(lead, lookups(null, street));
    expect(r.uprn).toBe('100');
    expect(r.confidence).toBe('medium');
    expect(r.sources).toEqual(['os_places']);
  });

  it('refuses when the sources disagree', async () => {
    const r = await resolveUprn(
      lead,
      lookups(street, [{ uprn: '555', address: '12 Acacia Road' }])
    );
    expect(r).toMatchObject({ uprn: null, reason: 'sources_disagree' });
  });

  it('refuses when either source saw several matches', async () => {
    const dupes = [
      { uprn: '100', address: '12 Acacia Road' },
      { uprn: '999', address: '12 Acacia Road' },
    ];
    const r = await resolveUprn(lead, lookups(street, dupes));
    expect(r).toMatchObject({ uprn: null, reason: 'ambiguous' });
  });

  it('says unavailable, not no-match, when neither source answers', async () => {
    const r = await resolveUprn(lead, lookups(null, null));
    expect(r.reason).toBe('sources_unavailable');
  });

  it('treats a thrown lookup as unavailable', async () => {
    const r = await resolveUprn(lead, {
      epc: () => Promise.reject(new Error('boom')),
      os: async () => [],
    });
    expect(r.reason).toBe('no_match');
  });

  it('does not search on an outcode', async () => {
    const r = await resolveUprn(
      { address: '12 Acacia Road', postcode: 'SE22' },
      lookups(street, street)
    );
    expect(r.reason).toBe('no_full_postcode');
  });

  it('does not search when there is no house to match', async () => {
    const r = await resolveUprn(
      { address: 'Acacia Road', postcode: PC },
      lookups(street, street)
    );
    expect(r.reason).toBe('unparseable_address');
  });
});

describe('EPC search rows carry the lodged UPRN', () => {
  it('keeps numeric UPRNs and drops malformed ones', () => {
    const rows = parseDomesticSearchRows({
      data: [
        { certificateNumber: 'A', address: '1 X Road', uprn: 100121241798 },
        {
          certificateNumber: 'B',
          address: '2 X Road',
          uprn: 'UPRN-000000000000',
        },
        { certificateNumber: 'C', address: '3 X Road' },
      ],
    });
    expect(rows.map((r) => r.uprn)).toEqual(['100121241798', null, null]);
  });
});

describe('sameHome', () => {
  it('picks this home out of Land Registry-style addresses', async () => {
    const { sameHome } = await import('../uprn');
    expect(sameHome('12 Acacia Road', '12, ACACIA ROAD, LONDON')).toBe(true);
    expect(sameHome('12 Acacia Road', 'FLAT 1, 12, ACACIA ROAD')).toBe(false);
    expect(sameHome('Flat 1, 12 Acacia Road', 'FLAT 1, 12, ACACIA ROAD')).toBe(
      true
    );
    expect(sameHome('12 Acacia Road', '112, ACACIA ROAD')).toBe(false);
  });
});

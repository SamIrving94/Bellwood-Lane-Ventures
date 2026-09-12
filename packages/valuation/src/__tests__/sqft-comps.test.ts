/**
 * £/sqft evidence — the size pillar's pure logic.
 *
 * Locks the two things that matter: the matcher never pairs the wrong
 * house (precision over recall), and the blend/weights never invent an
 * estimate the evidence doesn't support.
 */

import { describe, expect, it } from 'vitest';
import {
  type FloorAreaRow,
  type SqftCompInput,
  addressDesignator,
  buildSqftEvidence,
  matchCompFloorArea,
  sqmToSqft,
  streetEvidenceToken,
  triangulationWeights,
} from '../sqft-comps';

const rows = (entries: [string, number][]): FloorAreaRow[] =>
  entries.map(([address, floorAreaSqm]) => ({ address, floorAreaSqm }));

function comp(
  address: string,
  adjustedPounds: number,
  opts: Partial<SqftCompInput> = {}
): SqftCompInput {
  return {
    address,
    postcode: 'M14 5AB',
    adjustedPricePence: adjustedPounds * 100,
    distanceMiles: 0.1,
    ...opts,
  };
}

describe('addressDesignator', () => {
  it('reads a leading house number, with a letter suffix', () => {
    expect(addressDesignator('12 Acacia Road')).toEqual({
      kind: 'house',
      token: '12',
    });
    expect(addressDesignator('12a Acacia Road')).toEqual({
      kind: 'house',
      token: '12A',
    });
    expect(addressDesignator('12, Acacia Road, Manchester')).toEqual({
      kind: 'house',
      token: '12',
    });
  });

  it('reads a flat and the building it sits in', () => {
    expect(addressDesignator('Flat 3, 12 Acacia Road')).toEqual({
      kind: 'unit',
      unit: '3',
      token: '12',
    });
    expect(addressDesignator('Apartment 7 Beech Court')).toEqual({
      kind: 'unit',
      unit: '7',
      token: '',
    });
  });

  it('refuses street-only addresses and ranges', () => {
    expect(addressDesignator('Acacia Road')).toBeNull();
    expect(addressDesignator('12-14 Acacia Road')).toBeNull();
    expect(addressDesignator('')).toBeNull();
  });
});

describe('streetEvidenceToken', () => {
  it('skips the number and generic words', () => {
    expect(streetEvidenceToken('12 Acacia Road')).toBe('ACACIA');
    expect(streetEvidenceToken('Flat 3, 12 The Avenue')).toBe(null);
    expect(streetEvidenceToken('12 Upper Brook Street')).toBe('BROOK');
  });
});

describe('matchCompFloorArea', () => {
  const byPostcode = new Map<string, FloorAreaRow[]>([
    [
      'M145AB',
      rows([
        ['12 Acacia Road, Manchester', 85],
        ['12A Acacia Road, Manchester', 40],
        ['112 Acacia Road, Manchester', 130],
        ['Flat 12, Acacia House, Manchester', 55],
        ['14 Acacia Road, Manchester', 90],
      ]),
    ],
  ]);

  it('matches the exact house number only', () => {
    const hit = matchCompFloorArea(
      comp('12 Acacia Road', 300_000),
      byPostcode,
      'M14 5AB'
    );
    expect(hit?.floorAreaSqm).toBe(85);
  });

  it('never pairs 12 with 12A, 112 or Flat 12', () => {
    expect(
      matchCompFloorArea(
        comp('12A Acacia Road', 300_000),
        byPostcode,
        'M14 5AB'
      )?.floorAreaSqm
    ).toBe(40);
    expect(
      matchCompFloorArea(
        comp('112 Acacia Road', 300_000),
        byPostcode,
        'M14 5AB'
      )?.floorAreaSqm
    ).toBe(130);
    expect(
      matchCompFloorArea(
        comp('Flat 12, Acacia House', 300_000),
        byPostcode,
        'M14 5AB'
      )?.floorAreaSqm
    ).toBe(55);
  });

  it('needs street evidence when the comp has no postcode', () => {
    const noPostcode = comp('12 Beech Road', 300_000, { postcode: null });
    expect(matchCompFloorArea(noPostcode, byPostcode, 'M14 5AB')).toBeNull();
    const sameStreet = comp('12 Acacia Road', 300_000, { postcode: null });
    expect(
      matchCompFloorArea(sameStreet, byPostcode, 'M14 5AB')?.floorAreaSqm
    ).toBe(85);
  });

  it('returns null for a postcode we have no rows for', () => {
    expect(
      matchCompFloorArea(
        comp('12 Acacia Road', 300_000, { postcode: 'M15 6CD' }),
        byPostcode,
        'M14 5AB'
      )
    ).toBeNull();
  });

  it('refuses when two certificates for one house disagree on size', () => {
    const conflicting = new Map<string, FloorAreaRow[]>([
      [
        'M145AB',
        rows([
          ['12 Acacia Road', 85],
          ['12 Acacia Road', 120],
        ]),
      ],
    ]);
    expect(
      matchCompFloorArea(
        comp('12 Acacia Road', 300_000),
        conflicting,
        'M14 5AB'
      )
    ).toBeNull();
  });
});

describe('buildSqftEvidence', () => {
  const byPostcode = new Map<string, FloorAreaRow[]>([
    [
      'M145AB',
      rows([
        ['1 Test Street', 80], // £250k ⇒ £290/sqft
        ['2 Test Street', 100], // £320k ⇒ £297/sqft
        ['3 Test Street', 120], // £420k ⇒ £325/sqft
      ]),
    ],
    ['M145CD', rows([['9 Far Road', 90]])], // £330k ⇒ £341/sqft, far bucket
  ]);

  const comps: SqftCompInput[] = [
    comp('1 Test Street', 250_000),
    comp('2 Test Street', 320_000),
    comp('3 Test Street', 420_000),
    comp('9 Far Road', 330_000, { postcode: 'M14 5CD', distanceMiles: 0.4 }),
    comp('Test Street', 999_000), // street-only — must be ignored
  ];

  it('prices the subject by the blended near/far £/sqft', () => {
    const ev = buildSqftEvidence({
      comps,
      floorAreasByPostcode: byPostcode,
      subjectPostcode: 'M14 5AB',
      subjectFloorAreaSqm: 100,
    });
    expect(ev.matchedCount).toBe(4);
    expect(ev.nearMedianPerSqft).toBe(297);
    expect(ev.farMedianPerSqft).toBe(341);
    // 0.6 × 297 + 0.4 × 341 = 314.6 ⇒ 315
    expect(ev.poundsPerSqft).toBe(315);
    expect(ev.subjectFloorAreaSqft).toBe(1076);
    expect(ev.sqftEstimate).toBe(315 * 1076);
    expect(ev.source).toBe('matched_comps');
    // Subject 100 m² vs median comp 95 m²
    expect(ev.sizeVsCompsPct).toBeCloseTo(0.05, 2);
  });

  it('gives no estimate without a subject size, but still shows the rate', () => {
    const ev = buildSqftEvidence({
      comps,
      floorAreasByPostcode: byPostcode,
      subjectPostcode: 'M14 5AB',
      subjectFloorAreaSqm: null,
      benchmarkPerSqft: 300,
    });
    expect(ev.poundsPerSqft).toBe(315);
    expect(ev.sqftEstimate).toBeNull();
    expect(ev.source).toBeNull();
  });

  it('falls back to the area benchmark when too few comps match', () => {
    const ev = buildSqftEvidence({
      comps: comps.slice(0, 1),
      floorAreasByPostcode: byPostcode,
      subjectPostcode: 'M14 5AB',
      subjectFloorAreaSqm: 100,
      benchmarkPerSqft: 300,
    });
    expect(ev.matchedCount).toBe(1);
    expect(ev.source).toBe('area_benchmark');
    expect(ev.sqftEstimate).toBe(300 * 1076);
  });

  it('gives nothing when there is neither matched evidence nor a benchmark', () => {
    const ev = buildSqftEvidence({
      comps: [],
      floorAreasByPostcode: new Map(),
      subjectPostcode: 'M14 5AB',
      subjectFloorAreaSqm: 100,
    });
    expect(ev.matchedCount).toBe(0);
    expect(ev.poundsPerSqft).toBeNull();
    expect(ev.sqftEstimate).toBeNull();
    expect(ev.source).toBeNull();
  });

  it('drops pairs outside the sanity bounds', () => {
    const silly = new Map<string, FloorAreaRow[]>([
      [
        'M145AB',
        rows([
          ['1 Test Street', 5],
          ['2 Test Street', 100],
        ]),
      ],
    ]);
    const ev = buildSqftEvidence({
      comps: [comp('1 Test Street', 250_000), comp('2 Test Street', 5_000_000)],
      floorAreasByPostcode: silly,
      subjectPostcode: 'M14 5AB',
      subjectFloorAreaSqm: 100,
    });
    // 5 m² is a parse error; £5m on 100 m² is £4,645/sqft — both rejected.
    expect(ev.matchedCount).toBe(0);
  });
});

describe('triangulationWeights', () => {
  const combos = [
    ['distance', true],
    ['distance', false],
    ['hmlr', true],
    ['hmlr', false],
    ['fallback', false],
  ] as const;

  it('always sums to 1', () => {
    for (const [csa, ext] of combos) {
      for (const sqft of ['matched_comps', 'area_benchmark', null] as const) {
        const w = triangulationWeights(csa, ext, sqft);
        expect(w.csa + w.hedonic + w.external + w.sqft).toBeCloseTo(1, 6);
        expect(w.external > 0).toBe(ext);
        expect(w.sqft > 0).toBe(sqft !== null);
      }
    }
  });

  it('keeps the historical blend when there is no size signal', () => {
    expect(triangulationWeights('distance', true, null)).toEqual({
      csa: 0.6,
      hedonic: 0.25,
      external: 0.15,
      sqft: 0,
    });
    expect(triangulationWeights('hmlr', false, null)).toEqual({
      csa: 0.5,
      hedonic: 0.5,
      external: 0,
      sqft: 0,
    });
  });

  it('trusts matched comps more than an area benchmark', () => {
    const matched = triangulationWeights('distance', false, 'matched_comps');
    const bench = triangulationWeights('distance', false, 'area_benchmark');
    expect(matched.sqft).toBeGreaterThan(bench.sqft);
  });
});

describe('sqmToSqft', () => {
  it('converts and rounds', () => {
    expect(sqmToSqft(100)).toBe(1076);
    expect(sqmToSqft(92.9)).toBe(1000);
  });
});

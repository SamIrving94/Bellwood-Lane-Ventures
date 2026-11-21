import { describe, expect, it } from 'vitest';
import {
  type HomeEvidence,
  assessEvidence,
  readDwellingType,
  typesDisagree,
} from '../evidence-checks';

const quietHome: HomeEvidence = {
  namesOneHome: true,
  ownSale: null,
  hpiMove: null,
  epcDwellingType: null,
};

describe('evidence checks — the Clarendon Rise case (Oct 2026)', () => {
  // Flat 1, 24 Clarendon Rise SE13: valued at £408,828. Two nearby sales
  // (median ~£319.6k) carried 60% of the comp figure against fifteen
  // further out (~£449.8k). The flat itself sold for £495k in Aug 2023 and
  // Lewisham flat prices barely moved since (+0.1%).
  const result = assessEvidence({
    pointEstimate: 408_828,
    propertyType: 'flat',
    rings: { nearMedian: 319_606, farMedian: 449_800, nearCount: 2, farCount: 15 },
    home: {
      namesOneHome: true,
      ownSale: { price: 495_000, date: '2023-08-24' },
      hpiMove: { ratio: 1.001, region: 'lewisham' },
      epcDwellingType: 'Ground-floor flat',
    },
  });

  it('flags the ring gap and the own-sale gap, not the type', () => {
    expect(result.flags.map((f) => f.code)).toEqual(['ring_gap', 'own_sale_gap']);
    expect(result.secondCheckRequired).toBe(true);
  });

  it('records what it saw', () => {
    expect(result.ringGap?.gap).toBeCloseTo(-0.289, 2);
    expect(result.ownSale?.indexedPrice).toBe(495_495);
    expect(result.ownSale?.gap).toBeCloseTo(-0.175, 2);
    expect(result.propertyType?.disagrees).toBe(false);
  });

  it('says why in plain English', () => {
    expect(result.flags[0]?.message).toMatch(/2 nearest sales .* 29% below the 15 further out/);
    expect(result.flags[1]?.message).toMatch(/sold for £495,000 in Aug 2023 .* 17% below/);
  });
});

describe('evidence checks — ring gap', () => {
  const ring = (nearCount: number, nearMedian: number, farMedian = 400_000) =>
    assessEvidence({
      pointEstimate: 400_000,
      propertyType: 'flat',
      rings: { nearMedian, farMedian, nearCount, farCount: 10 },
      home: quietHome,
    });

  it('a big gap on a well-supported near ring is not flagged (prime streets differ)', () => {
    expect(ring(4, 600_000).flags).toEqual([]);
  });
  it('a small gap on a thin near ring is not flagged', () => {
    expect(ring(2, 440_000).flags).toEqual([]);
  });
  it('a 25%+ gap on a thin ring is flagged, either direction', () => {
    expect(ring(3, 500_000).flags[0]?.code).toBe('ring_gap');
    expect(ring(1, 300_000).flags[0]?.code).toBe('ring_gap');
  });
  it('one empty ring is not a gap', () => {
    const r = assessEvidence({
      pointEstimate: 400_000,
      propertyType: 'flat',
      rings: { nearMedian: null, farMedian: 400_000, nearCount: 0, farCount: 10 },
      home: quietHome,
    });
    expect(r.ringGap?.gap).toBeNull();
    expect(r.flags).toEqual([]);
  });
  it('the Land Registry fallback has no rings to compare', () => {
    const r = assessEvidence({ pointEstimate: 1, propertyType: 'flat', rings: null, home: null });
    expect(r.ringGap).toBeNull();
    expect(r.secondCheckRequired).toBe(false);
  });
});

describe('evidence checks — own sale', () => {
  const own = (pointEstimate: number, ratio: number | null) =>
    assessEvidence({
      pointEstimate,
      propertyType: 'terraced',
      rings: null,
      home: {
        ...quietHome,
        ownSale: { price: 200_000, date: '2022-03-01' },
        hpiMove: ratio === null ? null : { ratio, region: 'wychavon' },
      },
    });

  it('compares against the sale at today\'s prices', () => {
    // £200k × 1.2 = £240k; £230k is within 10%.
    expect(own(230_000, 1.2).flags).toEqual([]);
    // Without the index, £230k would read 15% above the raw sale.
    expect(own(230_000, null).flags[0]?.code).toBe('own_sale_gap');
  });
  it('flags 10%+ either way', () => {
    expect(own(210_000, 1.2).flags[0]?.message).toMatch(/13% below/);
    expect(own(270_000, 1.2).flags[0]?.message).toMatch(/13% above/);
  });
});

describe('evidence checks — property type vs EPC', () => {
  it('reads kind and built form', () => {
    expect(readDwellingType('Ground-floor maisonette')).toEqual({ kind: 'flat', form: null });
    expect(readDwellingType('End-terrace house')).toEqual({ kind: 'house', form: 'terraced' });
    expect(readDwellingType('Semi-detached bungalow')).toEqual({ kind: 'house', form: 'semi' });
    expect(readDwellingType('Detached house')).toEqual({ kind: 'house', form: 'detached' });
  });

  it('flat vs house disagrees (14 Monarch Court: sheet said terraced)', () => {
    expect(typesDisagree('terraced', 'Ground-floor maisonette')).toBe(true);
    expect(typesDisagree('flat', 'Mid-terrace house')).toBe(true);
  });
  it('detached vs terraced disagrees (11 Grasmere Terrace)', () => {
    expect(typesDisagree('detached', 'End-terrace house')).toBe(true);
  });
  it('neighbouring forms do not (semi vs end-terrace is often the same building)', () => {
    expect(typesDisagree('semi-detached', 'End-terrace house')).toBe(false);
    expect(typesDisagree('terraced', 'End-terrace house')).toBe(false);
    expect(typesDisagree('semi-detached', 'Semi-detached bungalow')).toBe(false);
    expect(typesDisagree('flat', 'Top-floor flat')).toBe(false);
  });
  it('an unreadable EPC type never flags', () => {
    expect(typesDisagree('flat', 'Park home')).toBe(false);
  });
});

describe('evidence checks — no single home', () => {
  it('records that the home checks were skipped', () => {
    const r = assessEvidence({
      pointEstimate: 300_000,
      propertyType: 'flat',
      rings: null,
      home: { ...quietHome, namesOneHome: false },
    });
    expect(r.homeChecksSkipped).toBe('no_house_number');
    expect(r.flags).toEqual([]);
  });
});

/**
 * Listing lead-type mapping — correctness and volume impact.
 *
 * Removing the unearned `probate` credit takes up to 16 acquisition points off
 * every PropertyData lead, so it cannot ship on principle alone: it has to be
 * measured against the gate the leads must clear.
 *
 * This harness holds EVERYTHING else constant and varies only `leadType`, so
 * the delta below is attributable to this change and nothing else. Seeded LCG,
 * no Math.random, so the numbers in the PR are reproducible.
 */

import { describe, expect, it } from 'vitest';
import type { EnrichedLead } from '../enrichment';
import { LISTING_LEAD_TYPE_MAP, leadTypeForListing } from '../lead-type';
import { type LeadSignals, scoreLead } from '../scorer';
import { DEFAULT_SCORER_CONFIG } from '../scorer-config';

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 0x1_00_00_00_00;
  };
}

/**
 * The six lists production actually scans.
 *
 * `getSourcedPropertiesMulti` defaults to `SOURCED_LIST_TYPES.slice(0, 6)`, so
 * measuring against all twelve would flatter the result with lists we never
 * query. Weights approximate the observed mix: the broad "reduced / slow to
 * sell" lists dominate, genuine repossessions are rare.
 */
const SCANNED_LISTS: Array<[string, number]> = [
  ['reduced-properties', 0.32],
  ['slow-to-sell-properties', 0.26],
  ['unmodernised-properties', 0.18],
  ['quick-sale-properties', 0.12],
  ['derelict-properties', 0.08],
  ['repossessed-properties', 0.04],
];

function pickList(rng: () => number): string {
  const r = rng();
  let acc = 0;
  let last = 'reduced-properties';
  for (const [slug, w] of SCANNED_LISTS) {
    acc += w;
    if (r < acc) return slug;
    last = slug;
  }
  // Weights sum to 1, so this only catches floating-point drift at r ≈ 1.
  return last;
}

type Sample = {
  listingType: string;
  lead: Omit<EnrichedLead, 'leadType'>;
  signals: LeadSignals;
  areaAvgPounds: number | null;
};

function buildPopulation(count: number, seed = 20_260_730): Sample[] {
  const rng = makeRng(seed);
  const out: Sample[] = [];

  for (let i = 0; i < count; i++) {
    const listingType = pickList(rng);
    const daysOnMarket = rng() < 0.15 ? null : Math.floor(rng() * 300);
    const reductionCount = rng() < 0.45 ? 1 + Math.floor(rng() * 3) : 0;
    const velocityScore = Math.floor(rng() * 100);
    const valuePounds = 90_000 + Math.floor(rng() * 400_000);
    const hasAreaComp = rng() < 0.5;

    out.push({
      listingType,
      lead: {
        probateRef: `pd-${i}`,
        address: `${i + 1} Test Street`,
        postcode: 'M14 5LL',
        grantDate: '2026-07-30',
        grantType: 'unknown',
        daysSinceGrant: daysOnMarket ?? 0,
        goldenWindowLabel: 'cold',
        solicitorFirm: null,
        estateValuePence: valuePounds * 100,
        contactName: null,
        contactPhone: null,
        contactEmail: null,
        enrichmentTier: 3,
        sourceTrail: 'propertydata → tier3/manual',
      },
      signals: {
        listingType,
        daysOnMarket,
        velocityScore,
        reductionCount,
        tenure: 'freehold',
        remainingLeaseYears: null,
      },
      areaAvgPounds: hasAreaComp ? valuePounds / 1.05 : null,
    });
  }
  return out;
}

const scoreWith = (s: Sample, leadType: string) =>
  scoreLead(
    { ...s.lead, leadType } as EnrichedLead,
    s.areaAvgPounds ? ({ avgPrice: s.areaAvgPounds } as never) : null,
    null,
    s.signals
  );

const POPULATION = buildPopulation(600);
const GATE = DEFAULT_SCORER_CONFIG.sourcingThreshold;

/** Before: every listing inherited the 20-point `probate` credit. */
const BEFORE = POPULATION.map((s) => scoreWith(s, 'probate'));
/** After: the credit reflects the distress list the property came from. */
const AFTER = POPULATION.map((s) =>
  scoreWith(s, leadTypeForListing(s.listingType))
);

const passes = (rs: ReturnType<typeof scoreWith>[], gate = GATE) =>
  rs.filter((r) => r.verdict !== 'INSUFFICIENT_DATA' && r.sourcingScore >= gate)
    .length;

describe('listing lead-type mapping — correctness', () => {
  it('never maps a plain listing to probate — the bug this fixes', () => {
    // A property being on the market is not evidence anyone died.
    for (const slug of Object.keys(LISTING_LEAD_TYPE_MAP)) {
      expect(leadTypeForListing(slug)).not.toBe('probate');
      expect(leadTypeForListing(slug)).not.toBe('probate_admin');
    }
  });

  it('maps every value to a real key in leadTypeScores', () => {
    // A value missing from leadTypeScores silently collapses to
    // leadTypeFallback (4) — exactly how `probate_admin` came to score 4.
    const known = new Set(Object.keys(DEFAULT_SCORER_CONFIG.leadTypeScores));
    for (const [slug, type] of Object.entries(LISTING_LEAD_TYPE_MAP)) {
      expect(
        known.has(type),
        `${slug} → ${type} is not a leadTypeScores key`
      ).toBe(true);
    }
  });

  it('falls back to unknown for unrecognised or missing slugs', () => {
    // PropertyData may add lists later; an unmapped one must get the weak
    // generic credit, never inherit a strong default.
    expect(leadTypeForListing('some-new-list-2027')).toBe('unknown');
    expect(leadTypeForListing(null)).toBe('unknown');
    expect(leadTypeForListing(undefined)).toBe('unknown');
    expect(leadTypeForListing('')).toBe('unknown');
  });

  it('credits a repossession above a merely-reduced listing', () => {
    // The mapping has to preserve ordering, or it is just noise.
    const points = (slug: string) =>
      DEFAULT_SCORER_CONFIG.leadTypeScores[leadTypeForListing(slug)] ?? 0;
    expect(points('repossessed-properties')).toBeGreaterThan(
      points('reduced-properties')
    );
  });
});

describe('listing lead-type mapping — volume impact', () => {
  it('reports the before/after pass counts (evidence for the change)', () => {
    const before = passes(BEFORE);
    const after = passes(AFTER);

    const sensitivity = [30, 35, 40, 45, 50]
      .map((g) => `${g}→${passes(AFTER, g)}`)
      .join(' · ');

    console.info(
      `[lead-type] n=${POPULATION.length} gate=${GATE} ` +
        `before(all 'probate')=${before} after(mapped)=${after} ` +
        `ratio=${(after / Math.max(1, before)).toFixed(2)}×\n` +
        `[lead-type] after-gate sensitivity: ${sensitivity}`
    );

    // Pin the direction, not a brittle exact count: removing an unearned
    // credit must not INCREASE the number of leads that pass.
    expect(after).toBeLessThanOrEqual(before);
  });

  it('still separates the feed instead of collapsing it to zero', () => {
    // The failure mode to guard against: the correction is right in principle
    // but starves the funnel. If this trips, the mapping or the threshold
    // needs retuning — deliberately a loud test, not a silent drift.
    const after = passes(AFTER);
    expect(after).toBeGreaterThan(0);
  });

  it('produces a spread of scores, not one flat value', () => {
    // The flat 20-point credit was compressing the distribution. After the
    // fix, different distress lists must land on different scores.
    const distinct = new Set(AFTER.map((r) => r.sourcingScore));
    expect(distinct.size).toBeGreaterThan(5);
  });
});

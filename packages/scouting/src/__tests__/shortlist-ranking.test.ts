import { describe, expect, it } from 'vitest';
import { baseFromProbateLead } from '../enrichment';
import type { ProbateLead } from '../probate-data';
import { scoreLead } from '../scorer';
import { DEFAULT_SCORER_CONFIG } from '../scorer-config';

/**
 * The pipeline shortlists by scoring the candidate pool with `scoreLead`
 * BEFORE any paid enrichment: no price-paid, no HPI, no postcode signals —
 * only what arrived free with the listing.
 *
 * These tests pin the property that makes that safe to do: the free signals
 * are enough to rank a distressed listing above an unremarkable one. If the
 * scorer ever stops separating them without paid data, the shortlist silently
 * degrades back to "whatever the API returned first" and this fails.
 */
function provisionalScore(
  lead: ProbateLead,
  signals: Parameters<typeof scoreLead>[3] = {}
): number {
  return scoreLead(
    {
      ...baseFromProbateLead(lead),
      contactName: null,
      contactPhone: null,
      contactEmail: null,
      enrichmentTier: 3,
      sourceTrail: lead.source,
    },
    null, // pricePaid — costs credits, deferred to the shortlist
    null, // hpi — same
    signals,
    DEFAULT_SCORER_CONFIG
  ).total;
}

function listing(overrides: Partial<ProbateLead> = {}): ProbateLead {
  return {
    probateRef: 'pd-M14-1',
    address: 'Wilmslow Road, Fallowfield',
    postcode: 'M14 6NW',
    grantDate: '2026-07-29',
    executorName: null,
    solicitorFirm: null,
    estateValuePence: 25_000_000,
    grantType: 'unknown',
    source: 'propertydata_for-sale',
    daysSinceGrant: 0,
    ...overrides,
  };
}

describe('provisional shortlist ranking', () => {
  it('ranks a heavily-reduced, long-listed property above a fresh listing', () => {
    const distressed = provisionalScore(listing(), {
      reductionCount: 3,
      discountPercent: 18,
      daysOnMarket: 210,
      velocityScore: 10,
      listingType: 'for-sale',
    });

    const unremarkable = provisionalScore(listing({ probateRef: 'pd-M14-2' }), {
      reductionCount: 0,
      discountPercent: 0,
      daysOnMarket: 3,
      velocityScore: 90,
      listingType: 'for-sale',
    });

    expect(distressed).toBeGreaterThan(unremarkable);
  });

  it('separates candidates using only free listing signals', () => {
    // No postcode enrichment, no HPI, no price-paid — the exact inputs
    // available at shortlist time. A flat ranking here would mean the cap is
    // choosing arbitrarily, which is the bug this replaced.
    const scores = [0, 1, 2, 3, 4].map((reductionCount) =>
      provisionalScore(listing({ probateRef: `pd-${reductionCount}` }), {
        reductionCount,
        daysOnMarket: 30 * (reductionCount + 1),
        listingType: 'for-sale',
      })
    );
    expect(new Set(scores).size).toBeGreaterThan(1);
  });

  it('credits a lead-type hint so non-probate sources rank on their own merit', () => {
    // The short-lease scout tags its leads; without the hint they would be
    // mislabelled as probate and mis-ranked.
    const shortLease = baseFromProbateLead({
      ...listing(),
      leadTypeHint: 'lease_expiry',
    } as ProbateLead);
    expect(shortLease.leadType).toBe('lease_expiry');

    const probate = baseFromProbateLead(listing({ grantType: 'probate' }));
    expect(probate.leadType).toBe('probate');
  });

  it('derives letters-of-administration as its own lead type', () => {
    const admin = baseFromProbateLead(
      listing({ grantType: 'letters_of_administration' })
    );
    expect(admin.leadType).toBe('probate_admin');
  });

  it('never throws on the null price-paid / null HPI path', () => {
    // Ranking runs before any paid lookup, so both are always null here.
    expect(() => provisionalScore(listing())).not.toThrow();
    const breakdown = scoreLead(
      {
        ...baseFromProbateLead(listing()),
        contactName: null,
        contactPhone: null,
        contactEmail: null,
        enrichmentTier: 3,
        sourceTrail: 'test',
      },
      null,
      null,
      {},
      DEFAULT_SCORER_CONFIG
    );
    expect(breakdown.appraised).toBe(false);
    expect(Number.isFinite(breakdown.total)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { baseFromProbateLead } from '../enrichment';
import { selectShortlist, shortlistCutoff } from '../index';
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

/**
 * Shortlist tie handling.
 *
 * Ranking removed the arbitrary cut... almost. A plain `.slice(0, limit)`
 * still cuts mid-tie: production on 30 Jul logged `cutoff 35, best dropped 35`
 * — the 30th property kept and the 31st dropped scored IDENTICALLY, and which
 * one survived came down to source order.
 *
 * The shortlist therefore extends past `limit` while the score is still tied
 * with the cutoff, bounded at half the limit so a large tie cohort cannot blow
 * the enrichment budget. These pin both halves of that: ties come along, and
 * the overflow stays capped.
 */
/** Thin adapter over the real implementation — no duplicated logic here. */
function shortlist(scores: number[], limit: number) {
  const sorted = [...scores].sort((a, b) => b - a);
  const { keepCount, tiesKept } = shortlistCutoff(sorted, limit);
  return { kept: keepCount, tiesKept };
}

describe('shortlist tie handling', () => {
  it('keeps candidates tied with the cutoff instead of cutting mid-tie', () => {
    // 4 above the line, then five leads all on 35 straddling limit=6.
    const scores = [90, 80, 70, 60, 35, 35, 35, 35, 35, 10];
    const { kept, tiesKept } = shortlist(scores, 6);
    expect(kept).toBe(9); // all five 35s come along
    expect(tiesKept).toBe(3);
  });

  it('caps the tie overflow at half the limit', () => {
    // 50 leads all tied on 35 — without a bound this would enrich everything.
    const scores = Array.from({ length: 50 }, () => 35);
    const { kept } = shortlist(scores, 10);
    expect(kept).toBe(15); // limit 10 + ceil(10/2)
  });

  it('is a plain cut when there is no tie at the boundary', () => {
    const scores = [90, 80, 70, 60, 50, 40, 30, 20];
    const { kept, tiesKept } = shortlist(scores, 5);
    expect(kept).toBe(5);
    expect(tiesKept).toBe(0);
  });

  it('keeps everything when the pool is smaller than the limit', () => {
    const { kept, tiesKept } = shortlist([50, 40, 30], 10);
    expect(kept).toBe(3);
    expect(tiesKept).toBe(0);
  });

  it('handles an entirely tied pool below the limit', () => {
    const { kept } = shortlist([35, 35, 35], 10);
    expect(kept).toBe(3);
  });
});

/**
 * Prime capture at the shortlist.
 *
 * The provisional ranking uses the VOLUME scorer, which credits nothing about
 * ticket size — so on a busy day a £2M unmodernised house lost the slot race
 * to £180k terraces and was dropped before anything classified it prime. The
 * capture door keeps prime/block candidates outside that competition: they do
 * not consume volume slots, and the volume shortlist is unchanged by their
 * presence. Cornerstone-investor backing means the per-run limit is
 * deliberately NOT applied to prime stock (founder direction, Aug 2026).
 */
describe('selectShortlist — prime capture outside the volume competition', () => {
  const entry = (provisionalScore: number, guaranteed = false) => ({
    provisionalScore,
    guaranteed,
  });

  it('keeps a low-scoring capture candidate a plain cut would drop', () => {
    // 5 volume leads outscore the prime one; limit 3. Ranked order (desc).
    const entries = [
      entry(90),
      entry(80),
      entry(70),
      entry(60),
      entry(50),
      entry(12, true), // the £2M house the volume scorer cannot see
    ];
    const s = selectShortlist(entries, 3);
    expect(s.keep).toEqual([true, true, true, false, false, true]);
    expect(s.guaranteedKept).toBe(1);
    expect(s.rankedKept).toBe(3);
  });

  it('does not let capture candidates consume volume slots', () => {
    // Two captures at the TOP of the ranking must not shrink the volume cut.
    const entries = [
      entry(95, true),
      entry(90, true),
      entry(80),
      entry(70),
      entry(60),
      entry(50),
    ];
    const s = selectShortlist(entries, 3);
    // Volume competition still keeps its full three: 80, 70, 60.
    expect(s.keep).toEqual([true, true, true, true, true, false]);
    expect(s.guaranteedKept).toBe(2);
    expect(s.rankedKept).toBe(3);
  });

  it('keeps volume ties at the cutoff exactly as before', () => {
    const entries = [
      entry(90),
      entry(35),
      entry(35),
      entry(35),
      entry(10, true),
    ];
    const s = selectShortlist(entries, 2);
    // 90 + the cutoff 35 + one tied 35 (overflow capped at ceil(2/2)=1),
    // plus the capture riding outside the competition entirely.
    expect(s.keep).toEqual([true, true, true, false, true]);
    expect(s.tiesKept).toBe(1);
    expect(s.tieBandTruncated).toBe(true);
  });

  it('bounds capture at the runaway guard and reports the truncation', () => {
    // Pathological: more capture candidates than the entire limit. Sorted
    // input means the best-scoring captures survive the guard.
    const entries = Array.from({ length: 8 }, (_, i) => entry(80 - i, true));
    const s = selectShortlist(entries, 3);
    expect(s.guaranteedKept).toBe(3);
    expect(s.guaranteedDropped).toBe(5);
    expect(s.keep.slice(0, 3)).toEqual([true, true, true]);
    expect(s.keep.slice(3)).toEqual([false, false, false, false, false]);
  });

  it('degrades to plain shortlistCutoff when nothing is guaranteed', () => {
    const scores = [90, 80, 70, 60, 35, 35, 35, 35, 35, 10];
    const s = selectShortlist(
      scores.map((v) => entry(v)),
      6
    );
    expect(s.keep.filter(Boolean).length).toBe(9); // ties come along
    expect(s.tiesKept).toBe(3);
    expect(s.guaranteedKept).toBe(0);
  });
});

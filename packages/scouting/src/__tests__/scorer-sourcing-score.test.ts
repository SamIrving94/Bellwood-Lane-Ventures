/**
 * Sourcing score + sourcing threshold.
 *
 * Covers the two-threshold split introduced for the scouting gate:
 *   · `sourcingScore` — the pre-appraisal total renormalised onto the points a
 *     lead could actually earn, which is what the pipeline gates on.
 *   · `sourcingThreshold` — a ScorerConfig field separate from
 *     `verdictThresholds`, which must survive a merge from an EvalConfig row
 *     written before the field existed.
 *
 * Also pins the invariant the dashboard and downstream crons depend on:
 * `total` and `verdict` are UNCHANGED by any of this.
 */

import { describe, expect, it } from 'vitest';
import type { EnrichedLead } from '../enrichment';
import { type LeadSignals, combineScore, scoreLead } from '../scorer';
import { DEFAULT_SCORER_CONFIG, mergeScorerConfig } from '../scorer-config';

function lead(overrides: Partial<EnrichedLead> = {}): EnrichedLead {
  return {
    probateRef: 'gazette-1',
    address: '12 Sevenoaks Avenue',
    postcode: 'SK4 4AP',
    leadType: 'probate',
    grantDate: '2026-06-01',
    grantType: 'probate',
    daysSinceGrant: 5,
    goldenWindowLabel: 'hot',
    solicitorFirm: null,
    estateValuePence: 20_000_000,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    enrichmentTier: 3,
    sourceTrail: 'gazette → tier3/manual',
    ...overrides,
  };
}

/** HMLR price-paid stub — avgPrice is in POUNDS. */
const areaAverage = { avgPrice: 200_000 } as never;

describe('achievablePoints — the normalisation denominator', () => {
  it('excludes the ROI headroom that cannot be earned before an appraisal', () => {
    // With an estate value AND an area comparable the equity proxy can reach
    // the top equity band (15), not the full 40-point ROI cap.
    const withComp = scoreLead(lead(), areaAverage, null, {});
    expect(withComp.achievablePoints).toBe(45 + 15 + 10);

    // No comparable → the proxy can only ever pay the 4-point stub.
    const noComp = scoreLead(lead(), null, null, {});
    expect(noComp.achievablePoints).toBe(45 + 4 + 10);

    // No price at all → the ROI dimension is entirely unreachable.
    const noValue = scoreLead(lead({ estateValuePence: null }), null, null, {});
    expect(noValue.achievablePoints).toBe(45 + 0 + 10);
  });

  it('gives an appraised lead the full ROI pillar back', () => {
    const base = scoreLead(lead(), areaAverage, null, {});
    const appraised = combineScore(base.factors, {
      bmvDiscountPct: 18,
      cashRoiPct: 22,
      avmConfidence: 'high',
      comparableCount: 6,
    });
    expect(appraised.achievablePoints).toBe(45 + 40 + 10);
    // Post-appraisal nothing is structurally blank, so the raw total IS the
    // comparable score — the verdict bands apply directly.
    expect(appraised.sourcingScore).toBe(appraised.total);
  });
});

describe('sourcingScore', () => {
  it('scores a lead the same whether or not HMLR had price-paid data', () => {
    // Identical lead, identical signals; the only difference is the presence of
    // an area comparable that says "exactly average" — i.e. no information.
    // Under the raw total this was worth 5 points and decided the old gate.
    const signals: LeadSignals = { listingType: 'reduced-properties' };
    const withComp = scoreLead(lead(), areaAverage, null, signals);
    const withoutComp = scoreLead(lead(), null, null, signals);

    expect(withComp.total).not.toBe(withoutComp.total);
    expect(
      Math.abs(withComp.sourcingScore - withoutComp.sourcingScore)
    ).toBeLessThanOrEqual(2);
  });

  it('puts a lead with no signal beyond its type below the default gate', () => {
    // The baseline the threshold is calibrated against: lead type only,
    // unknown market, no risk data. Both data states must land just under.
    for (const pricePaid of [areaAverage, null]) {
      const b = scoreLead(lead(), pricePaid, null, {});
      expect(b.sourcingScore).toBe(49);
      expect(b.sourcingScore).toBeLessThan(
        DEFAULT_SCORER_CONFIG.sourcingThreshold
      );
    }
  });

  it('clears the gate once a real acquisition signal appears', () => {
    const b = scoreLead(lead(), null, null, {
      listingType: 'unmodernised-properties',
      daysOnMarket: 120,
    });
    expect(b.sourcingScore).toBeGreaterThanOrEqual(
      DEFAULT_SCORER_CONFIG.sourcingThreshold
    );
  });

  it('stays inside 0–100 even for a heavily penalised lead', () => {
    const b = scoreLead(lead({ estateValuePence: null }), null, null, {
      floodRisk: 'High',
      epcRating: 'G',
      tenure: 'leasehold',
      remainingLeaseYears: 40,
      planningRefusalCount: 4,
    });
    expect(b.sourcingScore).toBeGreaterThanOrEqual(0);
    expect(b.sourcingScore).toBeLessThanOrEqual(100);
  });

  it('degrades to 0, not NaN, if a config zeroes every cap', () => {
    const config = mergeScorerConfig({
      dimensionCaps: { acquisition: 0, roi: 0, marketTrend: 0 },
    });
    const b = scoreLead(lead(), areaAverage, null, {}, config);
    expect(Number.isFinite(b.sourcingScore)).toBe(true);
    expect(b.sourcingScore).toBe(0);
  });
});

describe('verdict is untouched by the sourcing gate', () => {
  it('keeps the appraised verdict bands exactly where they were', () => {
    // A strong appraised lead must still read STRONG off the raw total.
    const base = scoreLead(lead(), areaAverage, { trend: 'rising' } as never, {
      listingType: 'unmodernised-properties',
      daysOnMarket: 200,
    });
    const appraised = combineScore(base.factors, {
      bmvDiscountPct: 25,
      cashRoiPct: 30,
      avmConfidence: 'high',
      comparableCount: 8,
    });
    expect(appraised.total).toBeGreaterThanOrEqual(
      DEFAULT_SCORER_CONFIG.verdictThresholds.strong
    );
    expect(appraised.verdict).toBe('STRONG');
  });

  it('does not let normalisation promote an unappraised lead', () => {
    // A lead that earns EVERYTHING available to it pre-appraisal: maxed
    // acquisition, rising market, but no price so no ROI proxy at all. Its
    // sourcingScore is a perfect 100 — and its verdict must still be the
    // VIABLE that its raw 55 has always produced. The normalised score is a
    // gate input, never a verdict input.
    const b = scoreLead(
      lead({ estateValuePence: null }),
      null,
      { trend: 'rising' } as never,
      {
        listingType: 'unmodernised-properties',
        daysOnMarket: 300,
        velocityScore: 1.5,
        reductionCount: 4,
      }
    );
    expect(b.sourcingScore).toBe(100);
    expect(b.total).toBe(55);
    expect(b.verdict).toBe('VIABLE');
    expect(b.total).toBeLessThan(
      DEFAULT_SCORER_CONFIG.verdictThresholds.strong
    );
  });

  it('still returns INSUFFICIENT_DATA without an address or postcode', () => {
    const b = scoreLead(lead({ postcode: '' }), areaAverage, null, {});
    expect(b.verdict).toBe('INSUFFICIENT_DATA');
  });
});

describe('mergeScorerConfig — sourcingThreshold back-compat', () => {
  it('supplies the default for an EvalConfig row written before the field existed', () => {
    // Verbatim shape of a pre-change EvalConfig.config row: real tuning, no
    // sourcingThreshold key anywhere.
    const oldShapedRow = {
      dimensionCaps: {
        acquisition: 45,
        roi: 40,
        marketTrend: 10,
        riskMin: -10,
        riskMax: 10,
      },
      leadTypeScores: { probate: 22, repossession: 18 },
      leadTypeFallback: 4,
      daysOnMarketBands: [
        { minRatio: 180, points: 14, label: 'On market 180+ days' },
        { minRatio: 90, points: 8, label: 'On market 90+ days' },
      ],
      conditionScores: { 'unmodernised-properties': 12 },
      velocityMax: 6,
      distressBonus: 5,
      solicitorBonus: 4,
      lettersOfAdminBonus: 3,
      marriageValueBase: 10,
      marriageValueUrgencyMax: 8,
      bmvBands: [{ minRatio: 20, points: 25, label: '≥20% below market' }],
      roiBands: [{ minRatio: 25, points: 15, label: 'Cash ROI ≥25%' }],
      equityBands: [{ minRatio: 1.5, points: 15, label: 'Strong equity' }],
      equityNoComparable: 4,
      roiConfidenceMultiplier: { high: 1, medium: 0.6, low: 0.3 },
      marketTrend: { rising: 10, stable: 6, declining: 3, unknown: 5 },
      verdictThresholds: { strong: 70, viable: 50, thin: 30 },
    };

    const merged = mergeScorerConfig(oldShapedRow);

    // The missing field falls back to the default — never undefined, which
    // would make the gate `x >= undefined` and pass nothing.
    expect(merged.sourcingThreshold).toBe(
      DEFAULT_SCORER_CONFIG.sourcingThreshold
    );
    expect(typeof merged.sourcingThreshold).toBe('number');
    // …and the row's own tuning still survives the merge unchanged.
    expect(merged.leadTypeScores.probate).toBe(22);
    expect(merged.conditionScores['unmodernised-properties']).toBe(12);
    expect(merged.verdictThresholds.strong).toBe(70);
    expect(merged.daysOnMarketBands[0]?.points).toBe(14);
  });

  it('accepts an explicit sourcingThreshold and rejects a malformed one', () => {
    expect(mergeScorerConfig({ sourcingThreshold: 62 }).sourcingThreshold).toBe(
      62
    );
    for (const bad of ['62', null, Number.NaN, { value: 62 }, []]) {
      expect(
        mergeScorerConfig({ sourcingThreshold: bad }).sourcingThreshold
      ).toBe(DEFAULT_SCORER_CONFIG.sourcingThreshold);
    }
  });

  it('leaves verdictThresholds independent of the sourcing threshold', () => {
    // The two must not be coupled: retuning the gate must never move the bands
    // the dashboard renders.
    const merged = mergeScorerConfig({ sourcingThreshold: 80 });
    expect(merged.verdictThresholds).toEqual(
      DEFAULT_SCORER_CONFIG.verdictThresholds
    );
  });
});

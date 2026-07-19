import { describe, expect, it } from 'vitest';
import type { EnrichedLead } from '../enrichment';
import { type LeadSignals, scoreLead } from '../scorer';
import { DEFAULT_SCORER_CONFIG, mergeScorerConfig } from '../scorer-config';

// Covers the scorer paths the original scorer.test.ts left untested: the risk
// and market-trend modifiers, the acquisition cap, verdict thresholds, and the
// untrusted-config deep-merge that "can never crash the cron".

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
    estateValuePence: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    enrichmentTier: 3,
    sourceTrail: 'gazette → tier3/manual',
    ...overrides,
  };
}

describe('scoreRisk (via scoreLead)', () => {
  it('penalises flood, poor EPC and a short lease, and surfaces the flags', () => {
    const signals: LeadSignals = {
      floodRisk: 'High',
      epcRating: 'F',
      tenure: 'leasehold',
      remainingLeaseYears: 55,
    };
    const b = scoreLead(lead(), null, null, signals);

    expect(b.factors.some((f) => f.dimension === 'risk' && /flood/i.test(f.label))).toBe(true);
    expect(b.factors.some((f) => /Poor EPC \(F\)/.test(f.label))).toBe(true);
    expect(b.factors.some((f) => /Very short lease \(55y\)/.test(f.label))).toBe(true);
    expect(b.risk).toBeLessThan(0);
    expect(b.riskFlags).toContain('flood: high');
    expect(b.riskFlags).toContain('EPC F');
  });

  it('rewards freehold + good EPC + low flood', () => {
    const b = scoreLead(lead(), null, null, {
      floodRisk: 'Low',
      epcRating: 'B',
      tenure: 'freehold',
    });
    expect(b.factors.some((f) => /Freehold/.test(f.label))).toBe(true);
    expect(b.factors.some((f) => /Good EPC \(B\)/.test(f.label))).toBe(true);
    expect(b.risk).toBeGreaterThan(0);
  });

  it('clamps risk to the configured floor', () => {
    const b = scoreLead(lead(), null, null, {
      floodRisk: 'High',
      epcRating: 'G',
      tenure: 'leasehold',
      remainingLeaseYears: 40,
      planningRefusalCount: 5,
    });
    expect(b.risk).toBe(DEFAULT_SCORER_CONFIG.dimensionCaps.riskMin);
  });
});

describe('scoreMarketTrend (via scoreLead)', () => {
  it('reads the HPI trend', () => {
    const rising = scoreLead(lead(), null, { trend: 'rising' } as never, {});
    expect(rising.factors.some((f) => /Rising market/.test(f.label))).toBe(true);
    expect(rising.marketTrendLabel).toBe('rising');
  });

  it('labels a missing HPI as unknown (never fabricates a trend)', () => {
    const b = scoreLead(lead(), null, null, {});
    expect(b.marketTrendLabel).toBe('unknown');
    expect(b.factors.some((f) => /Market trend unknown/.test(f.label))).toBe(true);
  });
});

describe('acquisition cap', () => {
  it('caps the acquisition pillar and shows the cap as a factor', () => {
    // Stack every positive acquisition signal so the raw sum exceeds the cap.
    const signals: LeadSignals = {
      listingType: 'unmodernised-properties',
      daysOnMarket: 400,
      velocityScore: 1,
      reductionCount: 4,
      marriageValueLease: true,
      leaseUrgency: 1,
    };
    const b = scoreLead(
      lead({ solicitorFirm: 'Acme Law', grantType: 'letters_of_administration' }),
      null,
      null,
      signals,
    );
    expect(b.acquisition).toBe(DEFAULT_SCORER_CONFIG.dimensionCaps.acquisition);
    expect(b.factors.some((f) => /Acquisition cap/.test(f.label))).toBe(true);
  });
});

describe('verdict thresholds', () => {
  it('returns INSUFFICIENT_DATA without address/postcode', () => {
    const b = scoreLead(lead({ address: '', postcode: '' }), null, null, {});
    expect(b.verdict).toBe('INSUFFICIENT_DATA');
  });

  it('applies the configured thresholds', () => {
    const generous = mergeScorerConfig({ verdictThresholds: { strong: 1, viable: 1, thin: 1 } });
    const strong = scoreLead(lead(), null, null, { listingType: 'unmodernised-properties' }, generous);
    expect(strong.verdict).toBe('STRONG');

    const strict = mergeScorerConfig({ verdictThresholds: { strong: 999, viable: 999, thin: 999 } });
    const pass = scoreLead(lead(), null, null, {}, strict);
    expect(pass.verdict).toBe('PASS');
  });
});

describe('mergeScorerConfig — never crashes the cron', () => {
  it('returns defaults for non-object input', () => {
    for (const bad of [null, undefined, 'nope', 42, [], true]) {
      expect(() => mergeScorerConfig(bad)).not.toThrow();
      expect(mergeScorerConfig(bad)).toEqual(DEFAULT_SCORER_CONFIG);
    }
  });

  it('ignores wrong-typed fields and keeps defaults', () => {
    const merged = mergeScorerConfig({
      verdictThresholds: 'nonsense',
      dimensionCaps: { acquisition: 'x', roi: null },
      marketTrend: { rising: Number.NaN },
      leadTypeScores: 'oops',
    });
    expect(merged.verdictThresholds).toEqual(DEFAULT_SCORER_CONFIG.verdictThresholds);
    expect(merged.dimensionCaps.acquisition).toBe(DEFAULT_SCORER_CONFIG.dimensionCaps.acquisition);
    expect(merged.dimensionCaps.roi).toBe(DEFAULT_SCORER_CONFIG.dimensionCaps.roi);
    expect(merged.marketTrend.rising).toBe(DEFAULT_SCORER_CONFIG.marketTrend.rising);
    expect(merged.leadTypeScores).toEqual(DEFAULT_SCORER_CONFIG.leadTypeScores);
  });

  it('applies a valid partial override, leaving siblings at default', () => {
    const merged = mergeScorerConfig({ verdictThresholds: { strong: 80 } });
    expect(merged.verdictThresholds.strong).toBe(80);
    expect(merged.verdictThresholds.viable).toBe(DEFAULT_SCORER_CONFIG.verdictThresholds.viable);
    expect(merged.verdictThresholds.thin).toBe(DEFAULT_SCORER_CONFIG.verdictThresholds.thin);
  });

  it('falls back to base bands when the override array is malformed', () => {
    const merged = mergeScorerConfig({ bmvBands: [{ nonsense: true }, 42, 'x'] });
    expect(merged.bmvBands).toEqual(DEFAULT_SCORER_CONFIG.bmvBands);
  });
});

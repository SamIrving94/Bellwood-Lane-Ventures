import { describe, expect, it } from 'vitest';
import type { EnrichedLead } from '../enrichment';
import {
  combineScore,
  type LeadSignals,
  scoreDealRoi,
  scoreLead,
} from '../scorer';

function probateLead(overrides: Partial<EnrichedLead> = {}): EnrichedLead {
  return {
    probateRef: 'gazette-1',
    address: '12 Sevenoaks Avenue',
    postcode: 'SK4 4AP',
    leadType: 'probate',
    grantDate: '2026-06-01',
    grantType: 'probate',
    daysSinceGrant: 5,
    goldenWindowLabel: 'hot',
    solicitorFirm: 'Acme Law',
    estateValuePence: 75_000_000,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    enrichmentTier: 3,
    sourceTrail: 'gazette → tier3/manual',
    ...overrides,
  };
}

describe('scorer — two-pillar model', () => {
  it('no longer awards a "hot probate window" bonus', () => {
    const b = scoreLead(probateLead(), null, null, {});
    expect(b.factors.some((f) => /probate window/i.test(f.label))).toBe(false);
  });

  it('scores acquisition from lead type + days on market + condition', () => {
    const signals: LeadSignals = {
      listingType: 'unmodernised-properties',
      daysOnMarket: 120,
    };
    const b = scoreLead(probateLead(), null, null, signals);
    // probate (20) + on-market 90+ (8) + unmodernised (10) = 38, capped ≤45.
    expect(b.acquisition).toBeGreaterThanOrEqual(30);
    expect(b.factors.some((f) => f.dimension === 'acquisition' && /unmodernised/i.test(f.label))).toBe(true);
    expect(b.factors.some((f) => /on market/i.test(f.label))).toBe(true);
  });

  it('is not appraised at sourcing and marks ROI provisional', () => {
    const b = scoreLead(probateLead(), { avgPrice: 500_000 } as never, null, {});
    expect(b.appraised).toBe(false);
    const roiFactor = b.factors.find((f) => f.dimension === 'roi');
    expect(roiFactor?.provisional).toBe(true);
  });

  it('exposes the single biggest driver as the leading indicator', () => {
    const b = scoreLead(probateLead(), null, null, { listingType: 'unmodernised-properties' });
    expect(b.leadingIndicator).not.toBeNull();
    // Probate (20) is the biggest single factor here.
    expect(b.leadingIndicator?.points).toBe(20);
  });
});

describe('scoreDealRoi (stage 2)', () => {
  it('bands the BMV discount and cash ROI', () => {
    const factors = scoreDealRoi({ bmvDiscountPct: 20, cashRoiPct: 22 });
    const bmv = factors.find((f) => /BMV/i.test(f.label));
    const roi = factors.find((f) => /Cash ROI/i.test(f.label));
    expect(bmv?.points).toBe(25); // ≥20% below market
    expect(roi?.points).toBe(12); // 20–25% cash ROI
  });

  it('damps ROI credit on a low-confidence AVM, and removes it at 0 comps', () => {
    const full = scoreDealRoi({ bmvDiscountPct: 20, cashRoiPct: 22, avmConfidence: 'high', comparableCount: 6 });
    const low = scoreDealRoi({ bmvDiscountPct: 20, cashRoiPct: 22, avmConfidence: 'low', comparableCount: 1 });
    const zero = scoreDealRoi({ bmvDiscountPct: 20, cashRoiPct: 22, avmConfidence: 'low', comparableCount: 0 });
    const sum = (fs: { points: number }[]) =>
      fs.reduce((s, f) => s + f.points, 0);
    expect(sum(full)).toBe(37); // 25 + 12
    expect(sum(low)).toBeLessThan(sum(full)); // ×0.3 damped
    expect(sum(low)).toBe(Math.round(25 * 0.3) + Math.round(12 * 0.3)); // 8 + 4 = 11
    expect(sum(zero)).toBe(0); // 0 comps → no credit
    // and the dampening is shown, not silent
    expect(low.some((f) => /confidence/i.test(f.label))).toBe(true);
    expect(zero.some((f) => /0 comps/i.test(f.label))).toBe(true);

    // HMO / large property: house AVM unreliable → no ROI credit even with
    // good comps + high confidence.
    const hmo = scoreDealRoi({ bmvDiscountPct: 20, cashRoiPct: 22, avmConfidence: 'high', comparableCount: 6, avmUnreliable: true });
    expect(sum(hmo)).toBe(0);
    expect(hmo.some((f) => /hmo/i.test(f.label))).toBe(true);
  });

  it('gives ZERO credit when asking is above market or the deal loses money', () => {
    // The "Land and Garages" case: asking 165% above a £264k AVM.
    const factors = scoreDealRoi({ bmvDiscountPct: -165, cashRoiPct: -36 });
    const bmv = factors.find((f) => /above market/i.test(f.label));
    const roi = factors.find((f) => /loss/i.test(f.label));
    expect(bmv?.points).toBe(0);
    expect(roi?.points).toBe(0);
    expect(factors.every((f) => f.points === 0)).toBe(true);
  });
});

describe('combineScore — folding appraisal ROI into the score', () => {
  it('replaces the provisional proxy with real ROI and flips appraised', () => {
    const sourcing = scoreLead(probateLead(), { avgPrice: 500_000 } as never, null, {
      listingType: 'unmodernised-properties',
      daysOnMarket: 120,
    });
    const combined = combineScore(sourcing.factors, { bmvDiscountPct: 20, cashRoiPct: 22 }, {
      hasCriticalData: true,
    });
    expect(combined.appraised).toBe(true);
    // No provisional ROI factors survive.
    expect(combined.factors.some((f) => f.provisional)).toBe(false);
    // Real ROI pillar now contributes (25 + 12 capped at 40 = 37).
    expect(combined.roi).toBe(37);
    // Total went up vs the provisional sourcing score.
    expect(combined.total).toBeGreaterThan(sourcing.total);
  });
});

/**
 * Pure-module tests for offer-calculation.
 *
 * Lock the financial output bands so the offer engine never silently drifts.
 * The headline assertions are the ones that move real money:
 *   - finalOffer vs AVM (% band per seller type)
 *   - CEO escalation trigger
 *   - 14-day validity
 *   - Discount cap behaviour
 */

import { describe, expect, it } from 'vitest';
import { calculateOffer } from '../offer-calculation';
import { scoreRisk } from '../risk-scoring';
import { DEFAULT_OFFER_CONFIG } from '../offer-config';
import type { BaseValuation } from '../base-valuation';
import { mkEpc } from './test-fixtures';

function baseValuation(overrides: Partial<BaseValuation> = {}): BaseValuation {
  return {
    postcode: 'M14',
    propertyType: 'terraced',
    pointEstimate: 300_000,
    confidenceInterval: 0.03,
    confidenceLevel: 'high',
    hedonicValue: 300_000,
    csaValue: 300_000,
    comparables: [],
    hpi: { annualChange: 3, monthlyChange: 0.25, trend: 'rising', source: 'hmlr_hpi' } as BaseValuation['hpi'],
    epc: mkEpc('C'),
    floorAreaSqm: 85,
    floorAreaSource: 'propertydata',
    resolvedAddress: null,
    pricePerSqm: 3500,
    source: 'hmlr_ppd+hmlr_hpi+epc',
    ...overrides,
  };
}

describe('calculateOffer — seller type margins', () => {
  it('standard seller at 22% margin → offer ≈ 78% of AVM with no risk', () => {
    const bv = baseValuation();
    const risk = scoreRisk({ postcode: 'M14', epc: mkEpc('C') });

    const offer = calculateOffer({
      baseValuation: bv,
      riskScore: risk,
      sellerType: 'standard',
    });

    expect(offer.baseAcquisitionMargin).toBeCloseTo(0.22, 5);
    // No risk discount + grade B (no adjustment) → final offer = base offer
    expect(offer.finalOffer).toBe(Math.round(300_000 * 0.78));
    expect(offer.requiresCeoEscalation).toBe(false);
    expect(offer.discountCapped).toBe(false);
  });

  it('repossession seller takes the steepest 25% base margin', () => {
    const bv = baseValuation();
    const risk = scoreRisk({ postcode: 'M14', epc: mkEpc('C') });

    const offer = calculateOffer({
      baseValuation: bv,
      riskScore: risk,
      sellerType: 'repossession',
    });

    expect(offer.baseAcquisitionMargin).toBeCloseTo(0.25, 5);
    expect(offer.finalOffer).toBe(Math.round(300_000 * 0.75));
  });

  it('probate seller at 20% margin', () => {
    const bv = baseValuation();
    const risk = scoreRisk({ postcode: 'M14', epc: mkEpc('C') });

    const offer = calculateOffer({
      baseValuation: bv,
      riskScore: risk,
      sellerType: 'probate',
    });

    expect(offer.baseAcquisitionMargin).toBeCloseTo(0.20, 5);
    expect(offer.finalOffer).toBe(Math.round(300_000 * 0.80));
  });
});

describe('calculateOffer — risk discounts stack onto base margin', () => {
  it('EPC F + flood zone 2 push the offer down ~3% from the base', () => {
    const bv = baseValuation();
    const risk = scoreRisk({
      postcode: 'M14',
      epc: mkEpc('F'),
      floodZone: 'zone_2',
    });

    const offer = calculateOffer({
      baseValuation: bv,
      riskScore: risk,
      sellerType: 'chain_break',
    });

    // Base 20% chain-break + EPC F (-2%) + flood zone 2 (-1%) = ~23% off AVM
    const expectedFinal = Math.round(300_000 * 0.80) - Math.round(300_000 * 0.03);
    // Allow ±£100 jitter to absorb rounding chain
    expect(Math.abs(offer.finalOffer - expectedFinal)).toBeLessThanOrEqual(100);
    expect(offer.discountLines.some((d) => d.label.includes('EPC band F'))).toBe(true);
    expect(offer.discountLines.some((d) => d.label.includes('Flood'))).toBe(true);
  });
});

describe('calculateOffer — guard rails', () => {
  it('floor: offer below 60% of AVM triggers CEO escalation and clips to floor', () => {
    const bv = baseValuation();
    // Maximal risk to push the offer through the floor
    const risk = scoreRisk({
      postcode: 'M14',
      epc: mkEpc('G'),
      radonCategory: 5,
      coalMiningZone: 'active_high',
      knotweedProximity: 'on_plot',
      floodZone: 'zone_3b',
      noiseBand: 'above_70',
      constructionType: 'mundic',
    });

    const offer = calculateOffer({
      baseValuation: bv,
      riskScore: risk,
      sellerType: 'repossession',
      remainingLeaseYears: 35, // adds 30% lease discount on top
    });

    // Risk-stacked offer can only fall to the 60% floor
    expect(offer.finalOffer).toBeGreaterThanOrEqual(Math.round(300_000 * 0.60));
    expect(offer.requiresCeoEscalation).toBe(true);
  });

  it('offer validity is 14 days from issue', () => {
    const bv = baseValuation();
    const risk = scoreRisk({ postcode: 'M14', epc: mkEpc('C') });
    const offer = calculateOffer({
      baseValuation: bv,
      riskScore: risk,
      sellerType: 'standard',
    });

    const validUntil = new Date(offer.validUntil + 'T00:00:00Z').getTime();
    const expected = new Date().getTime() + 14 * 24 * 60 * 60 * 1000;
    // Allow ±36h slack for DST / day rollover edge cases
    expect(Math.abs(validUntil - expected)).toBeLessThan(36 * 60 * 60 * 1000);
  });

  it('total discount is capped at the config ceiling', () => {
    const bv = baseValuation();
    const risk = scoreRisk({
      postcode: 'M14',
      epc: mkEpc('G'),
      knotweedProximity: 'on_plot',
      floodZone: 'zone_3b',
      constructionType: 'mundic',
    });

    const offer = calculateOffer({
      baseValuation: bv,
      riskScore: risk,
      sellerType: 'repossession',
      remainingLeaseYears: 30,
    });

    expect(offer.totalDiscountFraction).toBeLessThanOrEqual(DEFAULT_OFFER_CONFIG.totalDiscountCap);
    expect(offer.discountCapped).toBe(true);
  });
});

describe('calculateOffer — investment grade nudge', () => {
  it('A+ grade reduces base margin by 3 percentage points', () => {
    const bv = baseValuation();
    const risk = scoreRisk({ postcode: 'M14', epc: mkEpc('A') });

    const offer = calculateOffer({
      baseValuation: bv,
      riskScore: risk,
      sellerType: 'standard',
      investmentGrade: 'A+',
    });

    // Standard 22% → 19% effective base margin
    expect(offer.baseAcquisitionMargin).toBeCloseTo(0.19, 5);
  });
});

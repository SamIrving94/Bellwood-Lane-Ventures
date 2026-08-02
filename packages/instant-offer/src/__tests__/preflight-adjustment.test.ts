/**
 * The 60%-of-AVM escalation rail, re-tested AFTER the preflight adjustment.
 *
 * `generateInstantOffer` decides `requiresReview` from the pre-adjustment
 * figure, which the offer calculator has already clamped to the floor. The
 * quote route then multiplies that figure by the PropertyData preflight
 * adjustment — so the number the seller is shown (a firm price, locked 72
 * hours) can sit under the floor even though the offer that was reviewed did
 * not. These tests pin the re-check.
 *
 * Money note: every field here is integer PENCE.
 */

import { DEFAULT_OFFER_CONFIG } from '@repo/valuation/src/offer-config';
import { describe, expect, it } from 'vitest';
import {
  type InstantOfferResult,
  MAX_PREFLIGHT_ADJUSTMENT,
  applyPreflightAdjustment,
} from '../index';

const FLOOR = DEFAULT_OFFER_CONFIG.floorFraction;
const AVM_MID = 300_000_00; // £300,000 in pence

/**
 * An offer at `percentOfAvm` of a £300,000 AVM. The AVM range is symmetric
 * around the point estimate, exactly as runAVM builds it.
 */
function offerAt(percentOfAvm: number): InstantOfferResult {
  return {
    estimatedMarketValueMinPence: Math.round(AVM_MID * 0.9),
    estimatedMarketValueMaxPence: Math.round(AVM_MID * 1.1),
    offerPence: Math.round(AVM_MID * percentOfAvm),
    offerPercentOfAvm: Math.round(percentOfAvm * 1000) / 1000,
    confidenceScore: 0.8,
    completionDays: 21,
    reasoning: ['12 comparable sales in M20 1AA (last 24 months) via hmlr_ppd'],
    narrative: null,
    lockedUntil: new Date(Date.now() + 72 * 60 * 60 * 1000),
    requiresReview: false,
  };
}

describe('applyPreflightAdjustment', () => {
  it('escalates when a negative adjustment takes the offer under the floor', () => {
    // 62% of AVM, knocked down 5% -> 58.9%: the exact case that shipped as a
    // firm price with no escalation card.
    const result = applyPreflightAdjustment(offerAt(0.62), -0.05);

    expect(result.offerPercentOfAvm).toBeLessThan(FLOOR);
    expect(result.belowAvmFloor).toBe(true);
    expect(result.requiresReview).toBe(true);
    expect(result.reasoning.join(' ')).toContain('below the 60% floor');
  });

  it('leaves a compliant offer alone', () => {
    const result = applyPreflightAdjustment(offerAt(0.72), -0.03);

    expect(result.offerPercentOfAvm).toBeGreaterThan(FLOOR);
    expect(result.belowAvmFloor).toBe(false);
    expect(result.requiresReview).toBe(false);
    expect(result.reasoning).toHaveLength(1);
  });

  it('does not clear a review flag the base offer already raised', () => {
    const base = { ...offerAt(0.7), requiresReview: true };
    const result = applyPreflightAdjustment(base, 0.05);

    expect(result.belowAvmFloor).toBe(false);
    expect(result.requiresReview).toBe(true);
  });

  it('reads the floor from the offer config rather than a literal', () => {
    // A tuned-up floor must move the rail with it: 78% -> 74.1% is fine
    // against the default 60% floor, but breaches a configured 75% one.
    const result = applyPreflightAdjustment(offerAt(0.78), -0.05, {
      ...DEFAULT_OFFER_CONFIG,
      floorFraction: 0.75,
    });

    expect(applyPreflightAdjustment(offerAt(0.78), -0.05).belowAvmFloor).toBe(
      false
    );

    expect(result.belowAvmFloor).toBe(true);
    expect(result.requiresReview).toBe(true);
    expect(result.reasoning.join(' ')).toContain('below the 75% floor');
  });

  it('clamps the adjustment to ±5%', () => {
    const up = applyPreflightAdjustment(offerAt(0.7), 0.5);
    const down = applyPreflightAdjustment(offerAt(0.7), -0.5);

    expect(up.appliedAdjustment).toBe(MAX_PREFLIGHT_ADJUSTMENT);
    expect(down.appliedAdjustment).toBe(-MAX_PREFLIGHT_ADJUSTMENT);
    expect(up.offerPence).toBe(Math.round(AVM_MID * 0.7 * 1.05));
  });

  it('is a no-op on a zero adjustment', () => {
    const base = offerAt(0.7);
    const result = applyPreflightAdjustment(base, 0);

    expect(result.offerPence).toBe(base.offerPence);
    expect(result.offerPercentOfAvm).toBe(base.offerPercentOfAvm);
    expect(result.requiresReview).toBe(false);
  });

  it('preserves the base reasoning trail and appends the floor line once', () => {
    const base = {
      ...offerAt(0.62),
      reasoning: ['line one', 'line two'],
    };
    const result = applyPreflightAdjustment(base, -0.05);

    expect(result.reasoning.slice(0, 2)).toEqual(['line one', 'line two']);
    expect(
      result.reasoning.filter((r) => r.includes('below the 60% floor'))
    ).toHaveLength(1);
  });
});

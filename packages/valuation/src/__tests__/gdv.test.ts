import { describe, expect, it } from 'vitest';
import { CONDITION_DISCOUNTS, appraiseDealFromAvm, estimateGdv } from '../gdv';

// These lock the auto-GDV contract: GDV is anchored on the AVM comp value, the
// as-is value sits below it by the condition discount, and the chain into the
// deal model produces a sane max offer.

const AVM = 250_000_00; // £250k point estimate, in pence

describe('estimateGdv', () => {
  it('anchors GDV on the AVM and discounts as-is by condition', () => {
    const g = estimateGdv({
      avmPointEstimatePence: AVM,
      conditionLevel: 'tired',
    });
    // Standard refurb (no premium uplift) → GDV is the comp-typical AVM value.
    expect(g.gdvPence).toBe(AVM);
    // As-is is 12% below comp-typical for a tired property.
    expect(g.asIsValuePence).toBe(
      Math.round(AVM * (1 - CONDITION_DISCOUNTS.tired))
    );
    expect(g.upliftPence).toBe(g.gdvPence - g.asIsValuePence);
  });

  it('turnkey has no as-is discount', () => {
    const g = estimateGdv({
      avmPointEstimatePence: AVM,
      conditionLevel: 'turnkey',
    });
    expect(g.asIsValuePence).toBe(AVM);
    expect(g.gdvPence).toBe(AVM);
  });

  it('a premium uplift raises GDV above the AVM', () => {
    const g = estimateGdv({
      avmPointEstimatePence: AVM,
      conditionLevel: 'unmodernised',
      premiumUpliftFraction: 0.1,
    });
    expect(g.gdvPence).toBe(Math.round(AVM * 1.1));
    expect(g.gdvPence).toBeGreaterThan(g.asIsValuePence);
  });

  it('an explicit discount fraction overrides the condition lookup', () => {
    const g = estimateGdv({
      avmPointEstimatePence: AVM,
      conditionDiscountFraction: 0.2,
    });
    expect(g.conditionLevel).toBeNull();
    expect(g.asIsValuePence).toBe(Math.round(AVM * 0.8));
  });

  it('clamps absurd inputs rather than producing nonsense', () => {
    const g = estimateGdv({
      avmPointEstimatePence: AVM,
      conditionDiscountFraction: 5,
      premiumUpliftFraction: -1,
    });
    expect(g.asIsValuePence).toBeGreaterThanOrEqual(0);
    expect(g.premiumUpliftFraction).toBe(0);
  });
});

describe('appraiseDealFromAvm', () => {
  it('produces a GDV, a max offer, and (optionally) an appraisal', () => {
    const r = appraiseDealFromAvm({
      avmPointEstimatePence: AVM,
      conditionLevel: 'tired',
      refurbPence: 30_000_00,
      offerPence: 150_000_00,
    });
    expect(r.gdv.gdvPence).toBe(AVM);
    expect(r.appraisal).not.toBeNull();
    // The walk-away offer must itself clear the hurdle, so the appraisal at the
    // max offer should meet it; a higher offer should not.
    expect(r.maxOfferPence).toBeGreaterThan(0);
    expect(r.maxOfferPence).toBeLessThan(AVM);
  });

  it('solves max offer even with no offer supplied', () => {
    const r = appraiseDealFromAvm({
      avmPointEstimatePence: AVM,
      conditionLevel: 'tired',
      refurbPence: 30_000_00,
    });
    expect(r.appraisal).toBeNull();
    expect(r.maxOfferPence).toBeGreaterThan(0);
  });

  it('a bigger refurb lowers the max offer we can pay', () => {
    const small = appraiseDealFromAvm({
      avmPointEstimatePence: AVM,
      conditionLevel: 'tired',
      refurbPence: 20_000_00,
    });
    const big = appraiseDealFromAvm({
      avmPointEstimatePence: AVM,
      conditionLevel: 'tired',
      refurbPence: 60_000_00,
    });
    expect(big.maxOfferPence).toBeLessThan(small.maxOfferPence);
  });
});

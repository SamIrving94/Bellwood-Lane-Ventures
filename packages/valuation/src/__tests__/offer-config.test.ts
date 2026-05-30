/**
 * mergeOfferConfig — must NEVER throw on bad input.
 *
 * The founder edits this config from the dashboard. A malformed JSON blob
 * MUST degrade gracefully to defaults, not crash the AVM.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_OFFER_CONFIG, mergeOfferConfig } from '../offer-config';

describe('mergeOfferConfig', () => {
  it('returns the defaults when given null / undefined / non-object', () => {
    expect(mergeOfferConfig(null)).toEqual(DEFAULT_OFFER_CONFIG);
    expect(mergeOfferConfig(undefined)).toEqual(DEFAULT_OFFER_CONFIG);
    expect(mergeOfferConfig('not an object')).toEqual(DEFAULT_OFFER_CONFIG);
    expect(mergeOfferConfig(42)).toEqual(DEFAULT_OFFER_CONFIG);
    expect(mergeOfferConfig([])).toEqual(DEFAULT_OFFER_CONFIG);
  });

  it('overrides only the keys provided, defaults the rest', () => {
    const merged = mergeOfferConfig({
      floorFraction: 0.55,
      sellerTypeMargin: { probate: 0.18 },
    });

    expect(merged.floorFraction).toBe(0.55);
    expect(merged.sellerTypeMargin.probate).toBe(0.18);
    expect(merged.sellerTypeMargin.standard).toBe(DEFAULT_OFFER_CONFIG.sellerTypeMargin.standard);
    expect(merged.ceilingFraction).toBe(DEFAULT_OFFER_CONFIG.ceilingFraction);
  });

  it('ignores wrong-typed values silently and falls back to defaults', () => {
    const merged = mergeOfferConfig({
      floorFraction: 'broken',
      ceilingFraction: NaN,
      sellerTypeMargin: { probate: 'still broken' },
    });

    expect(merged.floorFraction).toBe(DEFAULT_OFFER_CONFIG.floorFraction);
    expect(merged.ceilingFraction).toBe(DEFAULT_OFFER_CONFIG.ceilingFraction);
    expect(merged.sellerTypeMargin.probate).toBe(DEFAULT_OFFER_CONFIG.sellerTypeMargin.probate);
  });
});

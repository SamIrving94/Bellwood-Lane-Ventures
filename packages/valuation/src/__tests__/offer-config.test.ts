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
    expect(merged.sellerTypeMargin.standard).toBe(
      DEFAULT_OFFER_CONFIG.sellerTypeMargin.standard
    );
    expect(merged.ceilingFraction).toBe(DEFAULT_OFFER_CONFIG.ceilingFraction);
  });

  it('carries the uncertainty-throttle bounds with sane defaults', () => {
    // The Zillow-lesson bounds: AVM judged on its own interval, deep
    // appraisals on the LLM's 80% CI. Defaults flag only low-confidence AVM
    // runs (width 0.16) and wider-than-usual deep appraisals (width > 0.30).
    expect(DEFAULT_OFFER_CONFIG.maxIntervalWidthRatio).toBe(0.15);
    expect(DEFAULT_OFFER_CONFIG.maxDeepIntervalWidthRatio).toBe(0.3);

    const merged = mergeOfferConfig({
      maxIntervalWidthRatio: 0.12,
      maxDeepIntervalWidthRatio: 'broken',
    });
    expect(merged.maxIntervalWidthRatio).toBe(0.12);
    expect(merged.maxDeepIntervalWidthRatio).toBe(
      DEFAULT_OFFER_CONFIG.maxDeepIntervalWidthRatio
    );
  });

  it('ignores wrong-typed values silently and falls back to defaults', () => {
    const merged = mergeOfferConfig({
      floorFraction: 'broken',
      ceilingFraction: Number.NaN,
      sellerTypeMargin: { probate: 'still broken' },
    });

    expect(merged.floorFraction).toBe(DEFAULT_OFFER_CONFIG.floorFraction);
    expect(merged.ceilingFraction).toBe(DEFAULT_OFFER_CONFIG.ceilingFraction);
    expect(merged.sellerTypeMargin.probate).toBe(
      DEFAULT_OFFER_CONFIG.sellerTypeMargin.probate
    );
  });
});

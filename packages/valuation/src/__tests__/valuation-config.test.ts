import { describe, expect, it } from 'vitest';
import { estimateGdv } from '../gdv';
import { estimateRefurb } from '../refurb';
import {
  DEFAULT_VALUATION_CONFIG,
  mergeValuationConfig,
} from '../valuation-config';

describe('mergeValuationConfig', () => {
  it('returns defaults for empty / invalid input', () => {
    expect(mergeValuationConfig(null)).toEqual(DEFAULT_VALUATION_CONFIG);
    expect(mergeValuationConfig('nope')).toEqual(DEFAULT_VALUATION_CONFIG);
  });

  it('overrides only valid known keys, keeping the rest default', () => {
    const merged = mergeValuationConfig({
      refurbPerSqm: { tired: 700_00, bogus: 99 },
      targetCashRoi: 0.25,
      conditionDiscounts: { tired: 0.15 },
    });
    expect(merged.refurbPerSqm.tired).toBe(700_00);
    // unknown key ignored
    expect('bogus' in merged.refurbPerSqm).toBe(false);
    // untouched key keeps default
    expect(merged.refurbPerSqm.derelict).toBe(
      DEFAULT_VALUATION_CONFIG.refurbPerSqm.derelict
    );
    expect(merged.targetCashRoi).toBe(0.25);
    expect(merged.conditionDiscounts.tired).toBe(0.15);
  });

  it('rejects out-of-range values', () => {
    const merged = mergeValuationConfig({
      targetCashRoi: 5, // > 1
      conditionDiscounts: { tired: 0.9 }, // > 0.6
    });
    expect(merged.targetCashRoi).toBe(DEFAULT_VALUATION_CONFIG.targetCashRoi);
    expect(merged.conditionDiscounts.tired).toBe(
      DEFAULT_VALUATION_CONFIG.conditionDiscounts.tired
    );
  });
});

describe('config flows into the engines', () => {
  it('estimateRefurb honours overridden £/m²', () => {
    const cfg = mergeValuationConfig({ refurbPerSqm: { tired: 700_00 } });
    const r = estimateRefurb(
      { condition: 'tired', floorAreaSqm: 100 },
      { perSqm: cfg.refurbPerSqm, flagCost: cfg.refurbFlagCosts }
    );
    expect(r.totalPence).toBe(700_00 * 100);
  });

  it('estimateGdv honours overridden condition discount', () => {
    const cfg = mergeValuationConfig({ conditionDiscounts: { tired: 0.2 } });
    const g = estimateGdv({
      avmPointEstimatePence: 200_000_00,
      conditionLevel: 'tired',
      conditionDiscounts: cfg.conditionDiscounts,
    });
    expect(g.asIsValuePence).toBe(Math.round(200_000_00 * 0.8));
  });
});

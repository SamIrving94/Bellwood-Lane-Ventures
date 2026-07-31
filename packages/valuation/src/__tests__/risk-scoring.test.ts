/**
 * Pure-module tests for risk-scoring.
 *
 * No mocking required — scoreRisk takes its inputs directly.
 */

import { describe, expect, it } from 'vitest';
import { scoreRisk } from '../risk-scoring';
import { mkEpc } from './test-fixtures';

describe('scoreRisk — defaults', () => {
  it('zero-risk property scores composite 0 and produces no flags', () => {
    const result = scoreRisk({
      postcode: 'M14 5AB',
      epc: mkEpc('C', 85, '1981-1990'),
    });

    expect(result.composite).toBe(0);
    expect(result.preRicsFlags).toEqual([]);
    expect(result.environmental.envBand).toBe('green');
    expect(result.totalDiscountFraction).toBe(0);
  });
});

describe('scoreRisk — environmental factors', () => {
  it('flood zone 3a triggers a pre-RICS flag', () => {
    const result = scoreRisk({
      postcode: 'M14 5AB',
      epc: mkEpc('C'),
      floodZone: 'zone_3a',
    });

    expect(result.environmental.flood.flag).toBe(true);
    expect(result.preRicsFlags.some((f) => f.includes('Flood'))).toBe(true);
    expect(result.environmental.flood.discountFraction).toBeCloseTo(0.035, 5);
  });

  it('on-plot knotweed triggers flag and ~7.5% discount', () => {
    const result = scoreRisk({
      postcode: 'M14 5AB',
      epc: mkEpc('C'),
      knotweedProximity: 'on_plot',
    });

    expect(result.environmental.knotweed.flag).toBe(true);
    expect(result.environmental.knotweed.discountFraction).toBeCloseTo(0.075, 5);
    expect(result.preRicsFlags.some((f) => f.toLowerCase().includes('knotweed'))).toBe(true);
  });

  it('aggregate environmental discount is capped at 12%', () => {
    const result = scoreRisk({
      postcode: 'M14 5AB',
      epc: mkEpc('C'),
      radonCategory: 5,
      coalMiningZone: 'active_high',
      knotweedProximity: 'on_plot',
      floodZone: 'zone_3b',
      noiseBand: 'above_70',
    });

    expect(result.environmental.totalEnvDiscount).toBeCloseTo(0.12, 5);
    expect(result.environmental.envBand).toBe('black');
    // Composite score capped at 100 when env+building are maxed
    expect(result.composite).toBeLessThanOrEqual(100);
  });
});

describe('scoreRisk — building characteristics', () => {
  it('EPC F applies a 2% downward adjustment and pre-RICS flag', () => {
    const result = scoreRisk({
      postcode: 'M14 5AB',
      epc: mkEpc('F', 80, '1919-1944'),
    });

    expect(result.building.epcAdjustment).toBe(-0.02);
    expect(result.preRicsFlags.some((f) => f.includes('EPC band F'))).toBe(true);
  });

  it('non-standard construction (mundic) flags structural engineer', () => {
    const result = scoreRisk({
      postcode: 'M14 5AB',
      epc: mkEpc('D'),
      constructionType: 'mundic',
    });

    expect(result.building.nonStandardFlag).toBe(true);
    expect(result.building.constructionDiscount).toBeCloseTo(0.05, 5);
    expect(result.preRicsFlags.some((f) => f.includes('structural engineer'))).toBe(true);
  });
});

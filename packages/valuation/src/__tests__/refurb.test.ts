import { describe, expect, it } from 'vitest';
import {
  CONDITION_COST_PER_SQM,
  DEFAULT_FLOOR_AREA_SQM,
  FLAG_COST,
  estimateRefurb,
} from '../refurb';

// The refurb estimate is the one input the founder has to trust, so these lock
// the breakdown: base = £/m² × area, defect flags add explicit lines, and the
// numbers are transparent (every line sums to the total).

describe('estimateRefurb', () => {
  it('builds a base cost from condition £/m² × floor area', () => {
    const r = estimateRefurb({ condition: 'tired', floorAreaSqm: 80 });
    expect(r.conditionUsed).toBe('tired');
    expect(r.floorAreaSqm).toBe(80);
    expect(r.assumedFloorArea).toBe(false);
    // 80m² × £550/m² = £44,000.
    expect(r.totalPence).toBe(CONDITION_COST_PER_SQM.tired * 80);
    expect(r.lines).toHaveLength(1);
  });

  it('adds a transparent line per photo flag, summing to the total', () => {
    const r = estimateRefurb({
      condition: 'tired',
      floorAreaSqm: 80,
      flags: ['no_kitchen', 'damp_visible'],
    });
    // base + two defect lines
    expect(r.lines).toHaveLength(3);
    const sum = r.lines.reduce((s, l) => s + l.pence, 0);
    expect(r.totalPence).toBe(sum);
    // The two flags are reflected in the total.
    expect(r.totalPence).toBe(
      CONDITION_COST_PER_SQM.tired * 80 +
        FLAG_COST.no_kitchen +
        FLAG_COST.damp_visible
    );
  });

  it('does not double-count missing fittings on a derelict (base covers it)', () => {
    const r = estimateRefurb({
      condition: 'derelict',
      floorAreaSqm: 80,
      flags: ['no_kitchen', 'no_bathroom', 'roof_damage'],
    });
    const labels = r.lines.map((l) => l.label);
    expect(labels.some((l) => l.includes('Missing kitchen'))).toBe(false);
    expect(labels.some((l) => l.includes('Missing bathroom'))).toBe(false);
    // Roof damage is extraordinary — still added on top of the heavy base.
    expect(labels.some((l) => l.includes('Roof damage'))).toBe(true);
  });

  it('assumes a default floor area when EPC has none, and flags it', () => {
    const r = estimateRefurb({ condition: 'tired', floorAreaSqm: null });
    expect(r.assumedFloorArea).toBe(true);
    expect(r.floorAreaSqm).toBe(DEFAULT_FLOOR_AREA_SQM);
    expect(r.basis).toContain('assumed');
  });

  it('falls back to a sensible condition when none is given', () => {
    const r = estimateRefurb({ condition: null, floorAreaSqm: 80 });
    expect(r.conditionUsed).toBe('tired');
    expect(r.totalPence).toBeGreaterThan(0);
  });

  it('a pristine property needs no base works', () => {
    const r = estimateRefurb({ condition: 'pristine', floorAreaSqm: 80 });
    expect(r.totalPence).toBe(0);
    expect(r.lines).toHaveLength(0);
  });
});

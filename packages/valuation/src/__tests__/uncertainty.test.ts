/**
 * Uncertainty discipline — the Zillow lesson made testable.
 *
 * readUncertainty stamps a single appraisal; compareMedianShift /
 * compareShareShift power the weekly portfolio trend. All pure math, so the
 * tests lock exact behaviour: the throttle surfaces, never blocks, and the
 * trend check refuses to alert on thin samples.
 */

import { describe, expect, it } from 'vitest';
import {
  MATERIAL_SHIFT_RATIO,
  MIN_TREND_SAMPLES,
  compareMedianShift,
  compareShareShift,
  median,
  readUncertainty,
} from '../uncertainty';

describe('readUncertainty', () => {
  it('computes interval width as a fraction of the point estimate', () => {
    const reading = readUncertainty({
      pointEstimate: 200_000,
      low: 190_000,
      high: 210_000,
      comparableCount: 6,
      maxWidthRatio: 0.15,
    });
    expect(reading.intervalWidthRatio).toBeCloseTo(0.1, 10);
    expect(reading.comparableCount).toBe(6);
    expect(reading.maxWidthRatio).toBe(0.15);
    expect(reading.secondCheckRequired).toBe(false);
  });

  it('flags a second check when the width exceeds the bound', () => {
    const reading = readUncertainty({
      pointEstimate: 200_000,
      low: 184_000,
      high: 216_000, // width 0.16 — the low-confidence AVM interval
      maxWidthRatio: 0.15,
    });
    expect(reading.intervalWidthRatio).toBeCloseTo(0.16, 10);
    expect(reading.secondCheckRequired).toBe(true);
  });

  it('does not flag a width exactly at the bound', () => {
    const reading = readUncertainty({
      pointEstimate: 100_000,
      low: 92_500,
      high: 107_500, // width exactly 0.15
      maxWidthRatio: 0.15,
    });
    expect(reading.secondCheckRequired).toBe(false);
  });

  it('treats an unmeasurable interval as itself needing a second check', () => {
    // Zero / negative point estimates and inverted intervals cannot support a
    // width — that absence of evidence is a reason for a human look, not a pass.
    for (const bad of [
      { pointEstimate: 0, low: 0, high: 0 },
      { pointEstimate: -5, low: -6, high: -4 },
      { pointEstimate: 100, low: 110, high: 90 }, // high < low
      { pointEstimate: Number.NaN, low: 1, high: 2 },
    ]) {
      const reading = readUncertainty({ ...bad, maxWidthRatio: 0.15 });
      expect(reading.intervalWidthRatio).toBeNull();
      expect(reading.secondCheckRequired).toBe(true);
    }
  });

  it('defaults comparableCount to null when not provided', () => {
    const reading = readUncertainty({
      pointEstimate: 100,
      low: 95,
      high: 105,
      maxWidthRatio: 0.15,
    });
    expect(reading.comparableCount).toBeNull();
  });
});

describe('median', () => {
  it('handles odd and even counts', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('ignores non-finite values and returns null when nothing survives', () => {
    expect(median([Number.NaN, 5, Number.POSITIVE_INFINITY])).toBe(5);
    expect(median([])).toBeNull();
    expect(median([Number.NaN])).toBeNull();
  });
});

describe('compareMedianShift', () => {
  const flat = [0.1, 0.1, 0.1, 0.1, 0.1];
  const widened = [0.14, 0.14, 0.14, 0.14, 0.14]; // 1.4× — past the 1.25 bar

  it('flags a material widening (current ÷ prior ≥ the ratio)', () => {
    const shift = compareMedianShift(widened, flat);
    expect(shift.shiftRatio).toBeCloseTo(1.4, 10);
    expect(shift.material).toBe(true);
  });

  it('stays quiet below the material ratio', () => {
    const shift = compareMedianShift([0.11, 0.11, 0.11, 0.11, 0.11], flat);
    expect(shift.material).toBe(false);
  });

  it('refuses to alert on thin samples on either side', () => {
    const thin = compareMedianShift(
      widened.slice(0, MIN_TREND_SAMPLES - 1),
      flat
    );
    expect(thin.shiftRatio).toBeNull();
    expect(thin.material).toBe(false);

    const thinPrior = compareMedianShift(widened, flat.slice(0, 2));
    expect(thinPrior.material).toBe(false);
  });

  it("direction 'up' ignores narrowing; 'both' catches it", () => {
    const narrowed = [0.07, 0.07, 0.07, 0.07, 0.07]; // 0.7× of prior
    expect(compareMedianShift(narrowed, flat).material).toBe(false);
    expect(
      compareMedianShift(narrowed, flat, { direction: 'both' }).material
    ).toBe(true);
  });

  it('returns null ratio when the prior median is zero', () => {
    const zeros = [0, 0, 0, 0, 0];
    const shift = compareMedianShift(flat, zeros);
    expect(shift.shiftRatio).toBeNull();
    expect(shift.material).toBe(false);
  });

  it('exports the shared defaults it judges against', () => {
    expect(MIN_TREND_SAMPLES).toBeGreaterThan(0);
    expect(MATERIAL_SHIFT_RATIO).toBeGreaterThan(1);
  });
});

describe('compareShareShift', () => {
  const mostlyFalse = [true, false, false, false, false];
  const mostlyTrue = [true, true, true, false, false];

  it('flags a material jump in share (either direction)', () => {
    const up = compareShareShift(mostlyTrue, mostlyFalse);
    expect(up.delta).toBeCloseTo(0.4, 10);
    expect(up.material).toBe(true);

    const down = compareShareShift(mostlyFalse, mostlyTrue);
    expect(down.delta).toBeCloseTo(-0.4, 10);
    expect(down.material).toBe(true);
  });

  it('stays quiet below the delta and on thin samples', () => {
    const steady = compareShareShift(mostlyFalse, [
      false,
      true,
      false,
      false,
      false,
    ]);
    expect(steady.material).toBe(false);

    const thin = compareShareShift([true, true], mostlyFalse);
    expect(thin.delta).toBeNull();
    expect(thin.material).toBe(false);
  });

  it('reports null shares for empty periods', () => {
    const empty = compareShareShift([], []);
    expect(empty.currentShare).toBeNull();
    expect(empty.priorShare).toBeNull();
    expect(empty.material).toBe(false);
  });
});

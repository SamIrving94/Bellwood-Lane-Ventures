import { describe, expect, it } from 'vitest';
import {
  type BacktestSample,
  computeBacktest,
  computeBacktestBySegment,
} from '../backtest';

describe('computeBacktest', () => {
  it('returns a zeroed report for no usable samples', () => {
    const r = computeBacktest([]);
    expect(r.n).toBe(0);
    expect(r.intervalCoverage).toBeNull();
  });

  it('drops samples with a non-positive actual', () => {
    const r = computeBacktest([
      { predictedPence: 100, actualPence: 0 },
      { predictedPence: 100, actualPence: -5 },
      { predictedPence: 110, actualPence: 100 },
    ]);
    expect(r.n).toBe(1);
  });

  it('computes a perfect-prediction report as all zeros', () => {
    const r = computeBacktest([
      { predictedPence: 250_000_00, actualPence: 250_000_00 },
      { predictedPence: 400_000_00, actualPence: 400_000_00 },
    ]);
    expect(r.mape).toBe(0);
    expect(r.medianApe).toBe(0);
    expect(r.maePence).toBe(0);
    expect(r.biasPct).toBe(0);
  });

  it('computes MAPE, MAE and median APE', () => {
    // Errors: +10% (110 vs 100) and -20% (80 vs 100) → |10%|,|20%|
    const r = computeBacktest([
      { predictedPence: 110, actualPence: 100 },
      { predictedPence: 80, actualPence: 100 },
    ]);
    expect(r.mape).toBeCloseTo(0.15); // (0.10 + 0.20)/2
    expect(r.medianApe).toBeCloseTo(0.15);
    expect(r.maePence).toBeCloseTo(15); // (10 + 20)/2
  });

  it('captures directional bias (positive = over-valuing)', () => {
    const over = computeBacktest([
      { predictedPence: 120, actualPence: 100 },
      { predictedPence: 130, actualPence: 100 },
    ]);
    expect(over.biasPct).toBeCloseTo(0.25); // (+0.2 + +0.3)/2

    const under = computeBacktest([{ predictedPence: 80, actualPence: 100 }]);
    expect(under.biasPct).toBeCloseTo(-0.2);
  });

  it('reports interval coverage only over samples that carry bounds', () => {
    const r = computeBacktest([
      // actual inside band
      {
        predictedPence: 100,
        actualPence: 100,
        intervalLowPence: 90,
        intervalHighPence: 110,
      },
      // actual outside band
      {
        predictedPence: 100,
        actualPence: 130,
        intervalLowPence: 90,
        intervalHighPence: 110,
      },
      // no bounds → excluded from coverage denominator
      { predictedPence: 100, actualPence: 100 },
    ]);
    expect(r.intervalSampleCount).toBe(2);
    expect(r.intervalCoverage).toBeCloseTo(0.5);
  });

  it('treats interval bounds as inclusive at the edges', () => {
    const r = computeBacktest([
      {
        predictedPence: 100,
        actualPence: 90,
        intervalLowPence: 90,
        intervalHighPence: 110,
      },
      {
        predictedPence: 100,
        actualPence: 110,
        intervalLowPence: 90,
        intervalHighPence: 110,
      },
    ]);
    expect(r.intervalCoverage).toBe(1);
  });
});

describe('computeBacktestBySegment', () => {
  it('splits reports by segment and keeps an overall', () => {
    const samples: BacktestSample[] = [
      { predictedPence: 110, actualPence: 100, segment: 'high' },
      { predictedPence: 90, actualPence: 100, segment: 'high' },
      { predictedPence: 150, actualPence: 100, segment: 'low' },
    ];
    const { overall, segments } = computeBacktestBySegment(samples);
    expect(overall.n).toBe(3);
    expect(segments.high.n).toBe(2);
    expect(segments.low.n).toBe(1);
    expect(segments.low.mape).toBeCloseTo(0.5);
  });
});

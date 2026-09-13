/**
 * AVM backtest — accuracy & calibration measurement (backtest.ts)
 *
 * The AVM emits confident point estimates and an "80%" interval, but until now
 * nothing measured whether those numbers are any good. This module is the pure
 * scoring core: given (predicted, actual) pairs it computes error (MAPE / MAE /
 * median APE), directional bias, and interval coverage (does the 80% band
 * actually contain ~80% of outcomes?).
 *
 * It is intentionally dependency-free and side-effect-free so it can be unit
 * tested and reused from a cron, a script, or a dashboard. Data assembly (which
 * predictions pair with which realized prices) lives in the caller.
 */

export interface BacktestSample {
  /** AVM point estimate, in pence. */
  predictedPence: number;
  /** Realized/actual sale price, in pence. */
  actualPence: number;
  /** Optional AVM interval lower bound, pence — for coverage calibration. */
  intervalLowPence?: number | null;
  /** Optional AVM interval upper bound, pence — for coverage calibration. */
  intervalHighPence?: number | null;
  /** Optional label (e.g. confidence level) for segmenting reports. */
  segment?: string;
}

export interface BacktestReport {
  /** Number of usable samples (actual > 0). */
  n: number;
  /** Mean Absolute Percentage Error as a fraction (0.12 = 12%). */
  mape: number;
  /** Median Absolute Percentage Error as a fraction — robust to outliers. */
  medianApe: number;
  /** Mean Absolute Error, in pence. */
  maePence: number;
  /**
   * Mean signed percentage error: mean((predicted − actual) / actual).
   * Positive = the AVM systematically OVER-values; negative = under-values.
   */
  biasPct: number;
  /**
   * Fraction (0–1) of samples whose actual fell within [low, high].
   * `null` when no sample carried interval bounds. Compare against the
   * interval's nominal level (e.g. 0.80) to judge calibration.
   */
  intervalCoverage: number | null;
  /** How many samples carried both interval bounds (the coverage denominator). */
  intervalSampleCount: number;
  /**
   * Median signed percentage error — the robust twin of `biasPct`. A handful
   * of wild misses can drag the mean; the median says where the TYPICAL
   * estimate sits relative to the sale.
   */
  medianSignedPct: number;
  /** Fraction (0–1) of samples within ±10% of the sale price (industry "PE10"). */
  withinPct10: number;
  /** Fraction (0–1) of samples within ±20% of the sale price ("PE20"). */
  withinPct20: number;
}

/** Absolute percentage error for one pair; caller guarantees actual > 0. */
function ape(predictedPence: number, actualPence: number): number {
  return Math.abs(predictedPence - actualPence) / actualPence;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Compute accuracy + calibration over a set of (predicted, actual) pairs.
 * Samples with a non-positive actual are dropped (can't form a percentage).
 */
export function computeBacktest(samples: BacktestSample[]): BacktestReport {
  const usable = samples.filter(
    (s) =>
      Number.isFinite(s.predictedPence) &&
      Number.isFinite(s.actualPence) &&
      s.actualPence > 0
  );

  const n = usable.length;
  if (n === 0) {
    return {
      n: 0,
      mape: 0,
      medianApe: 0,
      maePence: 0,
      biasPct: 0,
      intervalCoverage: null,
      intervalSampleCount: 0,
      medianSignedPct: 0,
      withinPct10: 0,
      withinPct20: 0,
    };
  }

  const apes: number[] = [];
  const signedPcts: number[] = [];
  let within10 = 0;
  let within20 = 0;
  let absErrorSum = 0;
  let signedPctSum = 0;
  let withinInterval = 0;
  let intervalSampleCount = 0;

  for (const s of usable) {
    const a = ape(s.predictedPence, s.actualPence);
    apes.push(a);
    if (a <= 0.1) {
      within10++;
    }
    if (a <= 0.2) {
      within20++;
    }
    absErrorSum += Math.abs(s.predictedPence - s.actualPence);
    const signed = (s.predictedPence - s.actualPence) / s.actualPence;
    signedPctSum += signed;
    signedPcts.push(signed);

    if (
      s.intervalLowPence != null &&
      s.intervalHighPence != null &&
      Number.isFinite(s.intervalLowPence) &&
      Number.isFinite(s.intervalHighPence)
    ) {
      intervalSampleCount++;
      if (
        s.actualPence >= s.intervalLowPence &&
        s.actualPence <= s.intervalHighPence
      ) {
        withinInterval++;
      }
    }
  }

  return {
    n,
    mape: apes.reduce((a, b) => a + b, 0) / n,
    medianApe: median(apes),
    maePence: absErrorSum / n,
    biasPct: signedPctSum / n,
    intervalCoverage:
      intervalSampleCount === 0 ? null : withinInterval / intervalSampleCount,
    intervalSampleCount,
    medianSignedPct: median(signedPcts),
    withinPct10: within10 / n,
    withinPct20: within20 / n,
  };
}

/**
 * Convenience: compute an overall report plus one report per `segment`
 * (e.g. AVM confidence level), so calibration can be inspected by cohort.
 */
export function computeBacktestBySegment(samples: BacktestSample[]): {
  overall: BacktestReport;
  segments: Record<string, BacktestReport>;
} {
  const segments: Record<string, BacktestReport> = {};
  const bySegment = new Map<string, BacktestSample[]>();
  for (const s of samples) {
    if (!s.segment) continue;
    const list = bySegment.get(s.segment) ?? [];
    list.push(s);
    bySegment.set(s.segment, list);
  }
  for (const [key, list] of bySegment) {
    segments[key] = computeBacktest(list);
  }
  return { overall: computeBacktest(samples), segments };
}

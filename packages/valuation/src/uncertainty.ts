/**
 * Uncertainty discipline (uncertainty.ts) — the Zillow-Offers lesson.
 *
 * Zillow's iBuying arm failed because point estimates kept being acted on
 * while the evidence behind them thinned: nobody watched the WIDTH of the
 * prediction interval, only its midpoint. These helpers make the width a
 * first-class, trendable number:
 *
 *  - `readUncertainty` stamps a single appraisal with its interval width
 *    ((high − low) ÷ point estimate) and judges it against a configurable
 *    bound from the offer config. Exceeding the bound NEVER blocks or
 *    re-scores anything — it raises `secondCheckRequired` so a person
 *    sanity-checks the comparables before any offer.
 *  - `median` / `compareMedianShift` / `compareShareShift` power the weekly
 *    portfolio check: if the median width across recent appraisals moves
 *    materially vs the prior period, model confidence is degrading and the
 *    founder gets one deduped card. The same shift math doubles as the
 *    regime-change signal (days-on-market, price-reduction share).
 *
 * Pure module (no `server-only`) — used by crons, server actions and tests.
 */

// Fewer samples than this on either side and a shift is noise, not signal.
export const MIN_TREND_SAMPLES = 5;

// current ÷ prior at or beyond this ratio counts as a material shift.
export const MATERIAL_SHIFT_RATIO = 1.25;

// A share (0–1) moving by this many points week-over-week is material.
export const MATERIAL_SHARE_DELTA = 0.1;

// ---------------------------------------------------------------------------
// Per-appraisal reading
// ---------------------------------------------------------------------------

export interface UncertaintyReading {
  /** (high − low) ÷ point estimate. Null when the inputs can't support it. */
  intervalWidthRatio: number | null;
  /** Sold comps behind the estimate — the evidence volume. */
  comparableCount: number | null;
  /** The configured bound the reading was judged against. */
  maxWidthRatio: number;
  /**
   * Width exceeds the bound (or can't be measured) — a person must re-check
   * the comparables before any offer. Surfaced, never enforced.
   */
  secondCheckRequired: boolean;
}

/**
 * Measure one appraisal's prediction-interval width and judge it against the
 * configured bound. Units cancel, so pounds and pence both work — just be
 * consistent within one call.
 */
export function readUncertainty(input: {
  pointEstimate: number;
  low: number;
  high: number;
  comparableCount?: number | null;
  maxWidthRatio: number;
}): UncertaintyReading {
  const { pointEstimate, low, high, maxWidthRatio } = input;
  const measurable =
    Number.isFinite(pointEstimate) &&
    pointEstimate > 0 &&
    Number.isFinite(low) &&
    Number.isFinite(high) &&
    high >= low;
  const intervalWidthRatio = measurable ? (high - low) / pointEstimate : null;

  return {
    intervalWidthRatio,
    comparableCount: input.comparableCount ?? null,
    maxWidthRatio,
    // An interval we can't even measure is itself a reason for a human look.
    secondCheckRequired:
      intervalWidthRatio === null || intervalWidthRatio > maxWidthRatio,
  };
}

// ---------------------------------------------------------------------------
// Portfolio trend math
// ---------------------------------------------------------------------------

/** Median of the finite values; null when none survive the filter. */
export function median(values: number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length === 0) {
    return null;
  }
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 0
    ? ((clean[mid - 1] ?? 0) + (clean[mid] ?? 0)) / 2
    : (clean[mid] ?? 0);
}

export interface MedianShift {
  currentMedian: number | null;
  priorMedian: number | null;
  currentCount: number;
  priorCount: number;
  /** current ÷ prior. Null when samples are thin or the prior median is 0. */
  shiftRatio: number | null;
  material: boolean;
}

/**
 * Compare this period's median against the prior period's. `direction: 'up'`
 * (default) alerts only on increases — right for interval widths, where
 * narrowing is good news. `'both'` alerts on movement either way — right for
 * regime signals like days-on-market, where any large shift means the market
 * the model was calibrated on has changed.
 */
export function compareMedianShift(
  current: number[],
  prior: number[],
  opts: {
    minSamples?: number;
    materialRatio?: number;
    direction?: 'up' | 'both';
  } = {}
): MedianShift {
  const {
    minSamples = MIN_TREND_SAMPLES,
    materialRatio = MATERIAL_SHIFT_RATIO,
    direction = 'up',
  } = opts;

  const currentClean = current.filter((v) => Number.isFinite(v));
  const priorClean = prior.filter((v) => Number.isFinite(v));
  const currentMedian = median(currentClean);
  const priorMedian = median(priorClean);

  const enoughSamples =
    currentClean.length >= minSamples && priorClean.length >= minSamples;
  const shiftRatio =
    enoughSamples &&
    currentMedian !== null &&
    priorMedian !== null &&
    priorMedian > 0
      ? currentMedian / priorMedian
      : null;

  const material =
    shiftRatio !== null &&
    (shiftRatio >= materialRatio ||
      (direction === 'both' && shiftRatio <= 1 / materialRatio));

  return {
    currentMedian,
    priorMedian,
    currentCount: currentClean.length,
    priorCount: priorClean.length,
    shiftRatio,
    material,
  };
}

export interface ShareShift {
  /** Fraction of true values this period (0–1). Null when no samples. */
  currentShare: number | null;
  priorShare: number | null;
  currentCount: number;
  priorCount: number;
  /** current − prior, in share points. Null when samples are thin. */
  delta: number | null;
  material: boolean;
}

/**
 * Week-over-week shift in the share of items meeting a condition (e.g. leads
 * with at least one price reduction). Material in either direction — a
 * market suddenly full of price drops OR suddenly empty of them both mean
 * the regime moved.
 */
export function compareShareShift(
  current: boolean[],
  prior: boolean[],
  opts: { minSamples?: number; materialDelta?: number } = {}
): ShareShift {
  const {
    minSamples = MIN_TREND_SAMPLES,
    materialDelta = MATERIAL_SHARE_DELTA,
  } = opts;

  const share = (values: boolean[]): number | null =>
    values.length === 0 ? null : values.filter(Boolean).length / values.length;

  const currentShare = share(current);
  const priorShare = share(prior);
  const enoughSamples =
    current.length >= minSamples && prior.length >= minSamples;
  const delta =
    enoughSamples && currentShare !== null && priorShare !== null
      ? currentShare - priorShare
      : null;

  return {
    currentShare,
    priorShare,
    currentCount: current.length,
    priorCount: prior.length,
    delta,
    material: delta !== null && Math.abs(delta) >= materialDelta,
  };
}

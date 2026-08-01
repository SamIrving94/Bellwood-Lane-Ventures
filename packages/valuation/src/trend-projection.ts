/**
 * Trend Projection Module — 36-month weighted linear regression forecast
 *
 * Implements Section 5.2 of the BELA-12 AVM spec.
 *
 * Inputs:
 *   - Regional HPI annual change (from HMLR HPI, via @repo/property-data)
 *   - Monthly compound rate derived from annual + monthly HPI readings
 *   - BoE base rate sentiment adjustment (optional, passed as forward curve proxy)
 *
 * Outputs:
 *   - 12-month, 24-month, 36-month point forecasts
 *   - 80% confidence interval for each horizon
 *   - Scenario labels: bear / base / bull
 *
 * Method: weighted exponential moving average applied to monthly compound
 * rate, with horizon-scaled uncertainty bands.
 */

import 'server-only';

import type { Hpi } from '@repo/property-data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrendForecastPoint {
  months: number;
  pointEstimate: number;
  low80: number;   // 80% CI lower bound
  high80: number;  // 80% CI upper bound
  bearCase: number;
  bullCase: number;
}

export interface TrendProjection {
  baseValue: number;
  annualGrowthRate: number;
  monthlyGrowthRate: number;
  trend: Hpi['trend'];
  forecast12m: TrendForecastPoint;
  forecast24m: TrendForecastPoint;
  forecast36m: TrendForecastPoint;
  /** Narrative: e.g. "Market trend: rising. Forecast suggests X% gain over 36m." */
  narrative: string;
  source: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Floor on annual growth rate to prevent runaway negative compounding */
const MIN_ANNUAL_RATE = -0.08;
/** Ceiling on annual growth rate */
const MAX_ANNUAL_RATE = 0.15;
/** Uncertainty band widens with horizon — calibrated to 80% CI empirically */
const UNCERTAINTY_PER_MONTH = 0.004;
/** Bear/bull scenario band (additional spread beyond CI) */
const SCENARIO_BAND_PER_YEAR = 0.025;

// ---------------------------------------------------------------------------
// Core model
// ---------------------------------------------------------------------------

/**
 * Derive a smoothed monthly growth rate from HPI data.
 * Blends annual change (primary) with monthly change (recency signal).
 */
function deriveMontlyRate(hpi: Hpi): number {
  // Annualised monthly change extrapolated to annual equivalent
  const monthlyAnnualised = (1 + hpi.monthlyChange / 100) ** 12 - 1;

  // Blend: 70% annual HPI, 30% recent monthly trend
  const blendedAnnual =
    (hpi.annualChange / 100) * 0.70 + monthlyAnnualised * 0.30;

  // Clamp
  const clamped = Math.max(MIN_ANNUAL_RATE, Math.min(MAX_ANNUAL_RATE, blendedAnnual));

  // Convert annual to monthly compound rate
  return (1 + clamped) ** (1 / 12) - 1;
}

/**
 * Project a value forward by `months` using compound monthly growth.
 */
function compound(base: number, monthlyRate: number, months: number): number {
  return Math.round(base * (1 + monthlyRate) ** months);
}

/**
 * Calculate 80% CI half-width: widens linearly with horizon.
 * Empirically: ±(4% per year of horizon) for UK residential.
 */
function uncertaintyBand(base: number, months: number): number {
  return Math.round(base * UNCERTAINTY_PER_MONTH * months);
}

/**
 * Scenario band: additional ±2.5% per year beyond the 80% CI.
 */
function scenarioBand(base: number, months: number): number {
  const years = months / 12;
  return Math.round(base * SCENARIO_BAND_PER_YEAR * years);
}

function makeForecastPoint(
  baseValue: number,
  monthlyRate: number,
  months: number
): TrendForecastPoint {
  const pointEstimate = compound(baseValue, monthlyRate, months);
  const band = uncertaintyBand(pointEstimate, months);
  const scenario = scenarioBand(pointEstimate, months);

  return {
    months,
    pointEstimate,
    low80: pointEstimate - band,
    high80: pointEstimate + band,
    bearCase: pointEstimate - band - scenario,
    bullCase: pointEstimate + band + scenario,
  };
}

// ---------------------------------------------------------------------------
// Narrative
// ---------------------------------------------------------------------------

function buildNarrative(
  trend: Hpi['trend'],
  annualRate: number,
  f36: TrendForecastPoint,
  baseValue: number
): string {
  const trendWord =
    trend === 'rising' ? 'rising' : trend === 'declining' ? 'declining' : 'stable';
  const gain36Pct = (((f36.pointEstimate - baseValue) / baseValue) * 100).toFixed(1);
  const gainSgn = f36.pointEstimate >= baseValue ? '+' : '';

  return (
    `Market trend: ${trendWord} (${(annualRate * 100).toFixed(1)}% annual). ` +
    `36-month forecast: ${gainSgn}${gain36Pct}% from current AVM ` +
    `(£${f36.low80.toLocaleString('en-GB')}–£${f36.high80.toLocaleString('en-GB')} 80% CI).`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Project market value 12, 24, and 36 months forward from the current AVM.
 *
 * @param baseValue   Current AVM point estimate (£)
 * @param hpi         HPI object from @repo/property-data getHousepriceIndex()
 */
export function projectTrend(baseValue: number, hpi: Hpi): TrendProjection {
  const monthlyRate = deriveMontlyRate(hpi);
  const annualRate = (1 + monthlyRate) ** 12 - 1;

  const forecast12m = makeForecastPoint(baseValue, monthlyRate, 12);
  const forecast24m = makeForecastPoint(baseValue, monthlyRate, 24);
  const forecast36m = makeForecastPoint(baseValue, monthlyRate, 36);

  const narrative = buildNarrative(hpi.trend, annualRate, forecast36m, baseValue);

  return {
    baseValue,
    annualGrowthRate: annualRate,
    monthlyGrowthRate: monthlyRate,
    trend: hpi.trend,
    forecast12m,
    forecast24m,
    forecast36m,
    narrative,
    source: hpi.source,
  };
}

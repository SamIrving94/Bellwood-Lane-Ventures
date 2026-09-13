/**
 * AVM backtest — pure matching + reporting helpers (avm-backtest.ts)
 *
 * The cron at /cron/avm-backtest pairs each frozen AvmSnapshot with the
 * property's first HM Land Registry sale AFTER the appraisal date. Everything
 * that can be reasoned about without a network or a database lives here so it
 * can be unit tested: which sale counts as the outcome, when a snapshot has
 * waited long enough to be written off, and how the matched cohort rolls up
 * into the report the founder reads.
 *
 * Matching reuses the scout's address normaliser (house number + street +
 * postcode), so "12 Acacia Road" never pairs with "12A" or "Flat 12". Only a
 * CONFIDENT match (score ≥ 0.85) counts — a fuzzy pairing would put the wrong
 * house's price against our estimate and poison the metric it exists to
 * protect.
 */

import type { PpdAddressRecord } from '@repo/property-data/src/hmlr';
import {
  addressMatchScore,
  classifyConfidence,
  normaliseUkAddress,
} from '@repo/scouting/src/address-normalise';
// Deep import on purpose: the package index pulls in server-only LLM
// modules, and this file must stay importable from a unit test.
import {
  type BacktestReport,
  type BacktestSample,
  computeBacktest,
} from '@repo/valuation/src/backtest';

/** Sales this long after the appraisal no longer test it — write the row off. */
export const MATCH_WINDOW_MONTHS = 18;
/** Re-poll HMLR for a pending row no more often than this (PPD is monthly). */
export const RECHECK_AFTER_DAYS = 21;
/** Postcodes queried per run — HMLR's API is free; be a polite guest. */
export const MAX_POSTCODES_PER_RUN = 250;
/** Spacing between HMLR calls, ms. */
export const HMLR_CALL_SPACING_MS = 300;

export interface SnapshotForMatch {
  id: string;
  address: string;
  postcode: string;
  appraisedAt: Date;
}

export type MatchOutcome =
  | {
      status: 'matched';
      sale: PpdAddressRecord;
      score: number;
      confidence: 'confident';
    }
  | { status: 'expired'; bestScore: number }
  | { status: 'pending'; bestScore: number };

const monthsBetween = (from: Date, to: Date): number =>
  (to.getTime() - from.getTime()) / (30.4375 * 24 * 60 * 60 * 1000);

/**
 * Pick the outcome sale for one snapshot from that postcode's HMLR records.
 *
 * Rules:
 *  - only sales dated strictly AFTER the appraisal day count (a sale that
 *    completed before we appraised is history, not an outcome);
 *  - the EARLIEST such confident match wins — the first sale after the
 *    estimate is the market's answer, a later resale is a different test;
 *  - with no confident match, the row stays pending until the window closes.
 */
export function pickOutcomeSale(
  snapshot: SnapshotForMatch,
  sales: PpdAddressRecord[],
  now: Date = new Date()
): MatchOutcome {
  const appraisedDay = snapshot.appraisedAt.toISOString().slice(0, 10);
  const subject = normaliseUkAddress(
    `${snapshot.address}, ${snapshot.postcode}`
  );

  let best: { sale: PpdAddressRecord; score: number } | null = null;
  let bestScore = 0;
  for (const sale of sales) {
    // A sale on or before the appraisal day is history, not an outcome.
    if (!sale.date || sale.date <= appraisedDay || !(sale.price > 0)) {
      continue;
    }
    const candidate = normaliseUkAddress(
      `${sale.address}${sale.postcode ? `, ${sale.postcode}` : ''}`
    );
    const score = addressMatchScore(subject, candidate);
    bestScore = Math.max(bestScore, score);
    if (classifyConfidence(score) !== 'confident') {
      continue;
    }
    if (!best || sale.date < best.sale.date) {
      best = { sale, score };
    }
  }

  if (best) {
    return {
      status: 'matched',
      sale: best.sale,
      score: best.score,
      confidence: 'confident',
    };
  }
  if (monthsBetween(snapshot.appraisedAt, now) > MATCH_WINDOW_MONTHS) {
    return { status: 'expired', bestScore };
  }
  return { status: 'pending', bestScore };
}

/** Coarse value bands for segmenting the report (pence in, label out). */
export function priceBand(pence: number): string {
  const pounds = pence / 100;
  if (pounds < 250_000) {
    return 'under_250k';
  }
  if (pounds < 500_000) {
    return '250k_500k';
  }
  if (pounds < 1_000_000) {
    return '500k_1m';
  }
  return 'over_1m';
}

export interface MatchedRow {
  pointEstimatePence: number;
  lowPence: number | null;
  highPence: number | null;
  soldPricePence: number;
  confidenceLevel: string | null;
  source: string;
  propertyType: string;
  csaSource: string | null;
  engineVersion: string | null;
}

export interface BacktestSummary {
  n: number;
  overall: BacktestReport;
  byConfidence: Record<string, BacktestReport>;
  bySource: Record<string, BacktestReport>;
  byPropertyType: Record<string, BacktestReport>;
  byCsaSource: Record<string, BacktestReport>;
  byPriceBand: Record<string, BacktestReport>;
  byEngineVersion: Record<string, BacktestReport>;
}

const toSample = (r: MatchedRow): BacktestSample => ({
  predictedPence: r.pointEstimatePence,
  actualPence: r.soldPricePence,
  intervalLowPence: r.lowPence,
  intervalHighPence: r.highPence,
});

function groupBy(
  rows: MatchedRow[],
  key: (r: MatchedRow) => string
): Record<string, BacktestReport> {
  const buckets = new Map<string, BacktestSample[]>();
  for (const r of rows) {
    const k = key(r);
    const list = buckets.get(k) ?? [];
    list.push(toSample(r));
    buckets.set(k, list);
  }
  const out: Record<string, BacktestReport> = {};
  for (const [k, list] of buckets) {
    out[k] = computeBacktest(list);
  }
  return out;
}

/** Roll the whole matched cohort up into the report payload. */
export function summariseMatched(rows: MatchedRow[]): BacktestSummary {
  return {
    n: rows.length,
    overall: computeBacktest(rows.map(toSample)),
    byConfidence: groupBy(rows, (r) => r.confidenceLevel ?? 'unknown'),
    bySource: groupBy(rows, (r) => r.source),
    byPropertyType: groupBy(rows, (r) => r.propertyType),
    byCsaSource: groupBy(rows, (r) => r.csaSource ?? 'unknown'),
    byPriceBand: groupBy(rows, (r) => priceBand(r.soldPricePence)),
    byEngineVersion: groupBy(rows, (r) => r.engineVersion ?? 'unknown'),
  };
}

/**
 * The founder card. Below MIN_SAMPLE the numbers are noise and the card says
 * so; the Sep 2026 review put the first readable aggregate at 200–300 sales
 * and any segmented conclusion at ~100 per cell.
 */
export const MIN_SAMPLE_FOR_HEADLINE = 30;
export const SAMPLE_FOR_TRUST = 200;

const pct = (f: number) => `${(f * 100).toFixed(1)}%`;

export function buildBacktestActionCopy(args: {
  summary: BacktestSummary;
  pending: number;
  excluded: number;
  expired: number;
  monthLabel: string;
}): { title: string; description: string; priority: 'low' | 'medium' } {
  const { summary, pending, excluded, expired, monthLabel } = args;
  const o = summary.overall;
  const cohort = `Cohort: ${summary.n} matched · ${pending} waiting for a sale · ${excluded} excluded (we bought them) · ${expired} expired unsold after ${MATCH_WINDOW_MONTHS} months.`;

  if (summary.n < MIN_SAMPLE_FOR_HEADLINE) {
    return {
      priority: 'low',
      title: `AVM backtest ${monthLabel}: ${summary.n} matched sale${summary.n === 1 ? '' : 's'} — too few to read yet`,
      description: `${cohort}\n\nNo verdict until ${MIN_SAMPLE_FOR_HEADLINE}+ matched sales. Every appraisal is being frozen and checked against Land Registry monthly; the number will grow on its own.`,
    };
  }

  const trust =
    summary.n >= SAMPLE_FOR_TRUST
      ? 'Sample is large enough to act on.'
      : `Directional only until ${SAMPLE_FOR_TRUST}+ matched sales.`;
  let direction = 'No systematic bias at the median.';
  if (o.medianSignedPct > 0.02) {
    direction = 'The AVM typically OVER-values.';
  } else if (o.medianSignedPct < -0.02) {
    direction = 'The AVM typically UNDER-values.';
  }
  const coverage =
    o.intervalCoverage == null
      ? 'No interval data.'
      : `The "80%" range caught ${pct(o.intervalCoverage)} of sales.`;

  return {
    priority: 'medium',
    title: `AVM backtest ${monthLabel}: median error ${pct(o.medianApe)} over ${summary.n} sales`,
    description: `${cohort}\n\nMedian absolute error ${pct(o.medianApe)} · mean ${pct(o.mape)} · within 10%: ${pct(o.withinPct10)} · within 20%: ${pct(o.withinPct20)}.\nMedian signed error ${pct(o.medianSignedPct)} — ${direction}\n${coverage}\n${trust}`,
  };
}

/**
 * Lead Scorer (scorer.ts)
 *
 * Produces a 0–100 composite score + Verdict, built to answer the two questions
 * the business runs on — with every input surfaced for transparency (trust):
 *
 *   Pillar 1 · ACQUISITION LIKELIHOOD (cap 45) — can we buy it cheap / will they
 *     deal? Lead type (probate…), days on market, unmodernised condition, price
 *     reductions, chain-free/cash-only distress, probate execution signals.
 *
 *   Pillar 2 · ROI / DEAL QUALITY (cap 40) — how much do we make? The BMV
 *     discount (asking vs AVM) and deal-model cash ROI. Only known AFTER an
 *     appraisal, so it is added in a SECOND stage (see combineScore). Before
 *     appraisal a provisional equity-vs-area proxy stands in, clearly labelled.
 *
 *   Modifiers — market trend (cap 10) and risk (±10: flood/EPC/lease/planning).
 *
 * Every contribution is captured as a Factor so the UI can render the full
 * "why this score" breakdown verbatim, and the single biggest factor is exposed
 * as the leading indicator. Contact quality is NOT scored (a strong deal with no
 * phone number is still strong); the old "hot probate window" recency bonus is
 * gone (unreliable proxy for motivation).
 */

import type { Hpi } from '@repo/property-data/src/hmlr-hpi';
import type { PricePaid } from '@repo/property-data/src/hmlr';
import type { EnrichedLead } from './enrichment';
import {
  DEFAULT_SCORER_CONFIG,
  type EquityBand,
  type ScorerConfig,
} from './scorer-config';

export { DEFAULT_SCORER_CONFIG } from './scorer-config';
export type { ScorerConfig } from './scorer-config';

export type Verdict = 'STRONG' | 'VIABLE' | 'THIN' | 'PASS' | 'INSUFFICIENT_DATA';

/** The pillar/modifier a factor belongs to. */
export type ScoreDimension = 'acquisition' | 'roi' | 'marketTrend' | 'risk';

/** A single signed contribution to the score — the unit of transparency. */
export interface ScoreFactor {
  label: string;
  points: number;
  dimension: ScoreDimension;
  tone?: 'positive' | 'negative' | 'neutral';
  /** True for the pre-appraisal equity proxy standing in for real ROI. */
  provisional?: boolean;
}

export interface ScoreBreakdown {
  acquisition: number;
  roi: number;
  marketTrend: number;
  risk: number;
  total: number;
  verdict: Verdict;
  /** True once the ROI pillar reflects a real appraisal (BMV + cash ROI). */
  appraised: boolean;
  marketTrendLabel: string;
  riskFlags: string[];
  factors: ScoreFactor[];
  /** The single biggest positive driver — the headline "why". */
  leadingIndicator: ScoreFactor | null;
  rationale: string;
}

export interface LeadSignals {
  reductionCount?: number;
  velocityScore?: number;
  daysOnMarket?: number | null;
  discountPercent?: number | null;
  listingType?: string;
  percentOver65?: number | null;
  percentOver75?: number | null;
  floodRisk?: string | null;
  epcRating?: string | null;
  remainingLeaseYears?: number | null;
  tenure?: 'freehold' | 'leasehold' | 'unknown' | null;
  planningRefusalCount?: number;
  marriageValueLease?: boolean;
  leaseUrgency?: number;
}

/** ROI inputs from the appraisal (stage 2). */
export interface DealRoiInput {
  /** How far the asking price sits BELOW the AVM market value, as a percent. */
  bmvDiscountPct?: number | null;
  /** Deal-model cash ROI as a percent (e.g. 22 = 22%). */
  cashRoiPct?: number | null;
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function add(
  factors: ScoreFactor[],
  label: string,
  points: number,
  dimension: ScoreDimension,
  tone?: ScoreFactor['tone'],
  provisional?: boolean,
): void {
  if (points === 0 && tone !== 'neutral') return;
  factors.push({ label, points, dimension, tone, provisional });
}

/** First band whose threshold the value clears (bands are high → low). */
function pickBand(bands: EquityBand[], value: number): EquityBand | null {
  return bands.find((b) => value >= b.minRatio) ?? bands[bands.length - 1] ?? null;
}

function sumDimension(factors: ScoreFactor[], dim: ScoreDimension): number {
  return factors.filter((f) => f.dimension === dim).reduce((s, f) => s + f.points, 0);
}

const LISTING_TYPE_LABELS: Record<string, string> = {
  'repossessed-properties': 'Repossessed',
  'quick-sale-properties': 'Quick sale',
  'reduced-properties': 'Price reduced',
  'slow-to-sell-properties': 'Stale listing',
  'derelict-properties': 'Derelict',
  'unmodernised-properties': 'Unmodernised',
  'back-on-market': 'Back on market',
  'properties-with-no-chain': 'No chain',
  'cash-buyers-only-properties': 'Cash only',
  'auction-properties': 'Auction',
  'short-lease-properties': 'Short lease',
  'poor-epc-score': 'Poor EPC',
};

const DISTRESS_LISTINGS = new Set([
  'repossessed-properties',
  'cash-buyers-only-properties',
  'properties-with-no-chain',
  'back-on-market',
]);

function leadTypeLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─────────────────────────────────────────────────────────────────────────
// Pillar 1 — acquisition likelihood
// ─────────────────────────────────────────────────────────────────────────

function scoreAcquisition(
  lead: EnrichedLead,
  signals: LeadSignals | undefined,
  factors: ScoreFactor[],
  config: ScorerConfig,
): number {
  const before = factors.length;

  // Lead type (probate…)
  const typeKey = lead.leadType.toLowerCase().replace(/\s+/g, '_');
  const typePoints = config.leadTypeScores[typeKey] ?? config.leadTypeFallback;
  const niceTypeLabel = signals?.listingType
    ? (LISTING_TYPE_LABELS[signals.listingType] ?? leadTypeLabel(typeKey))
    : leadTypeLabel(typeKey);
  add(factors, niceTypeLabel, typePoints, 'acquisition');

  // Days on market — the longer it sits, the more motivated the seller.
  if (typeof signals?.daysOnMarket === 'number' && signals.daysOnMarket > 0) {
    const band = pickBand(config.daysOnMarketBands, signals.daysOnMarket);
    if (band && band.points > 0) {
      add(factors, `${band.label} (${signals.daysOnMarket}d)`, band.points, 'acquisition');
    }
  }

  // Unmodernised / condition — fewer buyers, priced to move, refurb upside.
  if (signals?.listingType) {
    const condPts = config.conditionScores[signals.listingType];
    if (condPts && condPts > 0) {
      add(factors, `${LISTING_TYPE_LABELS[signals.listingType] ?? 'Condition'}`, condPts, 'acquisition');
    }
  }

  // Price-reduction velocity (accelerating drops = a seller chasing the market).
  if (signals?.velocityScore && signals.velocityScore > 0) {
    let pts = 0;
    if (signals.velocityScore >= 1.0) pts = config.velocityMax;
    else if (signals.velocityScore >= 0.5) pts = Math.round(config.velocityMax * 0.66);
    else if (signals.velocityScore >= 0.2) pts = Math.round(config.velocityMax * 0.33);
    else if (signals.velocityScore >= 0.05) pts = 1;
    if (pts > 0) {
      const drops =
        typeof signals.reductionCount === 'number' && signals.reductionCount > 0
          ? ` (${signals.reductionCount} drops)`
          : '';
      add(factors, `Accelerating price drops${drops}`, pts, 'acquisition');
    }
  }

  // Chain-free / cash-only / repossession distress.
  if (
    signals?.listingType && DISTRESS_LISTINGS.has(signals.listingType)
  ) {
    add(factors, 'Distressed sale signal', config.distressBonus, 'acquisition');
  }

  // Probate execution signals.
  if (lead.solicitorFirm) {
    add(factors, 'Solicitor identified', config.solicitorBonus, 'acquisition');
  }
  if (lead.grantType === 'letters_of_administration') {
    add(factors, 'Letters of administration (unplanned)', config.lettersOfAdminBonus, 'acquisition');
  }

  // Short-lease marriage value motivates a sale.
  if (signals?.marriageValueLease) {
    const urgency = Math.min(1, Math.max(0, signals.leaseUrgency ?? 0));
    const pts = config.marriageValueBase + Math.round(urgency * config.marriageValueUrgencyMax);
    add(factors, 'Short lease motivates sale (marriage value)', pts, 'acquisition');
  }

  // Clamp the pillar to its cap.
  const raw = factors.slice(before).reduce((s, f) => s + f.points, 0);
  const capped = Math.min(config.dimensionCaps.acquisition, raw);
  if (capped < raw) {
    // Trim the overflow off the smallest positive factor so the displayed
    // factors still sum to the shown pillar total (transparency).
    factors.push({
      label: `Acquisition cap (${config.dimensionCaps.acquisition})`,
      points: capped - raw,
      dimension: 'acquisition',
      tone: 'neutral',
    });
  }
  return capped;
}

// ─────────────────────────────────────────────────────────────────────────
// Pillar 2 — ROI / deal quality
// ─────────────────────────────────────────────────────────────────────────

/** Provisional pre-appraisal ROI proxy: estate value vs area average. */
function scoreEquityProxy(
  lead: EnrichedLead,
  pricePaid: PricePaid | null,
  factors: ScoreFactor[],
  config: ScorerConfig,
): number {
  if (!lead.estateValuePence) return 0;
  const avgAreaPence = pricePaid?.avgPrice ? pricePaid.avgPrice * 100 : null;
  if (!avgAreaPence) {
    add(factors, 'Value present, no area comp (ROI pending appraisal)', config.equityNoComparable, 'roi', 'neutral', true);
    return config.equityNoComparable;
  }
  const ratio = lead.estateValuePence / avgAreaPence;
  const band = pickBand(config.equityBands, ratio);
  const pts = band?.points ?? 1;
  add(factors, `${band?.label ?? 'Equity vs area'} (ROI pending appraisal)`, pts, 'roi', undefined, true);
  return pts;
}

/**
 * Real ROI factors from an appraisal. Returns factors only (dimension 'roi');
 * combineScore folds them into a full breakdown.
 */
export function scoreDealRoi(
  input: DealRoiInput,
  config: ScorerConfig = DEFAULT_SCORER_CONFIG,
): ScoreFactor[] {
  const factors: ScoreFactor[] = [];

  if (typeof input.bmvDiscountPct === 'number') {
    const band = pickBand(config.bmvBands, input.bmvDiscountPct);
    if (band) {
      add(factors, `${band.label} (${input.bmvDiscountPct.toFixed(0)}% BMV)`, band.points, 'roi', 'positive');
    }
  }
  if (typeof input.cashRoiPct === 'number') {
    const band = pickBand(config.roiBands, input.cashRoiPct);
    if (band && band.points > 0) {
      add(factors, `${band.label} (${input.cashRoiPct.toFixed(0)}%)`, band.points, 'roi', 'positive');
    } else {
      add(factors, `Cash ROI ${input.cashRoiPct.toFixed(0)}% — below hurdle`, 0, 'roi', 'neutral');
    }
  }
  return factors;
}

// ─────────────────────────────────────────────────────────────────────────
// Modifiers — market trend + risk
// ─────────────────────────────────────────────────────────────────────────

function scoreMarketTrend(
  hpi: Hpi | null,
  factors: ScoreFactor[],
  config: ScorerConfig,
): { score: number; label: string } {
  const mt = config.marketTrend;
  const trend = hpi?.trend ?? null;
  const map: Record<string, { pts: number; label: string; tone: ScoreFactor['tone'] }> = {
    rising: { pts: mt.rising, label: 'Rising market', tone: 'positive' },
    stable: { pts: mt.stable, label: 'Stable market', tone: 'neutral' },
    declining: { pts: mt.declining, label: 'Declining market', tone: 'neutral' },
  };
  const chosen = trend && map[trend] ? map[trend] : { pts: mt.unknown, label: 'Market trend unknown', tone: 'neutral' as const };
  add(factors, chosen.label, Math.min(config.dimensionCaps.marketTrend, chosen.pts), 'marketTrend', chosen.tone);
  return { score: Math.min(config.dimensionCaps.marketTrend, chosen.pts), label: trend ?? 'unknown' };
}

function scoreRisk(
  signals: LeadSignals | undefined,
  factors: ScoreFactor[],
  config: ScorerConfig,
): { score: number; flags: string[] } {
  const flags: string[] = [];
  if (!signals) return { score: 0, flags };
  const before = factors.length;

  const flood = (signals.floodRisk ?? '').toLowerCase();
  if (flood.includes('high')) { add(factors, 'High flood risk', -6, 'risk', 'negative'); flags.push('flood: high'); }
  else if (flood.includes('medium')) { add(factors, 'Medium flood risk', -3, 'risk', 'negative'); flags.push('flood: medium'); }
  else if (flood.includes('low')) { add(factors, 'Low flood risk', 1, 'risk', 'positive'); }

  const epc = (signals.epcRating ?? '').toUpperCase();
  if (epc === 'F' || epc === 'G') { add(factors, `Poor EPC (${epc})`, -4, 'risk', 'negative'); flags.push(`EPC ${epc}`); }
  else if (epc === 'E') { add(factors, 'Below-par EPC (E)', -2, 'risk', 'negative'); flags.push('EPC E'); }
  else if (epc === 'A' || epc === 'B' || epc === 'C') { add(factors, `Good EPC (${epc})`, 2, 'risk', 'positive'); }

  if (signals.tenure === 'leasehold' && typeof signals.remainingLeaseYears === 'number') {
    if (signals.remainingLeaseYears < 60) { add(factors, `Very short lease (${signals.remainingLeaseYears}y)`, -6, 'risk', 'negative'); flags.push(`lease ${signals.remainingLeaseYears}y`); }
    else if (signals.remainingLeaseYears < 80) { add(factors, `Short lease (${signals.remainingLeaseYears}y)`, -3, 'risk', 'negative'); flags.push(`lease ${signals.remainingLeaseYears}y`); }
    else if (signals.remainingLeaseYears > 125) { add(factors, `Long lease (${signals.remainingLeaseYears}y)`, 1, 'risk', 'positive'); }
  } else if (signals.tenure === 'freehold') {
    add(factors, 'Freehold', 2, 'risk', 'positive');
  }

  if (signals.planningRefusalCount && signals.planningRefusalCount >= 3) {
    add(factors, `${signals.planningRefusalCount} planning refusals nearby`, -2, 'risk', 'negative');
    flags.push(`${signals.planningRefusalCount} planning refusals nearby`);
  }

  const raw = factors.slice(before).reduce((s, f) => s + f.points, 0);
  const clamped = Math.max(config.dimensionCaps.riskMin, Math.min(config.dimensionCaps.riskMax, raw));
  return { score: clamped, flags };
}

// ─────────────────────────────────────────────────────────────────────────
// Verdict, leading indicator, rationale
// ─────────────────────────────────────────────────────────────────────────

function verdictFromScore(total: number, hasCriticalData: boolean, config: ScorerConfig): Verdict {
  if (!hasCriticalData) return 'INSUFFICIENT_DATA';
  if (total >= config.verdictThresholds.strong) return 'STRONG';
  if (total >= config.verdictThresholds.viable) return 'VIABLE';
  if (total >= config.verdictThresholds.thin) return 'THIN';
  return 'PASS';
}

function pickLeadingIndicator(factors: ScoreFactor[]): ScoreFactor | null {
  const positives = factors.filter((f) => f.points > 0);
  if (positives.length === 0) return null;
  return positives.reduce((best, f) => (f.points > best.points ? f : best));
}

function buildRationale(
  verdict: Verdict,
  total: number,
  leading: ScoreFactor | null,
  factors: ScoreFactor[],
  appraised: boolean,
): string {
  if (verdict === 'INSUFFICIENT_DATA') {
    return 'Insufficient data to score — missing address or postcode.';
  }
  const word =
    verdict === 'STRONG' ? 'Strong' : verdict === 'VIABLE' ? 'Viable' : verdict === 'THIN' ? 'Thin' : 'Pass';
  const negatives = factors.filter((f) => f.points < 0).sort((a, b) => a.points - b.points);
  let s = `${word} lead (${total}/100)`;
  if (leading) s += ` — leading indicator: ${leading.label.toLowerCase()}`;
  if (negatives[0]) s += `; pulled down by ${negatives[0].label.toLowerCase()}`;
  if (!appraised) s += ' (ROI provisional — not yet appraised)';
  return s + '.';
}

/** Assemble a full breakdown from a set of factors. */
function assemble(
  factors: ScoreFactor[],
  hasCriticalData: boolean,
  marketTrendLabel: string,
  riskFlags: string[],
  appraised: boolean,
  config: ScorerConfig,
): ScoreBreakdown {
  const acquisition = Math.min(config.dimensionCaps.acquisition, sumDimension(factors, 'acquisition'));
  const roi = Math.min(config.dimensionCaps.roi, sumDimension(factors, 'roi'));
  const marketTrend = sumDimension(factors, 'marketTrend');
  const risk = Math.max(config.dimensionCaps.riskMin, Math.min(config.dimensionCaps.riskMax, sumDimension(factors, 'risk')));
  const total = Math.max(0, Math.min(100, acquisition + roi + marketTrend + risk));
  const verdict = verdictFromScore(total, hasCriticalData, config);
  const leadingIndicator = pickLeadingIndicator(factors);
  const rationale = buildRationale(verdict, total, leadingIndicator, factors, appraised);
  return {
    acquisition, roi, marketTrend, risk, total, verdict, appraised,
    marketTrendLabel, riskFlags, factors, leadingIndicator, rationale,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

/**
 * Stage 1 — score a lead at sourcing time from cheap signals: acquisition
 * likelihood + market + risk, with a provisional equity proxy for ROI. The
 * real ROI pillar is folded in later by combineScore once the AVM has run.
 */
export function scoreLead(
  lead: EnrichedLead,
  pricePaid: PricePaid | null,
  hpi: Hpi | null,
  signals?: LeadSignals,
  config: ScorerConfig = DEFAULT_SCORER_CONFIG,
): ScoreBreakdown {
  const hasCriticalData = Boolean(lead.address && lead.postcode);
  const factors: ScoreFactor[] = [];

  scoreAcquisition(lead, signals, factors, config);
  scoreEquityProxy(lead, pricePaid, factors, config); // provisional ROI
  const { label: marketTrendLabel } = scoreMarketTrend(hpi, factors, config);
  const { flags: riskFlags } = scoreRisk(signals, factors, config);

  return assemble(factors, hasCriticalData, marketTrendLabel, riskFlags, false, config);
}

/**
 * Stage 2 — fold a real appraisal's ROI into an existing score. Drops the
 * provisional equity proxy, adds the BMV + cash-ROI factors, and recomputes the
 * total, verdict, leading indicator and rationale.
 */
export function combineScore(
  baseFactors: ScoreFactor[],
  roi: DealRoiInput,
  opts: { hasCriticalData?: boolean; marketTrendLabel?: string; riskFlags?: string[] } = {},
  config: ScorerConfig = DEFAULT_SCORER_CONFIG,
): ScoreBreakdown {
  // Remove any prior ROI factors (the provisional proxy or a stale appraisal).
  const kept = baseFactors.filter((f) => f.dimension !== 'roi');
  const roiFactors = scoreDealRoi(roi, config);
  const factors = [...kept, ...roiFactors];
  return assemble(
    factors,
    opts.hasCriticalData ?? true,
    opts.marketTrendLabel ?? 'unknown',
    opts.riskFlags ?? [],
    true,
    config,
  );
}

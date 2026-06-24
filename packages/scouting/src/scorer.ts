/**
 * Lead Scorer (scorer.ts)
 *
 * Produces a 1–100 composite score and a Verdict for each raw lead.
 *
 * Scoring model:
 *   Motivation      40 pts  — urgency signals: lead type, Golden Window,
 *                              velocity, pre-probate area boost
 *   Equity          25 pts  — estimated equity vs area average
 *   Market Trend    15 pts  — HPI trend for postcode region
 *   Contact Quality 10 pts  — completeness of contact details
 *   Risk           +10 / -10 — flood + EPC band + short lease + planning
 *                              enforcement.
 *
 * Every contribution is captured as a Factor so the UI can render
 * "why this score" without guesswork.
 */

import type { Hpi } from '@repo/property-data/src/hmlr-hpi';
import type { PricePaid } from '@repo/property-data/src/hmlr';
import type { EnrichedLead } from './enrichment';
import { DEFAULT_SCORER_CONFIG, type ScorerConfig } from './scorer-config';

export { DEFAULT_SCORER_CONFIG } from './scorer-config';
export type { ScorerConfig } from './scorer-config';

export type Verdict = 'STRONG' | 'VIABLE' | 'THIN' | 'PASS' | 'INSUFFICIENT_DATA';

export type ScoreDimension =
  | 'motivation'
  | 'equity'
  | 'marketTrend'
  | 'contactQuality'
  | 'risk';

/**
 * A single thing that pushed the score up or down. The UI uses these
 * directly to render "Why this score" — no inference, no guesswork.
 */
export interface ScoreFactor {
  /** Plain-English short label, e.g. "Probate lead", "Stale 87d", "EPC F". */
  label: string;
  /** Signed point contribution. Positive raises score, negative lowers. */
  points: number;
  dimension: ScoreDimension;
  /**
   * Optional sub-tone for UI colouring. 'positive' = green, 'negative' = rose,
   * 'neutral' = slate. Defaults to positive/negative based on sign.
   */
  tone?: 'positive' | 'negative' | 'neutral';
}

export interface ScoreBreakdown {
  motivation: number;
  equity: number;
  marketTrend: number;
  contactQuality: number;
  risk: number;
  total: number;
  verdict: Verdict;
  marketTrendLabel: string;
  /** Backwards-compatible: short risk reasons. Mirrors factors with negative points in risk dimension. */
  riskFlags: string[];
  /** Every factor that contributed to the score, in source order. */
  factors: ScoreFactor[];
  /** One-line plain-English summary, ready to render. */
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
  /** Set by the short-lease source: the lease is under the 80-year
   *  marriage-value line, which is itself a seller-motivation signal. */
  marriageValueLease?: boolean;
  /** 0–1 urgency from the lease assessment — scales the marriage-value
   *  motivation bonus (a 55-year lease is hotter than a 79-year one). */
  leaseUrgency?: number;
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
): void {
  if (points === 0) return;
  factors.push({ label, points, dimension, tone });
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

function leadTypeLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─────────────────────────────────────────────────────────────────────────
// Component scorers — each returns the cap value AND populates factors[]
// ─────────────────────────────────────────────────────────────────────────

function scoreMotivation(
  lead: EnrichedLead,
  signals: LeadSignals | undefined,
  factors: ScoreFactor[],
  config: ScorerConfig,
): number {
  let score = 0;

  // Lead type urgency (0–25)
  const typeScores = config.leadTypeScores;
  const typeKey = lead.leadType.toLowerCase().replace(/\s+/g, '_');
  const typePoints = typeScores[typeKey] ?? config.leadTypeFallback;
  // Prefer the PropertyData listing label when present (more specific than 'unknown')
  const niceTypeLabel = signals?.listingType
    ? (LISTING_TYPE_LABELS[signals.listingType] ?? leadTypeLabel(typeKey))
    : leadTypeLabel(typeKey);
  score += typePoints;
  add(factors, niceTypeLabel, typePoints, 'motivation');

  // Golden Window
  if (lead.goldenWindowLabel === 'hot') {
    score += config.goldenWindow.hot;
    add(factors, 'Hot probate window', config.goldenWindow.hot, 'motivation');
  } else if (lead.goldenWindowLabel === 'warm') {
    score += config.goldenWindow.warm;
    add(factors, 'Warm probate window', config.goldenWindow.warm, 'motivation');
  } else if (lead.goldenWindowLabel === 'cool') {
    score += config.goldenWindow.cool;
    add(factors, 'Cool probate window', config.goldenWindow.cool, 'motivation');
  }

  // Solicitor involvement
  if (lead.solicitorFirm) {
    score += config.solicitorBonus;
    add(factors, 'Solicitor identified', config.solicitorBonus, 'motivation');
  }

  // Letters of admin = unplanned estate
  if (lead.grantType === 'letters_of_administration') {
    score += config.lettersOfAdminBonus;
    add(
      factors,
      'Letters of administration (unplanned)',
      config.lettersOfAdminBonus,
      'motivation',
    );
  }

  // Velocity boost
  if (signals?.velocityScore && signals.velocityScore > 0) {
    let pts = 0;
    if (signals.velocityScore >= 1.0) pts = 8;
    else if (signals.velocityScore >= 0.5) pts = 5;
    else if (signals.velocityScore >= 0.2) pts = 3;
    else if (signals.velocityScore >= 0.05) pts = 1;
    if (pts > 0) {
      score += pts;
      const reductionsText =
        typeof signals.reductionCount === 'number' && signals.reductionCount > 0
          ? ` (${signals.reductionCount} drops)`
          : '';
      add(
        factors,
        `Accelerating price drops${reductionsText}`,
        pts,
        'motivation',
      );
    }
  }

  // Stale-listing
  if (
    signals?.daysOnMarket &&
    signals.daysOnMarket >= 90 &&
    (!signals.reductionCount || signals.reductionCount === 0)
  ) {
    score += 4;
    add(factors, `Stale ${signals.daysOnMarket}d, no reductions`, 4, 'motivation');
  } else if (signals?.daysOnMarket && signals.daysOnMarket >= 60) {
    score += 2;
    add(factors, `On market ${signals.daysOnMarket}d`, 2, 'motivation');
  }

  // Short-lease motivation (marriage value). Distinct from the lease *risk*
  // penalty in scoreRisk: a short lease both costs money to extend (risk) AND
  // makes the owner motivated to sell (motivation) — the founder's Milton Court
  // play. Only fires for leads the short-lease source flagged, so existing
  // leads are unaffected. Scaled 10→18 by lease urgency, capped by the
  // motivation dimension cap.
  if (signals?.marriageValueLease) {
    const urgency = Math.min(1, Math.max(0, signals.leaseUrgency ?? 0));
    const pts = 10 + Math.round(urgency * 8);
    score += pts;
    add(
      factors,
      'Short lease motivates sale (marriage value)',
      pts,
      'motivation',
    );
  }

  // Pre-probate area
  if (signals?.percentOver75 && signals.percentOver75 >= 15) {
    score += 5;
    add(
      factors,
      `Pre-probate area (${Math.round(signals.percentOver75)}% over 75)`,
      5,
      'motivation',
    );
  } else if (signals?.percentOver75 && signals.percentOver75 >= 10) {
    score += 3;
    add(
      factors,
      `Older area (${Math.round(signals.percentOver75)}% over 75)`,
      3,
      'motivation',
    );
  } else if (signals?.percentOver65 && signals.percentOver65 >= 25) {
    score += 2;
    add(
      factors,
      `Older area (${Math.round(signals.percentOver65)}% over 65)`,
      2,
      'motivation',
    );
  }

  return Math.min(config.dimensionCaps.motivation, score);
}

function scoreRisk(
  signals: LeadSignals | undefined,
  factors: ScoreFactor[],
  config: ScorerConfig,
): { score: number; flags: string[] } {
  let score = 0;
  const flags: string[] = [];
  if (!signals) return { score: 0, flags: [] };

  // Flood
  const flood = (signals.floodRisk ?? '').toLowerCase();
  if (flood.includes('high')) {
    score -= 6;
    flags.push('flood: high');
    add(factors, 'High flood risk', -6, 'risk', 'negative');
  } else if (flood.includes('medium')) {
    score -= 3;
    flags.push('flood: medium');
    add(factors, 'Medium flood risk', -3, 'risk', 'negative');
  } else if (flood.includes('very low')) {
    score += 1;
    add(factors, 'Very low flood risk', 1, 'risk', 'positive');
  } else if (flood.includes('low')) {
    score += 1;
    add(factors, 'Low flood risk', 1, 'risk', 'positive');
  }

  // EPC
  const epc = (signals.epcRating ?? '').toUpperCase();
  if (epc === 'F' || epc === 'G') {
    score -= 4;
    flags.push(`EPC ${epc}`);
    add(factors, `Poor EPC (${epc})`, -4, 'risk', 'negative');
  } else if (epc === 'E') {
    score -= 2;
    flags.push('EPC E');
    add(factors, 'Below-par EPC (E)', -2, 'risk', 'negative');
  } else if (epc === 'A' || epc === 'B' || epc === 'C') {
    score += 2;
    add(factors, `Good EPC (${epc})`, 2, 'risk', 'positive');
  }

  // Lease
  if (
    signals.tenure === 'leasehold' &&
    typeof signals.remainingLeaseYears === 'number'
  ) {
    if (signals.remainingLeaseYears < 60) {
      score -= 6;
      flags.push(`lease ${signals.remainingLeaseYears}y`);
      add(
        factors,
        `Very short lease (${signals.remainingLeaseYears}y)`,
        -6,
        'risk',
        'negative',
      );
    } else if (signals.remainingLeaseYears < 80) {
      score -= 3;
      flags.push(`lease ${signals.remainingLeaseYears}y`);
      add(
        factors,
        `Short lease (${signals.remainingLeaseYears}y)`,
        -3,
        'risk',
        'negative',
      );
    } else if (signals.remainingLeaseYears > 125) {
      score += 1;
      add(
        factors,
        `Long lease (${signals.remainingLeaseYears}y)`,
        1,
        'risk',
        'positive',
      );
    }
  } else if (signals.tenure === 'freehold') {
    score += 2;
    add(factors, 'Freehold', 2, 'risk', 'positive');
  }

  // Planning refusals
  if (signals.planningRefusalCount && signals.planningRefusalCount >= 3) {
    score -= 2;
    flags.push(`${signals.planningRefusalCount} planning refusals nearby`);
    add(
      factors,
      `${signals.planningRefusalCount} planning refusals nearby`,
      -2,
      'risk',
      'negative',
    );
  }

  return {
    score: Math.max(
      config.dimensionCaps.riskMin,
      Math.min(config.dimensionCaps.riskMax, score),
    ),
    flags,
  };
}

function scoreEquity(
  lead: EnrichedLead,
  pricePaid: PricePaid | null,
  factors: ScoreFactor[],
  config: ScorerConfig,
): number {
  if (!lead.estateValuePence) {
    add(factors, 'No estate value recorded', 0, 'equity', 'neutral');
    return 0;
  }

  const avgAreaPricePence = pricePaid?.avgPrice
    ? pricePaid.avgPrice * 100
    : null;

  if (!avgAreaPricePence) {
    add(
      factors,
      'Estate value present, no area comparable',
      config.equityNoComparable,
      'equity',
    );
    return config.equityNoComparable;
  }

  const equityRatio = lead.estateValuePence / avgAreaPricePence;

  // Bands are pre-sorted high → low; first match wins.
  const band =
    config.equityBands.find((b) => equityRatio >= b.minRatio) ??
    config.equityBands[config.equityBands.length - 1];
  const pts = band?.points ?? 2;
  const label = band?.label ?? 'Low equity vs area average';
  add(factors, label, pts, 'equity');
  return pts;
}

function scoreMarketTrend(
  hpi: Hpi | null,
  factors: ScoreFactor[],
  config: ScorerConfig,
): { score: number; label: string } {
  const mt = config.marketTrend;
  if (!hpi) {
    add(factors, 'Market trend unknown', mt.unknown, 'marketTrend', 'neutral');
    return { score: mt.unknown, label: 'unknown' };
  }
  if (hpi.trend === 'rising') {
    add(factors, 'Rising market', mt.rising, 'marketTrend', 'positive');
    return { score: mt.rising, label: 'rising' };
  }
  if (hpi.trend === 'stable') {
    add(factors, 'Stable market', mt.stable, 'marketTrend', 'neutral');
    return { score: mt.stable, label: 'stable' };
  }
  if (hpi.trend === 'declining') {
    add(factors, 'Declining market', mt.declining, 'marketTrend', 'neutral');
    return { score: mt.declining, label: 'declining' };
  }
  add(factors, 'Market trend unknown', mt.unknown, 'marketTrend', 'neutral');
  return { score: mt.unknown, label: 'unknown' };
}

function scoreContactQuality(
  lead: EnrichedLead,
  factors: ScoreFactor[],
  config: ScorerConfig,
): number {
  let score = 0;
  const pieces: string[] = [];
  if (lead.contactName) {
    score += config.contact.name;
    pieces.push('name');
  }
  if (lead.contactPhone) {
    score += config.contact.phone;
    pieces.push('phone');
  }
  if (lead.contactEmail) {
    score += config.contact.email;
    pieces.push('email');
  }
  score = Math.min(config.dimensionCaps.contactQuality, score);
  if (score === 0) {
    add(factors, 'No contact data', 0, 'contactQuality', 'neutral');
  } else {
    add(
      factors,
      `Contact ready (${pieces.join(', ')})`,
      score,
      'contactQuality',
    );
  }
  return score;
}

// ─────────────────────────────────────────────────────────────────────────
// Verdict + rationale
// ─────────────────────────────────────────────────────────────────────────

function verdictFromScore(
  total: number,
  hasCriticalData: boolean,
  config: ScorerConfig,
): Verdict {
  if (!hasCriticalData) return 'INSUFFICIENT_DATA';
  if (total >= config.verdictThresholds.strong) return 'STRONG';
  if (total >= config.verdictThresholds.viable) return 'VIABLE';
  if (total >= config.verdictThresholds.thin) return 'THIN';
  return 'PASS';
}

/**
 * Build a one-line plain-English summary, ready to render directly.
 * Picks the strongest positive factor and the strongest negative one.
 */
function buildRationale(
  verdict: Verdict,
  total: number,
  factors: ScoreFactor[],
): string {
  if (verdict === 'INSUFFICIENT_DATA') {
    return 'Insufficient data to score — missing address or postcode.';
  }
  const positives = factors
    .filter((f) => f.points > 0)
    .sort((a, b) => b.points - a.points);
  const negatives = factors
    .filter((f) => f.points < 0)
    .sort((a, b) => a.points - b.points);

  const verdictWord =
    verdict === 'STRONG'
      ? 'Strong'
      : verdict === 'VIABLE'
        ? 'Viable'
        : verdict === 'THIN'
          ? 'Thin'
          : 'Pass';

  const topPositives = positives.slice(0, 3).map((f) => f.label.toLowerCase());
  const topNegatives = negatives.slice(0, 2).map((f) => f.label.toLowerCase());

  let s = `${verdictWord} lead (${total}/100)`;
  if (topPositives.length > 0) {
    s += ` driven by ${topPositives.join(', ')}`;
  }
  if (topNegatives.length > 0) {
    s += `; pulled down by ${topNegatives.join(', ')}`;
  }
  return s + '.';
}

// ─────────────────────────────────────────────────────────────────────────
// Public scorer
// ─────────────────────────────────────────────────────────────────────────

export function scoreLead(
  lead: EnrichedLead,
  pricePaid: PricePaid | null,
  hpi: Hpi | null,
  signals?: LeadSignals,
  config: ScorerConfig = DEFAULT_SCORER_CONFIG,
): ScoreBreakdown {
  const hasCriticalData = Boolean(lead.address && lead.postcode);
  const factors: ScoreFactor[] = [];

  const motivation = scoreMotivation(lead, signals, factors, config);
  const equity = scoreEquity(lead, pricePaid, factors, config);
  const { score: marketTrend, label: marketTrendLabel } = scoreMarketTrend(
    hpi,
    factors,
    config,
  );
  const contactQuality = scoreContactQuality(lead, factors, config);
  const { score: risk, flags: riskFlags } = scoreRisk(signals, factors, config);

  const total = Math.max(
    0,
    Math.min(100, motivation + equity + marketTrend + contactQuality + risk),
  );
  const verdict = verdictFromScore(total, hasCriticalData, config);
  const rationale = buildRationale(verdict, total, factors);

  return {
    motivation,
    equity,
    marketTrend,
    contactQuality,
    risk,
    total,
    verdict,
    marketTrendLabel,
    riskFlags,
    factors,
    rationale,
  };
}

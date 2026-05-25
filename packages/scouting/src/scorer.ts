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
): number {
  let score = 0;

  // Lead type urgency (0–25)
  const typeScores: Record<string, number> = {
    probate: 25,
    distressed_sale: 22,
    mortgage_default: 20,
    lease_expiry: 18,
    divorce: 18,
    repossession: 22,
    empty_property: 15,
    downsizing: 12,
    chain_break: 14,
    relocation: 10,
    unknown: 5,
  };
  const typeKey = lead.leadType.toLowerCase().replace(/\s+/g, '_');
  const typePoints = typeScores[typeKey] ?? 5;
  // Prefer the PropertyData listing label when present (more specific than 'unknown')
  const niceTypeLabel = signals?.listingType
    ? (LISTING_TYPE_LABELS[signals.listingType] ?? leadTypeLabel(typeKey))
    : leadTypeLabel(typeKey);
  score += typePoints;
  add(factors, niceTypeLabel, typePoints, 'motivation');

  // Golden Window
  if (lead.goldenWindowLabel === 'hot') {
    score += 12;
    add(factors, 'Hot probate window', 12, 'motivation');
  } else if (lead.goldenWindowLabel === 'warm') {
    score += 8;
    add(factors, 'Warm probate window', 8, 'motivation');
  } else if (lead.goldenWindowLabel === 'cool') {
    score += 4;
    add(factors, 'Cool probate window', 4, 'motivation');
  }

  // Solicitor involvement
  if (lead.solicitorFirm) {
    score += 5;
    add(factors, 'Solicitor identified', 5, 'motivation');
  }

  // Letters of admin = unplanned estate
  if (lead.grantType === 'letters_of_administration') {
    score += 3;
    add(factors, 'Letters of administration (unplanned)', 3, 'motivation');
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

  return Math.min(40, score);
}

function scoreRisk(
  signals: LeadSignals | undefined,
  factors: ScoreFactor[],
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

  return { score: Math.max(-10, Math.min(10, score)), flags };
}

function scoreEquity(
  lead: EnrichedLead,
  pricePaid: PricePaid | null,
  factors: ScoreFactor[],
): number {
  if (!lead.estateValuePence) {
    add(factors, 'No estate value recorded', 0, 'equity', 'neutral');
    return 0;
  }

  const avgAreaPricePence = pricePaid?.avgPrice
    ? pricePaid.avgPrice * 100
    : null;

  if (!avgAreaPricePence) {
    add(factors, 'Estate value present, no area comparable', 6, 'equity');
    return 6;
  }

  const equityRatio = lead.estateValuePence / avgAreaPricePence;

  let pts = 2;
  let label = 'Low equity vs area average';
  if (equityRatio >= 1.5) {
    pts = 25;
    label = 'Strong equity (1.5× area average)';
  } else if (equityRatio >= 1.2) {
    pts = 20;
    label = 'Solid equity (1.2× area average)';
  } else if (equityRatio >= 1.0) {
    pts = 15;
    label = 'Equity at area average';
  } else if (equityRatio >= 0.75) {
    pts = 10;
    label = 'Borderline equity (75% of area)';
  } else if (equityRatio >= 0.5) {
    pts = 5;
    label = 'Thin equity (50% of area)';
  }
  add(factors, label, pts, 'equity');
  return pts;
}

function scoreMarketTrend(
  hpi: Hpi | null,
  factors: ScoreFactor[],
): { score: number; label: string } {
  if (!hpi) {
    add(factors, 'Market trend unknown', 7, 'marketTrend', 'neutral');
    return { score: 7, label: 'unknown' };
  }
  if (hpi.trend === 'rising') {
    add(factors, 'Rising market', 15, 'marketTrend', 'positive');
    return { score: 15, label: 'rising' };
  }
  if (hpi.trend === 'stable') {
    add(factors, 'Stable market', 10, 'marketTrend', 'neutral');
    return { score: 10, label: 'stable' };
  }
  if (hpi.trend === 'declining') {
    add(factors, 'Declining market', 6, 'marketTrend', 'neutral');
    return { score: 6, label: 'declining' };
  }
  add(factors, 'Market trend unknown', 7, 'marketTrend', 'neutral');
  return { score: 7, label: 'unknown' };
}

function scoreContactQuality(
  lead: EnrichedLead,
  factors: ScoreFactor[],
): number {
  let score = 0;
  const pieces: string[] = [];
  if (lead.contactName) {
    score += 3;
    pieces.push('name');
  }
  if (lead.contactPhone) {
    score += 4;
    pieces.push('phone');
  }
  if (lead.contactEmail) {
    score += 3;
    pieces.push('email');
  }
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

function verdictFromScore(total: number, hasCriticalData: boolean): Verdict {
  if (!hasCriticalData) return 'INSUFFICIENT_DATA';
  if (total >= 70) return 'STRONG';
  if (total >= 50) return 'VIABLE';
  if (total >= 30) return 'THIN';
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
): ScoreBreakdown {
  const hasCriticalData = Boolean(lead.address && lead.postcode);
  const factors: ScoreFactor[] = [];

  const motivation = scoreMotivation(lead, signals, factors);
  const equity = scoreEquity(lead, pricePaid, factors);
  const { score: marketTrend, label: marketTrendLabel } = scoreMarketTrend(
    hpi,
    factors,
  );
  const contactQuality = scoreContactQuality(lead, factors);
  const { score: risk, flags: riskFlags } = scoreRisk(signals, factors);

  const total = Math.max(
    0,
    Math.min(100, motivation + equity + marketTrend + contactQuality + risk),
  );
  const verdict = verdictFromScore(total, hasCriticalData);
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

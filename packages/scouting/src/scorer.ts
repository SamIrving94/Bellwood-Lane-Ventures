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
 *                              enforcement. SUBTRACTS for distressed-area
 *                              risks we don't want to acquire, ADDS for
 *                              clean-title low-risk picks.
 *
 *   Total caps at 100.
 *
 * Verdicts:
 *   STRONG           ≥ 70
 *   VIABLE           50–69
 *   THIN             30–49
 *   PASS             < 30
 *   INSUFFICIENT_DATA  when critical inputs are missing
 */

import type { Hpi } from '@repo/property-data/src/hmlr-hpi';
import type { PricePaid } from '@repo/property-data/src/hmlr';
import type { EnrichedLead } from './enrichment';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Verdict = 'STRONG' | 'VIABLE' | 'THIN' | 'PASS' | 'INSUFFICIENT_DATA';

export interface ScoreBreakdown {
  motivation: number;   // 0–40
  equity: number;       // 0–25
  marketTrend: number;  // 0–15
  contactQuality: number; // 0–10
  risk: number;         // -10 to +10 (penalty when negative)
  total: number;        // 0–100 (clamped)
  verdict: Verdict;
  marketTrendLabel: string;
  /** Human-readable risk reasons, e.g. ['flood: high', 'EPC F', 'lease 62y']. */
  riskFlags: string[];
}

/**
 * Per-lead "freshness" signals derived from PropertyData (passed through
 * from rawPayload at the cron layer). Used to boost motivation when the
 * listing shows price-velocity or accelerating distress.
 */
export interface LeadSignals {
  /** Number of distinct price reductions in the listing history. */
  reductionCount?: number;
  /** Velocity = (totalDropPercent × reductionCount) / daysOnMarket. */
  velocityScore?: number;
  daysOnMarket?: number | null;
  discountPercent?: number | null;
  /** Source slug, e.g. 'repossessed-properties' — for type-specific boosts. */
  listingType?: string;
  /** % of postcode population aged 65+. Used as a pre-probate proxy. */
  percentOver65?: number | null;
  /** % of postcode population aged 75+. Stronger pre-probate signal. */
  percentOver75?: number | null;
  // ── Risk inputs ──────────────────────────────────────────────────────
  /** EA flood band: 'very low' | 'low' | 'medium' | 'high'. */
  floodRisk?: string | null;
  /** Property's EPC rating: A B C D E F G. F/G is a penalty. */
  epcRating?: string | null;
  /** Remaining lease years. <80 is a soft penalty, <60 is a hard one. */
  remainingLeaseYears?: number | null;
  /** Tenure: 'freehold' is +1, 'leasehold' triggers the lease check. */
  tenure?: 'freehold' | 'leasehold' | 'unknown' | null;
  /** Count of planning enforcement notices / refusals in the area. */
  planningRefusalCount?: number;
}

// ---------------------------------------------------------------------------
// Component scorers
// ---------------------------------------------------------------------------

/**
 * Motivation score (0–45).
 *
 * High-urgency lead types and fresh Golden Windows score highest.
 */
function scoreMotivation(
  lead: EnrichedLead,
  signals?: LeadSignals,
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
  score += typeScores[typeKey] ?? 5;

  // Golden Window timing bonus (0–12)
  if (lead.goldenWindowLabel === 'hot') score += 12;
  else if (lead.goldenWindowLabel === 'warm') score += 8;
  else if (lead.goldenWindowLabel === 'cool') score += 4;
  // cold = 0

  // Solicitor involvement — suggests live estate administration (0–5)
  if (lead.solicitorFirm) score += 5;

  // Letters of administration = higher motivation (unplanned estate)
  if (lead.grantType === 'letters_of_administration') score += 3;

  // ── Velocity boost (0–8) ───────────────────────────────────────────
  // High velocity = seller dropping price rapidly; classic motivated signal.
  if (signals?.velocityScore && signals.velocityScore > 0) {
    if (signals.velocityScore >= 1.0) score += 8;
    else if (signals.velocityScore >= 0.5) score += 5;
    else if (signals.velocityScore >= 0.2) score += 3;
    else if (signals.velocityScore >= 0.05) score += 1;
  }

  // Stale-listing boost (0–4) — long on market without reductions still
  // signals discouragement.
  if (
    signals?.daysOnMarket &&
    signals.daysOnMarket >= 90 &&
    (!signals.reductionCount || signals.reductionCount === 0)
  ) {
    score += 4;
  } else if (signals?.daysOnMarket && signals.daysOnMarket >= 60) {
    score += 2;
  }

  // ── Pre-probate area boost (0–5) ─────────────────────────────────────
  // Areas with high over-75 population have more probate grants in the
  // coming years. Modest boost — area-level proxy, not property-level.
  if (signals?.percentOver75 && signals.percentOver75 >= 15) {
    score += 5;
  } else if (signals?.percentOver75 && signals.percentOver75 >= 10) {
    score += 3;
  } else if (signals?.percentOver65 && signals.percentOver65 >= 25) {
    score += 2;
  }

  return Math.min(40, score);
}

/**
 * Risk score (-10 to +10).
 *
 * Heavy penalty: high flood risk, F/G EPC, very-short lease (<60 yr).
 * Mild penalty: medium flood, E EPC, short lease (<80 yr), planning
 * enforcement.
 * Bonus: freehold tenure, A-C EPC, lease >100 yr, no risk flags = clean
 * acquisition.
 */
function scoreRisk(signals?: LeadSignals): {
  score: number;
  flags: string[];
} {
  let score = 0;
  const flags: string[] = [];
  if (!signals) return { score: 0, flags: [] };

  // Flood risk
  const flood = (signals.floodRisk ?? '').toLowerCase();
  if (flood.includes('high')) {
    score -= 6;
    flags.push(`flood: high`);
  } else if (flood.includes('medium')) {
    score -= 3;
    flags.push(`flood: medium`);
  } else if (flood.includes('low') || flood.includes('very low')) {
    score += 1;
  }

  // EPC
  const epc = (signals.epcRating ?? '').toUpperCase();
  if (epc === 'F' || epc === 'G') {
    score -= 4;
    flags.push(`EPC ${epc}`);
  } else if (epc === 'E') {
    score -= 2;
    flags.push(`EPC E`);
  } else if (epc === 'A' || epc === 'B' || epc === 'C') {
    score += 2;
  }

  // Lease
  if (signals.tenure === 'leasehold' && typeof signals.remainingLeaseYears === 'number') {
    if (signals.remainingLeaseYears < 60) {
      score -= 6;
      flags.push(`lease ${signals.remainingLeaseYears}y`);
    } else if (signals.remainingLeaseYears < 80) {
      score -= 3;
      flags.push(`lease ${signals.remainingLeaseYears}y`);
    } else if (signals.remainingLeaseYears > 125) {
      score += 1;
    }
  } else if (signals.tenure === 'freehold') {
    score += 2;
  }

  // Planning refusals (proxy for area-level enforcement risk)
  if (signals.planningRefusalCount && signals.planningRefusalCount >= 3) {
    score -= 2;
    flags.push(`${signals.planningRefusalCount} planning refusals nearby`);
  }

  // Clamp to ±10
  return { score: Math.max(-10, Math.min(10, score)), flags };
}

/**
 * Equity score (0–30).
 *
 * Compares estimated estate value against area average sold price.
 * Higher equity headroom = better BMV opportunity.
 */
function scoreEquity(
  lead: EnrichedLead,
  pricePaid: PricePaid | null
): number {
  if (!lead.estateValuePence) return 0;

  const avgAreaPricePence = pricePaid?.avgPrice
    ? pricePaid.avgPrice * 100 // HMLR prices are in pounds, convert to pence
    : null;

  if (!avgAreaPricePence) {
    // No comparables — give minimal credit for having an estate value
    return 6;
  }

  const equityRatio = lead.estateValuePence / avgAreaPricePence;

  // Score bands based on LTV headroom (scaled to 25-point cap)
  if (equityRatio >= 1.5) return 25; // Strong equity — significant BMV room
  if (equityRatio >= 1.2) return 20;
  if (equityRatio >= 1.0) return 15;
  if (equityRatio >= 0.75) return 10; // Borderline — thin margins
  if (equityRatio >= 0.5) return 5;   // Low equity — likely mortgaged
  return 2;                            // Very low equity
}

/**
 * Market trend score (0–15).
 *
 * Rising market = buyer incentive; declining = added urgency for seller.
 * Both can be positive for motivated-seller strategy but in different ways.
 */
function scoreMarketTrend(hpi: Hpi | null): { score: number; label: string } {
  if (!hpi) return { score: 7, label: 'unknown' }; // Neutral default

  switch (hpi.trend) {
    case 'rising':
      // Rising market: confident buyers, strong comparables
      return { score: 15, label: 'rising' };
    case 'stable':
      return { score: 10, label: 'stable' };
    case 'declining':
      // Declining market: seller urgency increases, but exit harder
      return { score: 6, label: 'declining' };
    default:
      return { score: 7, label: 'unknown' };
  }
}

/**
 * Contact quality score (0–10).
 *
 * Complete contact details increase conversion probability.
 */
function scoreContactQuality(lead: EnrichedLead): number {
  let score = 0;
  if (lead.contactName) score += 3;
  if (lead.contactPhone) score += 4;
  if (lead.contactEmail) score += 3;
  return score;
}

// ---------------------------------------------------------------------------
// Verdict assignment
// ---------------------------------------------------------------------------

function verdictFromScore(total: number, hasCriticalData: boolean): Verdict {
  if (!hasCriticalData) return 'INSUFFICIENT_DATA';
  if (total >= 70) return 'STRONG';
  if (total >= 50) return 'VIABLE';
  if (total >= 30) return 'THIN';
  return 'PASS';
}

// ---------------------------------------------------------------------------
// Public scorer
// ---------------------------------------------------------------------------

/**
 * Score an enriched lead against property-data comparables.
 *
 * @param lead      - Enriched lead with contact and Golden Window data.
 * @param pricePaid - HMLR price paid data for the postcode (may be null).
 * @param hpi       - HMLR house price index for the region (may be null).
 * @returns ScoreBreakdown with per-component scores, total, and verdict.
 */
export function scoreLead(
  lead: EnrichedLead,
  pricePaid: PricePaid | null,
  hpi: Hpi | null,
  signals?: LeadSignals,
): ScoreBreakdown {
  // Critical data check: must have at least an address and postcode
  const hasCriticalData = Boolean(lead.address && lead.postcode);

  const motivation = scoreMotivation(lead, signals);
  const equity = scoreEquity(lead, pricePaid);
  const { score: marketTrend, label: marketTrendLabel } = scoreMarketTrend(hpi);
  const contactQuality = scoreContactQuality(lead);
  const { score: risk, flags: riskFlags } = scoreRisk(signals);

  const total = Math.max(
    0,
    Math.min(100, motivation + equity + marketTrend + contactQuality + risk),
  );
  const verdict = verdictFromScore(total, hasCriticalData);

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
  };
}

/**
 * @repo/instant-offer — Web-facing instant offer generator
 *
 * Wraps the existing @repo/valuation runAVM orchestrator and returns a
 * simplified, web-friendly payload suitable for the public Instant Offer
 * chat UI. Does NOT duplicate business logic — all pricing is computed by
 * the canonical AVM pipeline.
 */

import 'server-only';

import { runAVM, type PropertyType, type SellerType } from '@repo/valuation';

// ---------------------------------------------------------------------------
// Public input/output types
// ---------------------------------------------------------------------------

export type InstantOfferSituation =
  | 'probate'
  | 'chain_break'
  | 'repossession'
  | 'relocation'
  | 'short_lease'
  | 'problem_property'
  | 'other';

export interface InstantOfferInput {
  postcode: string;
  address?: string;
  propertyType: PropertyType;
  bedrooms?: number;
  /** 1-10 condition rating from the agent/seller */
  condition?: number;
  situation: InstantOfferSituation;
  /** Target completion window in days */
  urgencyDays?: number;
  askingPricePence?: number;
}

export interface InstantOfferResult {
  /** Low end of AVM range in pence */
  estimatedMarketValueMinPence: number;
  /** High end of AVM range in pence */
  estimatedMarketValueMaxPence: number;
  /** Our cash offer in pence */
  offerPence: number;
  /** offerPence / avmPointEstimate, rounded to 3 dp */
  offerPercentOfAvm: number;
  /** 0-1 confidence score */
  confidenceScore: number;
  /** Committed completion window */
  completionDays: number;
  /** Human-readable reasoning lines for transparency panel */
  reasoning: string[];
  /** When the offer expires (72 hours from now) */
  lockedUntil: Date;
  /** True when this needs founder approval before being shown to the agent */
  requiresReview: boolean;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function mapSituationToSellerType(s: InstantOfferSituation): SellerType {
  switch (s) {
    case 'probate': return 'probate';
    case 'chain_break': return 'chain_break';
    case 'repossession': return 'repossession';
    case 'relocation': return 'relocation';
    case 'short_lease': return 'short_lease';
    case 'problem_property': return 'standard'; // use standard pricing, flag via reasoning
    case 'other':
    default: return 'standard';
  }
}

function computeCompletionDays(urgencyDays?: number): number {
  if (!urgencyDays) return 21;
  return Math.max(14, Math.min(28, Math.round(urgencyDays)));
}

function computeConfidence(
  comparableCount: number,
  hasCondition: boolean,
  avmConfidenceLevel: string,
): number {
  // Base 0.5, up to +0.25 for comps, +0.1 for condition, +0.15 for level mapping
  let score = 0.5;
  if (comparableCount >= 10) score += 0.25;
  else if (comparableCount >= 5) score += 0.15;
  else if (comparableCount >= 3) score += 0.08;

  if (hasCondition) score += 0.1;

  const level = avmConfidenceLevel.toLowerCase();
  if (level === 'high') score += 0.15;
  else if (level === 'medium') score += 0.07;

  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function generateInstantOffer(
  input: InstantOfferInput,
): Promise<InstantOfferResult> {
  const sellerType = mapSituationToSellerType(input.situation);

  const avm = await runAVM({
    postcode: input.postcode,
    propertyType: input.propertyType,
    address: input.address,
    bedrooms: input.bedrooms,
    sellerType,
  });

  const r = avm.resultJson;

  const reasoning: string[] = [];

  // Comparables
  reasoning.push(
    `${r.comparableCount} comparable sales in ${r.postcode} (last 24 months) via ${r.avmSources}`,
  );

  // AVM headline
  reasoning.push(
    `AVM point estimate £${Math.round(r.avmPointEstimate / 100).toLocaleString('en-GB')} (${r.confidenceLevel} confidence)`,
  );

  // Base acquisition margin
  reasoning.push(
    `Base acquisition margin for ${sellerType.replace('_', ' ')}: ${(r.baseAcquisitionMargin * 100).toFixed(0)}%`,
  );

  // Top discount factors
  for (const line of r.discountLines.slice(0, 4)) {
    if (line.fraction !== 0) {
      const pct = (line.fraction * 100).toFixed(1);
      reasoning.push(`${line.label}: ${line.fraction > 0 ? '-' : '+'}${Math.abs(Number(pct))}%`);
    }
  }

  // EPC / construction
  if (r.epcRating) {
    reasoning.push(`EPC rating ${r.epcRating} (${r.epcAdjustment > 0 ? '-' : '+'}${Math.abs(r.epcAdjustment * 100).toFixed(1)}%)`);
  }

  // Pre-RICS flags (honest surface)
  for (const flag of r.preRicsFlags.slice(0, 3)) {
    reasoning.push(`⚠ ${flag}`);
  }

  // CEO escalation — mark for review
  const requiresReview = r.requiresCeoEscalation || r.discountCapped;
  if (r.requiresCeoEscalation) {
    reasoning.push('Offer below 60% of AVM — founder review required before commitment');
  }

  // Problem property note
  if (input.situation === 'problem_property') {
    reasoning.push('Problem property — our cash buyer model handles knotweed, short leases, structural, non-standard construction');
  }

  // Urgency
  const completionDays = computeCompletionDays(input.urgencyDays);
  if (input.urgencyDays && input.urgencyDays < 14) {
    reasoning.push(`Urgency <14 days requested — we commit to completion in ${completionDays} days`);
  }

  const confidenceScore = computeConfidence(
    r.comparableCount,
    typeof input.condition === 'number',
    r.confidenceLevel,
  );

  return {
    estimatedMarketValueMinPence: r.avmLow,
    estimatedMarketValueMaxPence: r.avmHigh,
    offerPence: r.finalOffer,
    offerPercentOfAvm: Math.round((r.finalOffer / r.avmPointEstimate) * 1000) / 1000,
    confidenceScore,
    completionDays,
    reasoning,
    lockedUntil: new Date(Date.now() + 72 * 60 * 60 * 1000),
    requiresReview,
  };
}

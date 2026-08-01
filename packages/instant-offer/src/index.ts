/**
 * @repo/instant-offer — Web-facing instant offer generator
 *
 * Wraps the existing @repo/valuation runAVM orchestrator and returns a
 * simplified, web-friendly payload suitable for the public Instant Offer
 * chat UI. Does NOT duplicate business logic — all pricing is computed by
 * the canonical AVM pipeline.
 */

import 'server-only';

import { callClaude } from '@repo/ai/claude';
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
  /**
   * Remaining lease years, when known. Forwarded to the AVM so the lease
   * discount curve can be applied. The public chat form does not ask for it —
   * see ASSUMED_SHORT_LEASE_YEARS for what happens when it is absent on a
   * self-declared short-lease property.
   */
  remainingLeaseYears?: number;
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
  /**
   * LLM-generated 2-3 paragraph narrative in Kept voice, suitable for
   * dropping into the signed PDF or follow-up email. Null when Claude is
   * unavailable — callers fall back to the `reasoning` array.
   */
  narrative: string | null;
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

/**
 * Remaining lease years assumed when the seller picks "short lease" but we
 * have not been told the actual term (the public form never asks for it).
 *
 * Why a default is required at all: the short_lease base acquisition margin is
 * the LOWEST of every seller type (15% vs 22% standard) precisely because the
 * offer-calculation module expects the lease discount to be "applied
 * separately". This path never supplied lease years, so `leaseDiscount(
 * undefined)` returned 0 and "Short lease" produced a BETTER offer than
 * "Other" — ~£17.5k overpaid on a £250k flat.
 *
 * Why 65: it lands in the 60-69 band of the valuation lease curve, which
 * carries a 7% discount — exactly the 7 percentage points by which the
 * short_lease margin undercuts standard, so an unknown short lease can never
 * out-bid a standard sale. It is also comfortably under the 80-year
 * marriage-value threshold, below which a lease is short enough that a seller
 * would describe it that way. It is deliberately the LEAST punitive
 * assumption that restores the invariant — callers who know the real term
 * should always pass `remainingLeaseYears` and get the true curve.
 */
export const ASSUMED_SHORT_LEASE_YEARS = 65;

/**
 * Confidence ceiling for an offer whose valuation is not backed by real
 * evidence. Sits below the 0.5 base of `computeConfidence` so the additive
 * score can never dress a synthetic or comp-less valuation up as a firm
 * figure.
 */
const LOW_EVIDENCE_CONFIDENCE_CEILING = 0.4;

/**
 * True when the AVM behind this offer is not backed by real market evidence:
 * a 'low' confidence level, a synthetic price-paid feed, or no comparables at
 * all. `avmSources` is the `source` string from base-valuation — one of
 * `hmlr_ppd...`, `propertydata_sold_distance(...)` or the literal `synthetic`
 * — so a substring match is the correct test.
 */
function isLowEvidence(
  avmConfidenceLevel: string,
  avmSources: string,
  comparableCount: number,
): boolean {
  return (
    avmConfidenceLevel.toLowerCase() === 'low' ||
    avmSources.toLowerCase().includes('synthetic') ||
    comparableCount === 0
  );
}

export function computeConfidence(
  comparableCount: number,
  hasCondition: boolean,
  avmConfidenceLevel: string,
  avmSources: string,
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

  const rounded = Math.max(0, Math.min(1, Math.round(score * 100) / 100));

  // The additive score above is purely a bonus tally — nothing subtracts. A
  // wholly synthetic, comp-less valuation still scored 0.5 base + 0.1 for a
  // self-reported condition rating and read as reasonably confident. Cap it
  // hard when the underlying evidence isn't real, so the number the seller
  // sees tracks the evidence rather than the number of boxes ticked.
  if (isLowEvidence(avmConfidenceLevel, avmSources, comparableCount)) {
    return Math.min(rounded, LOW_EVIDENCE_CONFIDENCE_CEILING);
  }

  return rounded;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function generateInstantOffer(
  input: InstantOfferInput,
): Promise<InstantOfferResult> {
  const sellerType = mapSituationToSellerType(input.situation);

  // A self-declared short lease with no stated term falls back to a
  // conservative assumption — without it the discounted short_lease margin is
  // never paid for by a lease discount and the offer comes out ABOVE standard.
  const leaseYearsAssumed =
    input.remainingLeaseYears === undefined && sellerType === 'short_lease';
  const remainingLeaseYears = leaseYearsAssumed
    ? ASSUMED_SHORT_LEASE_YEARS
    : input.remainingLeaseYears;

  const avm = await runAVM({
    postcode: input.postcode,
    propertyType: input.propertyType,
    address: input.address,
    bedrooms: input.bedrooms,
    sellerType,
    remainingLeaseYears,
  });

  const r = avm.resultJson;

  const reasoning: string[] = [];

  // Comparables
  reasoning.push(
    `${r.comparableCount} comparable sales in ${r.postcode} (last 24 months) via ${r.avmSources}`,
  );

  // AVM headline. `avmPointEstimate` is already in POUNDS (the AVM works in
  // pounds throughout — see the pounds→pence conversion in the return block
  // below), so it must NOT be divided by 100. It used to be, which printed
  // "AVM point estimate £3,050" beside a £305,000 offer.
  reasoning.push(
    `AVM point estimate £${Math.round(r.avmPointEstimate).toLocaleString('en-GB')} (${r.confidenceLevel} confidence)`,
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

  if (leaseYearsAssumed) {
    reasoning.push(
      `Remaining lease not supplied — ${ASSUMED_SHORT_LEASE_YEARS} years assumed for this estimate, subject to confirmation from the title`,
    );
  }

  // EPC / construction.
  // NOTE: the sign convention here is the OPPOSITE of the discountLines loop
  // above. A discount line's `fraction` is positive when it takes money OFF,
  // whereas EPC_ADJUSTMENT (risk-scoring.ts) is positive for an UPLIFT
  // (A/B = +0.01) and negative for a penalty (F/G = -0.02). The ternary was
  // copy-pasted from the loop, so an A-rated home displayed "(-1.0%)" and an
  // F-rated home "(+2.0%)" — both backwards.
  if (r.epcRating) {
    // `>= 0` (not `> 0`) keeps a neutral band C/D reading "+0.0%" rather than
    // the nonsensical "-0.0%".
    reasoning.push(`EPC rating ${r.epcRating} (${r.epcAdjustment >= 0 ? '+' : '-'}${Math.abs(r.epcAdjustment * 100).toFixed(1)}%)`);
  }

  // Pre-RICS flags (honest surface)
  for (const flag of r.preRicsFlags.slice(0, 3)) {
    reasoning.push(`⚠ ${flag}`);
  }

  // CEO escalation / thin evidence — mark for review.
  //
  // Low evidence must gate too. Previously an offer built entirely on
  // synthetic comparables sailed through as a firm figure locked for 72
  // hours with no review flag, because only the escalation and discount-cap
  // conditions were checked.
  const lowEvidence = isLowEvidence(
    r.confidenceLevel,
    r.avmSources,
    r.comparableCount,
  );
  const requiresReview =
    r.requiresCeoEscalation || r.discountCapped || lowEvidence;

  if (r.requiresCeoEscalation) {
    reasoning.push('Offer below 60% of AVM — founder review required before commitment');
  }
  if (lowEvidence) {
    reasoning.push('Limited comparable evidence for this property — founder review required before commitment');
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
    r.avmSources,
  );

  // Generate a plain-English narrative for the vendor PDF / follow-up email.
  // Null-tolerant: when Claude is unavailable, callers fall back to the
  // structured `reasoning` array. NEVER load-bearing.
  const narrative = await generateOfferNarrative({
    sellerType,
    avmPointEstimate: r.avmPointEstimate,
    finalOffer: r.finalOffer,
    confidenceLevel: r.confidenceLevel,
    comparableCount: r.comparableCount,
    postcode: r.postcode,
    epcRating: r.epcRating,
    discountLines: r.discountLines.slice(0, 5),
    preRicsFlags: r.preRicsFlags.slice(0, 3),
    completionDays,
    requiresReview,
  });

  // The underlying AVM (HMLR Price Paid + hedonic + offer-calc) works in
  // POUNDS (HMLR returns price as integer pounds). The web payload labels
  // these fields *Pence and the UI divides by 100 for display, so we must
  // multiply by 100 here to convert pounds -> pence and keep the contract
  // honest. Without this, every figure was 100x too small (offer of £305k
  // displayed as £3,051).
  return {
    estimatedMarketValueMinPence: Math.round(r.avmLow * 100),
    estimatedMarketValueMaxPence: Math.round(r.avmHigh * 100),
    offerPence: Math.round(r.finalOffer * 100),
    offerPercentOfAvm: Math.round((r.finalOffer / r.avmPointEstimate) * 1000) / 1000,
    confidenceScore,
    completionDays,
    reasoning,
    narrative,
    lockedUntil: new Date(Date.now() + 72 * 60 * 60 * 1000),
    requiresReview,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// LLM offer narrative
//
// Turns the AVM payload into 2-3 short paragraphs the vendor can actually
// read — what the offer is, what drives it, and what happens next. Kept
// voice: professional, specific, no marketing fluff.
// ───────────────────────────────────────────────────────────────────────────

const NARRATIVE_SYSTEM_PROMPT = `You write vendor-facing offer narratives for Kept, a UK cash buyer of fall-through and probate properties.

Audience: a UK homeowner or estate executor reading the indicative offer for the first time. Often distressed, often dyslexic, always tired.

Voice: professional, specific, slightly dry. Closer to a chartered surveyor than a property influencer. Adjectives only when they earn their place. Numbers and specifics over sentiment.

Format: 2 to 3 short paragraphs. Plain text — NO markdown, NO bullets, NO headings. Each paragraph 2-4 sentences max.

Content rules:
- Paragraph 1: state the offer figure and what it is (an indicative cash offer, locked for 72 hours, subject to viewing).
- Paragraph 2: explain what drives the figure — comparable sales count, the key seller-type context, the top 1-2 risk factors that adjusted it. Honest, not defensive.
- Paragraph 3 (only if useful): one concrete next step — viewing, conversation, what we'll need to confirm.
- If requiresReview is true, say plainly that a senior member of the team is reviewing the inputs before any binding commitment.
- NEVER use: "AI", "machine learning", "algorithm", "powered by", "amazing", "best", "fast cash today", urgency timers, emoji.
- NEVER invent: stick to the figures and factors you are given.
- Use UK spelling. £ symbol with grouped thousands, e.g. £252,400.`;

interface NarrativeInput {
  sellerType: SellerType;
  avmPointEstimate: number;
  finalOffer: number;
  confidenceLevel: string;
  comparableCount: number;
  postcode: string;
  epcRating: string | null;
  discountLines: Array<{ label: string; fraction: number }>;
  preRicsFlags: string[];
  completionDays: number;
  requiresReview: boolean;
}

async function generateOfferNarrative(input: NarrativeInput): Promise<string | null> {
  const discountList =
    input.discountLines.length === 0
      ? '(no risk discounts applied)'
      : input.discountLines
          .map((d) => `- ${d.label}: ${(d.fraction * 100).toFixed(1)}%`)
          .join('\n');

  const flagList =
    input.preRicsFlags.length === 0
      ? '(none)'
      : input.preRicsFlags.map((f) => `- ${f}`).join('\n');

  const offerPct = ((input.finalOffer / input.avmPointEstimate) * 100).toFixed(0);

  const userPrompt = [
    `Offer figure: £${input.finalOffer.toLocaleString('en-GB')}`,
    `Market valuation (point estimate): £${input.avmPointEstimate.toLocaleString('en-GB')}`,
    `Offer as % of AVM: ${offerPct}%`,
    `Confidence: ${input.confidenceLevel}`,
    `Comparable sales used: ${input.comparableCount} (last 24 months, ${input.postcode})`,
    `Seller-type context: ${input.sellerType.replace('_', ' ')}`,
    `EPC rating: ${input.epcRating ?? 'unknown'}`,
    `Committed completion window: ${input.completionDays} days`,
    `Requires senior review before binding: ${input.requiresReview ? 'YES' : 'no'}`,
    '',
    'Risk discounts applied (largest first):',
    discountList,
    '',
    'Pre-RICS flags:',
    flagList,
  ].join('\n');

  return callClaude({
    system: NARRATIVE_SYSTEM_PROMPT,
    user: userPrompt,
    maxTokens: 600,
    temperature: 0.5,
    feature: 'offer_narrative',
    cacheSystemPrompt: true,
  });
}

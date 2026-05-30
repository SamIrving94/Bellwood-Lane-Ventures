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
   * LLM-generated 2-3 paragraph narrative in Bellwood voice, suitable for
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
// read — what the offer is, what drives it, and what happens next. Bellwood
// voice: professional, specific, no marketing fluff.
// ───────────────────────────────────────────────────────────────────────────

const NARRATIVE_SYSTEM_PROMPT = `You write vendor-facing offer narratives for Bellwood Ventures, a UK cash buyer of fall-through and probate properties.

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

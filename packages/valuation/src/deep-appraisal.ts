/**
 * Deep Appraisal — multi-source LLM-orchestrated property analysis.
 *
 * Produces the same level of structured output Paperclip's Appraiser was
 * generating manually: comparables with reasoning, ARV with CIs, environmental
 * risk scoring, risk-adjusted bid cap (auctions), pre-auction action checklist,
 * and a defensible recommendation.
 *
 * Pulls:
 *   - HMLR Price Paid (postcode, 24 months)
 *   - HMLR HPI (regional trend)
 *   - EPC Register
 *   - Optional: PropertyData valuation cross-check
 *
 * Calls Claude Sonnet 4.5 with a structured Zod schema (generateObject) so
 * the output is type-safe at the API boundary and renderable by the UI
 * without runtime validation noise.
 *
 * Cost: ~£0.06 per appraisal with prompt caching on the system prompt.
 * Returns null on missing ANTHROPIC_API_KEY (caller falls back to the
 * existing AVM-only path).
 */

import 'server-only';

import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';

import {
  getEpcData,
  getHousepriceIndex,
  getPricePaid,
  getPropertyDataValuation,
} from '@repo/property-data';
import { keys } from '@repo/ai/keys';

// ───────────────────────────────────────────────────────────────────────────
// Output schema — what Claude must return
// ───────────────────────────────────────────────────────────────────────────

export const ComparableSale = z.object({
  address: z.string().describe('Address as it appears in source'),
  saleDate: z.string().describe('Sale date (ISO or "Mar 2025" form)'),
  pricePence: z.number().int().describe('Sale price in pence'),
  floorAreaSqm: z.number().int().nullable(),
  pricePerSqm: z.number().int().nullable(),
  notes: z.string().describe('1-line context — outlier reason, refurb signal, etc.'),
  cleanestMatch: z.boolean().describe('True if this is the single best comparable for the subject property'),
  excluded: z.boolean().describe('True if excluded from the ARV calculation'),
  exclusionReason: z.string().nullable(),
});

export const EnvironmentalRisk = z.object({
  risk: z.enum(['coal_mining', 'radon', 'flood', 'knotweed', 'noise', 'construction']),
  rating: z.enum(['high', 'medium-high', 'medium', 'medium-low', 'low']),
  material: z.boolean().describe('True if this risk should block the bid until resolved'),
  notes: z.string().describe('Why this rating + what to verify before bid'),
});

export const DiscountLine = z.object({
  label: z.string().describe('e.g. "Auction risk premium"'),
  percent: z.number().describe('Discount as % of ARV — e.g. 7 means -7%'),
  reasoning: z.string().describe('1-line justification'),
});

export const PreAuctionAction = z.object({
  action: z.string().describe('Concrete action — e.g. "Order Coal Mining Report (CON29M)"'),
  blocking: z.boolean(),
  deadline: z.string().nullable().describe('ISO date or relative ("by 12/05 EOD")'),
});

export const DeepAppraisalSchema = z.object({
  property: z.object({
    address: z.string(),
    postcode: z.string(),
    propertyTypeDescribed: z.string().describe('e.g. "3-bed mid-terrace, freehold, vacant possession"'),
    floorAreaSqm: z.number().int().nullable(),
    epcRating: z.string().nullable(),
    councilTaxBand: z.string().nullable(),
    refurbishmentSignals: z.array(z.string()).describe('e.g. "new kitchen", "new boiler"'),
  }),

  comparables: z.object({
    selected: z.array(ComparableSale).max(10),
    cleanestMatchAddress: z.string().nullable(),
    postcodeAvgPence: z.number().int().nullable(),
    methodology: z.string().describe('1-2 lines on how comparables were filtered + adjusted'),
  }),

  arv: z.object({
    pointEstimatePence: z.number().int(),
    ci50LowPence: z.number().int(),
    ci50HighPence: z.number().int(),
    ci80LowPence: z.number().int(),
    ci80HighPence: z.number().int(),
    reasoning: z.string().describe('1 paragraph triangulation reasoning'),
  }),

  condition: z.object({
    greenFlags: z.array(z.string()),
    amberFlags: z.array(z.string()),
    unverified: z.array(z.string()).describe('Data points the AVM had to assume; verify before bid'),
  }),

  environment: z.array(EnvironmentalRisk).length(6).describe(
    'Always exactly 6: coal_mining, radon, flood, knotweed, noise, construction',
  ),

  bidCap: z.object({
    isAuction: z.boolean(),
    discountStack: z.array(DiscountLine).describe('Each discount + reason'),
    totalDeductionPercent: z.number(),
    hardCapPence: z.number().int().describe('Do-not-exceed bid cap'),
    softTargetPence: z.number().int().describe('Aim-for bid'),
    probabilityOfWinningPercent: z.number().min(0).max(100).nullable(),
  }).nullable().describe('Set for auction lots; null for non-auction leads'),

  recommendation: z.object({
    verdict: z.enum(['bid', 'walk', 'bid_with_caveats', 'further_investigation']),
    headline: z.string().describe('1 sentence — what to do'),
    rationale: z.string().describe('2-3 sentences — why'),
  }),

  preAuctionActions: z.array(PreAuctionAction).describe('Concrete tasks before bid / offer'),

  confidence: z.object({
    estimatedErrorPercent: z.number().describe('e.g. 5.5 means ±5.5%'),
    level: z.enum(['high', 'moderate', 'low']),
    drivers: z.array(z.string()).describe('What would tighten confidence'),
  }),

  escalations: z.array(z.string()).describe('Specific blockers that should escalate to CEO'),
});

export type DeepAppraisal = z.infer<typeof DeepAppraisalSchema>;

// ───────────────────────────────────────────────────────────────────────────
// Input + entry point
// ───────────────────────────────────────────────────────────────────────────

export interface DeepAppraisalInput {
  address: string;
  postcode: string;
  /** Optional contextual hints — if absent the LLM reasons from the address. */
  propertyTypeHint?: string;
  bedroomsHint?: number;
  /** Auction context — provide all when isAuction=true. */
  isAuction?: boolean;
  auctionDate?: string;
  guidePricePence?: number;
  listingUrl?: string;
  refurbishmentNotes?: string;
  /** For probate / chain-break leads: vendor-side context that affects motivation. */
  sellerType?: 'probate' | 'chain_break' | 'short_lease' | 'repossession' | 'relocation' | 'standard';
  estateValuePence?: number;
  /** Optional photo URLs for vision-aware condition assessment (v2). */
  photoUrls?: string[];
}

const MODEL = 'claude-sonnet-4-5';

const SYSTEM_PROMPT = `You are a senior UK property appraiser preparing a bid-or-walk recommendation for Bellwood Ventures. The audience is a founder making a binding decision in the next 24-72 hours.

Style:
- Decision-grade, no fluff. Every line either feeds a decision or surfaces a blocker.
- Cite numbers + specifics — never adjectives without numbers.
- UK English, £ symbol with grouped thousands, prices in pence at the API boundary.
- Plain reasoning. Avoid "synergy", "leverage", "world-class".
- Honest about uncertainty. If you don't have the data, say so + put it in unverified[].

Content rules:
- comparables.selected: 5-8 best comparables from the HMLR price paid history provided. Mark ONE as cleanestMatch=true (the single best benchmark for the subject). Mark outliers excluded=true with a 1-line reason. Time-adjust prices at +0.4%/month for HPI drift when reasoning.
- arv.pointEstimate: triangulate from the cleanest match + HMLR avg + (if present) PropertyData valuation cross-check. 50% CI tighter (~±5-7%), 80% CI wider (~±12-15%).
- environment[]: ALWAYS produce exactly 6 entries (coal_mining, radon, flood, knotweed, noise, construction). For UK postcodes you don't have ground-truth on, reason from postcode + known geological knowledge (e.g. North Staffordshire = coalfield, Cornwall = radon). Mark material=true ONLY when the risk would block the bid until verified.
- bidCap (auction lots only): build a discount stack from ARV. Typical lines: auction risk premium (-5 to -8%), material env risks (-2 to -4% each), refurb-depth contingency (-2 to -4%), profit margin + costs (-10 to -15% combined). Hard cap = ARV × (1 - totalDeduction). Soft target ~3-5% below hard cap.
- recommendation.verdict: 'bid' = clear go, 'walk' = clear no, 'bid_with_caveats' = go IF pre-actions complete, 'further_investigation' = need more data first.
- preAuctionActions: numbered checklist. Mark blocking=true for anything that would change the bid cap if discovered.
- confidence: estimatedErrorPercent reflects your honest uncertainty about the ARV point estimate. ≥7% = low confidence. 4-7% = moderate. <4% = high.
- escalations: only items the CEO/founder must approve before action. Empty array if none.

Don't hallucinate floor areas or EPC ratings if the data wasn't supplied — put them in confidence.drivers and unverified[].

Return ONLY the structured object — no preamble, no commentary.`;

interface AssembledData {
  pricePaidSummary: string;
  epcSummary: string;
  hpiSummary: string;
  externalAvmSummary: string;
}

async function gatherData(input: DeepAppraisalInput): Promise<AssembledData> {
  const [pricePaid, hpi, epc, externalAvm] = await Promise.all([
    getPricePaid(input.postcode, 30).catch(() => null),
    getHousepriceIndex(input.postcode).catch(() => null),
    getEpcData(input.postcode, input.address).catch(() => null),
    getPropertyDataValuation({
      postcode: input.postcode,
      propertyType: 'terraced',
      bedrooms: input.bedroomsHint,
    }).catch(() => null),
  ]);

  const pricePaidSummary = pricePaid?.transactions?.length
    ? `Recent HMLR Price Paid transactions in ${input.postcode} (last 24 months):\n` +
      pricePaid.transactions
        .slice(0, 25)
        .map(
          (t) =>
            `- £${t.price.toLocaleString('en-GB')} | ${t.date} | ${t.propertyType}${t.newBuild ? ' (new build)' : ''} | ${t.tenure}`,
        )
        .join('\n') +
      `\n\nPostcode area average price (last 12 months): ${
        pricePaid.avgPrice
          ? `£${pricePaid.avgPrice.toLocaleString('en-GB')}`
          : 'not computed'
      }`
    : 'No HMLR Price Paid data returned for this postcode.';

  const epcSummary = epc?.epcRating
    ? `EPC Register: rating ${epc.epcRating}, floor area ${epc.floorAreaSqm ?? '?'} m², bedrooms ${epc.totalBedrooms ?? '?'}, build era ${epc.constructionAgeBand ?? '?'}.`
    : 'No EPC found for this postcode/address. Treat floor area + EPC as unverified.';

  const hpiSummary = hpi
    ? `HMLR HPI for region: annual change ${hpi.annualChange.toFixed(1)}%, monthly ${hpi.monthlyChange.toFixed(2)}%, trend ${hpi.trend}.`
    : 'No HPI data available.';

  const externalAvmSummary = externalAvm
    ? `PropertyData cross-check valuation: £${externalAvm.estimate.toLocaleString('en-GB')} (range £${externalAvm.low.toLocaleString('en-GB')}-£${externalAvm.high.toLocaleString('en-GB')}, confidence ${externalAvm.confidence}).`
    : 'No external valuation cross-check available.';

  return { pricePaidSummary, epcSummary, hpiSummary, externalAvmSummary };
}

function buildUserPrompt(input: DeepAppraisalInput, data: AssembledData): string {
  const lines: string[] = [
    `Subject property: ${input.address}, ${input.postcode}`,
  ];
  if (input.propertyTypeHint) lines.push(`Property type (hint): ${input.propertyTypeHint}`);
  if (input.bedroomsHint) lines.push(`Bedrooms (hint): ${input.bedroomsHint}`);
  if (input.sellerType) lines.push(`Seller-type context: ${input.sellerType.replace(/_/g, ' ')}`);
  if (input.estateValuePence) {
    lines.push(`Estate / grant value (probate context): £${Math.round(input.estateValuePence / 100).toLocaleString('en-GB')}`);
  }
  if (input.refurbishmentNotes) lines.push(`Listing description (refurb signals): ${input.refurbishmentNotes}`);
  if (input.isAuction) {
    lines.push('');
    lines.push('=== AUCTION LOT ===');
    if (input.auctionDate) lines.push(`Auction date: ${input.auctionDate}`);
    if (input.guidePricePence) {
      lines.push(`Guide price: £${Math.round(input.guidePricePence / 100).toLocaleString('en-GB')}`);
    }
    if (input.listingUrl) lines.push(`Listing URL: ${input.listingUrl}`);
    lines.push('Produce bidCap with full discount stack. recommendation.verdict reflects bid/walk.');
  } else {
    lines.push('');
    lines.push('Non-auction lead. Set bidCap = null. recommendation reflects offer/walk for a direct approach.');
  }

  lines.push('');
  lines.push('=== HMLR PRICE PAID DATA ===');
  lines.push(data.pricePaidSummary);
  lines.push('');
  lines.push('=== EPC REGISTER ===');
  lines.push(data.epcSummary);
  lines.push('');
  lines.push('=== HPI (regional trend) ===');
  lines.push(data.hpiSummary);
  lines.push('');
  lines.push('=== EXTERNAL CROSS-CHECK ===');
  lines.push(data.externalAvmSummary);
  lines.push('');
  lines.push('Produce the structured appraisal now.');

  return lines.join('\n');
}

/**
 * Main entry. Returns a fully-structured DeepAppraisal or null on missing
 * ANTHROPIC_API_KEY / failed Claude call. Caller persists as FounderAction.
 */
export async function runDeepAppraisal(
  input: DeepAppraisalInput,
): Promise<DeepAppraisal | null> {
  const env = keys();
  if (!env.ANTHROPIC_API_KEY) {
    console.warn(
      '[deep-appraisal] no ANTHROPIC_API_KEY — caller should fall back to AVM-only',
    );
    return null;
  }

  let data: AssembledData;
  try {
    data = await gatherData(input);
  } catch (err) {
    console.error('[deep-appraisal] data gather failed', err);
    return null;
  }

  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

  try {
    const { object } = await generateObject({
      model: anthropic(MODEL),
      schema: DeepAppraisalSchema,
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(input, data),
      maxTokens: 4000,
      temperature: 0.3,
    });
    return object;
  } catch (err) {
    console.error('[deep-appraisal] Claude call failed', err);
    return null;
  }
}

/**
 * Offer Calculation Module — base acquisition margin + risk adjustments
 *
 * Implements Section 6 of the BELA-12 AVM spec with seller-type margins
 * from BELA-32:
 *
 *   Seller type base margins (acquisition margin = amount BELOW AVM we buy):
 *     Probate      20%
 *     Chain break  20%
 *     Short lease  15%   (lease discount applied separately)
 *     Repossession 25%
 *     Standard     22%
 *
 *   Investment grade modifiers (from BELA-12):
 *     A+ grade: -3% (more competitive)
 *     C grade:  +3% (higher renovation risk)
 *
 *   Final adjustments:
 *     - Environmental discount (from risk-scoring)
 *     - Construction discount (from risk-scoring)
 *     - EPC rating adjustment (positive or negative)
 *     - Age / condition adjustment
 *     - Lease discount curve (for short-lease properties)
 *
 *   Floor:   offer >= AVM × 0.60  (below this: escalate to CEO)
 *   Ceiling: offer <= AVM × 0.88  (cap — never above 88%)
 *   Total discount cap: 40%
 *
 *   Offer valid for 14 days from issue.
 */

import 'server-only';

import type { BaseValuation } from './base-valuation.js';
import type { RiskScore } from './risk-scoring.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SellerType =
  | 'probate'
  | 'chain_break'
  | 'short_lease'
  | 'repossession'
  | 'relocation'
  | 'standard';

export type InvestmentGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

export interface OfferCalculationInput {
  baseValuation: BaseValuation;
  riskScore: RiskScore;
  sellerType: SellerType;
  investmentGrade?: InvestmentGrade;
  /** Remaining lease years — required for short_lease seller type */
  remainingLeaseYears?: number;
  /** Gross rental yield fraction — used to determine investment grade if not provided */
  grossRentalYield?: number;
}

export interface DiscountLine {
  label: string;
  fraction: number;
}

export interface OfferResult {
  avmPointEstimate: number;
  baseAcquisitionMargin: number;
  baseOffer: number;
  discountLines: DiscountLine[];
  totalDiscountFraction: number;
  finalOffer: number;
  offerLow: number;
  offerHigh: number;
  /** true when finalOffer < AVM × 0.60 and CEO escalation is required */
  requiresCeoEscalation: boolean;
  /** true when total discount hits the 40% cap */
  discountCapped: boolean;
  validUntil: string;   // ISO date string, 14 days from now
  justification: string;
  investmentGrade: InvestmentGrade;
  sellerType: SellerType;
}

// ---------------------------------------------------------------------------
// Base acquisition margins by seller type
// ---------------------------------------------------------------------------

const SELLER_TYPE_MARGIN: Record<SellerType, number> = {
  probate:     0.20,
  chain_break: 0.20,
  short_lease: 0.15,
  repossession: 0.25,
  relocation:  0.20,
  standard:    0.22,
};

// ---------------------------------------------------------------------------
// Investment grade derivation
// ---------------------------------------------------------------------------

function deriveInvestmentGrade(
  grossRentalYield: number | undefined,
  riskScore: RiskScore
): InvestmentGrade {
  if (!grossRentalYield) return 'B';

  const envBand = riskScore.environmental.envBand;

  if (grossRentalYield >= 0.08 && envBand === 'green') return 'A+';
  if (grossRentalYield >= 0.06 && (envBand === 'green' || envBand === 'amber')) return 'A';
  if (grossRentalYield >= 0.04) return 'B';
  if (envBand === 'red' || envBand === 'black') return 'D';
  return 'C';
}

// ---------------------------------------------------------------------------
// Lease discount curve — for short_lease and any property under 85 years
// ---------------------------------------------------------------------------

function leaseDiscount(remainingYears: number | undefined): number {
  if (!remainingYears) return 0;
  if (remainingYears >= 85) return 0;
  if (remainingYears >= 70) return 0.03;
  if (remainingYears >= 60) return 0.07;
  if (remainingYears >= 50) return 0.12;
  if (remainingYears >= 40) return 0.20;
  return 0.30; // < 40 years — very hard to mortgage
}

// ---------------------------------------------------------------------------
// Investment grade margin adjustment
// ---------------------------------------------------------------------------

const GRADE_ADJUSTMENT: Record<InvestmentGrade, number> = {
  'A+': -0.03,
  A:    0,
  B:    0,
  C:    0.03,
  D:    0.05,
};

// ---------------------------------------------------------------------------
// Offer validity
// ---------------------------------------------------------------------------

function validUntilDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Justification text
// ---------------------------------------------------------------------------

function buildJustification(
  sellerType: SellerType,
  baseMargin: number,
  grade: InvestmentGrade,
  gradeAdj: number,
  discountLines: DiscountLine[],
  totalDiscountFraction: number,
  requiresCeoEscalation: boolean
): string {
  const lines: string[] = [
    `Seller type: ${sellerType} — base acquisition margin ${(baseMargin * 100).toFixed(1)}%.`,
  ];

  if (gradeAdj !== 0) {
    const dir = gradeAdj < 0 ? 'reduced' : 'increased';
    lines.push(
      `Investment grade ${grade}: margin ${dir} by ${Math.abs(gradeAdj * 100).toFixed(1)}%.`
    );
  }

  for (const dl of discountLines) {
    if (dl.fraction !== 0) {
      lines.push(`${dl.label}: ${(dl.fraction * 100).toFixed(2)}% discount applied.`);
    }
  }

  lines.push(
    `Total risk-adjusted discount: ${(totalDiscountFraction * 100).toFixed(2)}% of AVM.`
  );

  if (requiresCeoEscalation) {
    lines.push(
      'ESCALATION REQUIRED: final offer falls below 60% of AVM. CEO approval needed before issuing.'
    );
  }

  return lines.join(' ');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function calculateOffer(input: OfferCalculationInput): OfferResult {
  const { baseValuation, riskScore, sellerType, remainingLeaseYears, grossRentalYield } = input;

  const avm = baseValuation.pointEstimate;
  const ci = baseValuation.confidenceInterval;

  // Determine investment grade
  const investmentGrade =
    input.investmentGrade ?? deriveInvestmentGrade(grossRentalYield, riskScore);

  // Base acquisition margin
  const baseMargin = SELLER_TYPE_MARGIN[sellerType];

  // Grade adjustment to base margin
  const gradeAdj = GRADE_ADJUSTMENT[investmentGrade];
  const effectiveBaseMargin = Math.max(0.10, baseMargin + gradeAdj);

  // Base offer before risk discounts
  const baseOffer = Math.round(avm * (1 - effectiveBaseMargin));

  // Build discount lines (applied to AVM, not base offer)
  const discountLines: DiscountLine[] = [];

  // Environmental discounts
  const env = riskScore.environmental;
  if (env.radon.discountFraction > 0)
    discountLines.push({ label: 'Radon risk', fraction: env.radon.discountFraction });
  if (env.coalMining.discountFraction > 0)
    discountLines.push({ label: 'Coal mining subsidence', fraction: env.coalMining.discountFraction });
  if (env.knotweed.discountFraction > 0)
    discountLines.push({ label: 'Japanese Knotweed proximity', fraction: env.knotweed.discountFraction });
  if (env.flood.discountFraction > 0)
    discountLines.push({ label: `Flood risk (${env.flood.detail.split('—')[0]?.trim() ?? 'EA zone'})`, fraction: env.flood.discountFraction });
  if (env.noise.discountFraction > 0)
    discountLines.push({ label: 'Noise exposure', fraction: env.noise.discountFraction });

  // Construction discount
  const building = riskScore.building;
  if (building.constructionDiscount > 0)
    discountLines.push({
      label: `Non-standard construction (${building.constructionType})`,
      fraction: building.constructionDiscount,
    });

  // EPC penalty (only negative adjustments are discounts)
  if (building.epcAdjustment < 0)
    discountLines.push({
      label: `EPC band ${building.epcBand ?? 'unknown'} energy penalty`,
      fraction: -building.epcAdjustment,
    });

  // Age penalty
  if (building.ageAdjustment < 0)
    discountLines.push({
      label: `Build era (${building.buildEra ?? 'unknown'}) condition risk`,
      fraction: -building.ageAdjustment,
    });

  // Lease discount
  const leaseFraction = leaseDiscount(remainingLeaseYears);
  if (leaseFraction > 0)
    discountLines.push({
      label: `Short lease (${remainingLeaseYears ?? '?'} years remaining)`,
      fraction: leaseFraction,
    });

  // Total discount fraction (capped at 40%)
  const rawTotalDiscount = discountLines.reduce((s, d) => s + d.fraction, 0);
  const discountCapped = rawTotalDiscount > 0.40;
  const totalDiscountFraction = Math.min(rawTotalDiscount, 0.40);

  // Final offer = base offer minus additional risk discounts (applied to AVM)
  const additionalDiscount = Math.round(avm * totalDiscountFraction);
  const rawFinalOffer = baseOffer - additionalDiscount;

  // Floor / ceiling
  const floor = Math.round(avm * 0.60);
  const ceiling = Math.round(avm * 0.88);
  const finalOffer = Math.max(floor, Math.min(ceiling, rawFinalOffer));
  const requiresCeoEscalation = rawFinalOffer < floor;

  // Low / high range based on confidence interval
  const offerLow = Math.round(finalOffer * (1 - ci));
  const offerHigh = Math.round(finalOffer * (1 + ci));

  const justification = buildJustification(
    sellerType,
    baseMargin,
    investmentGrade,
    gradeAdj,
    discountLines,
    totalDiscountFraction,
    requiresCeoEscalation
  );

  return {
    avmPointEstimate: avm,
    baseAcquisitionMargin: effectiveBaseMargin,
    baseOffer,
    discountLines,
    totalDiscountFraction,
    finalOffer,
    offerLow,
    offerHigh,
    requiresCeoEscalation,
    discountCapped,
    validUntil: validUntilDate(),
    justification,
    investmentGrade,
    sellerType,
  };
}

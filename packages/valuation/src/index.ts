/**
 * @repo/valuation — AVM orchestrator
 *
 * runAVM() is the single entry point. It:
 *   1. Fetches base valuation (HMLR comps + HPI + EPC) via base-valuation
 *   2. Scores environmental + building risk via risk-scoring
 *   3. Projects 36-month market trend via trend-projection
 *   4. Calculates the risk-adjusted offer via offer-calculation
 *   5. Returns an AvmResultPayload matching the Prisma AvmResult schema
 *
 * The resultJson field contains the full structured output for storage
 * and downstream consumption by Liaison, Counsel, and the board.
 *
 * BELA-12 spec compliance:
 *   - 24-hour turnaround target
 *   - Median error target ≤3.1%
 *   - All 5 environmental factors assessed
 *   - Pre-RICS flags surfaced before survey instruction
 *   - CEO escalation when offer < 60% of AVM
 */

import 'server-only';

import { getBaseValuation, type BaseValuationInput, type PropertyType } from './base-valuation.js';
import { scoreRisk, type RiskScoringInput, type RadonCategory, type CoalMiningZone, type KnotweedProximity, type FloodZone, type NoiseBand, type ConstructionType } from './risk-scoring.js';
import { calculateOffer, type SellerType, type InvestmentGrade, type OfferResult } from './offer-calculation.js';
import { projectTrend, type TrendProjection } from './trend-projection.js';

// ---------------------------------------------------------------------------
// Re-exports for consumers
// ---------------------------------------------------------------------------

export type { PropertyType, BaseValuation, ComparableSale, ConfidenceLevel } from './base-valuation.js';
export type {
  RadonCategory, CoalMiningZone, KnotweedProximity, FloodZone, NoiseBand,
  ConstructionType, RiskScore, EnvironmentalScores, BuildingCharacteristics,
  FactorScore,
} from './risk-scoring.js';
export type { SellerType, InvestmentGrade, OfferResult, DiscountLine } from './offer-calculation.js';
export type { TrendProjection, TrendForecastPoint } from './trend-projection.js';

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

export interface AvmInput {
  // Property
  postcode: string;
  propertyType: PropertyType;
  address?: string;
  floorAreaSqm?: number;
  bedrooms?: number;

  // Deal context
  sellerType: SellerType;
  dealId?: string;

  // Environmental data (caller provides from external API lookups)
  radonCategory?: RadonCategory;
  coalMiningZone?: CoalMiningZone;
  knotweedProximity?: KnotweedProximity;
  floodZone?: FloodZone;
  noiseBand?: NoiseBand;

  // Building
  constructionType?: ConstructionType;

  // Optional enrichment
  remainingLeaseYears?: number;
  grossRentalYield?: number;
  investmentGrade?: InvestmentGrade;
}

// ---------------------------------------------------------------------------
// Output type — matches Prisma AvmResult schema
// ---------------------------------------------------------------------------

/** Shape stored in AvmResult.resultJson */
export interface AvmResultJson {
  // Property identity
  address?: string;
  postcode: string;
  propertyType: PropertyType;
  floorAreaSqm: number | null;
  bedrooms?: number;
  epcRating: string | null;
  buildEra: string | null;
  constructionType: ConstructionType;

  // AVM estimate
  avmPointEstimate: number;
  avmLow: number;
  avmHigh: number;
  confidenceLevel: string;
  comparableCount: number;
  avmSources: string;

  // Environmental risk
  environmentalBand: string;
  envScoreTotal: number;
  radonScore: number;
  radonDiscount: number;
  coalMiningScore: number;
  coalMiningDiscount: number;
  knotweedScore: number;
  knotweedDiscount: number;
  floodScore: number;
  floodDiscount: number;
  noiseScore: number;
  noiseDiscount: number;
  totalEnvDiscount: number;

  // Building characteristics
  epcAdjustment: number;
  constructionDiscount: number;
  ageAdjustment: number;
  nonStandardFlag: boolean;

  // Offer
  sellerType: SellerType;
  investmentGrade: InvestmentGrade;
  baseAcquisitionMargin: number;
  baseOffer: number;
  discountLines: OfferResult['discountLines'];
  totalDiscountFraction: number;
  finalOffer: number;
  offerLow: number;
  offerHigh: number;
  requiresCeoEscalation: boolean;
  discountCapped: boolean;
  validUntil: string;
  justification: string;

  // Trend projection
  trendAnnualGrowthRate: number;
  trendNarrative: string;
  forecast12mValue: number;
  forecast24mValue: number;
  forecast36mValue: number;
  forecast36mLow: number;
  forecast36mHigh: number;

  // Pre-RICS flags
  preRicsFlags: string[];

  // Meta
  runAt: string;
}

/** Top-level return value — matches fields needed to create a Prisma AvmResult row */
export interface AvmResultPayload {
  /** Undefined until persisted; set by caller after DB insert */
  id?: string;
  dealId?: string;
  postcode: string;
  propertyType: PropertyType;
  /** Composite 0-100 risk score stored in AvmResult.riskScore */
  riskScore: number;
  /** Full structured result stored in AvmResult.resultJson */
  resultJson: AvmResultJson;
  /** Offer valid for 14 days */
  expiresAt: Date;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function runAVM(input: AvmInput): Promise<AvmResultPayload> {
  const {
    postcode, propertyType, address, floorAreaSqm, bedrooms,
    sellerType, dealId,
    radonCategory, coalMiningZone, knotweedProximity, floodZone, noiseBand,
    constructionType,
    remainingLeaseYears, grossRentalYield, investmentGrade,
  } = input;

  // Step 1: Base valuation
  const baseValuationInput: BaseValuationInput = {
    postcode, propertyType, floorAreaSqm, bedrooms, address,
  };
  const baseValuation = await getBaseValuation(baseValuationInput);

  // Step 2: Risk scoring
  const riskInput: RiskScoringInput = {
    postcode,
    epc: baseValuation.epc,
    radonCategory,
    coalMiningZone,
    knotweedProximity,
    floodZone,
    noiseBand,
    constructionType,
  };
  const riskScore = scoreRisk(riskInput);

  // Step 3: 36-month trend projection
  const trend: TrendProjection = projectTrend(baseValuation.pointEstimate, baseValuation.hpi);

  // Step 4: Offer calculation
  const offer: OfferResult = calculateOffer({
    baseValuation,
    riskScore,
    sellerType,
    investmentGrade,
    remainingLeaseYears,
    grossRentalYield,
  });

  // Step 5: Assemble AvmResultJson
  const env = riskScore.environmental;
  const bld = riskScore.building;
  const runAt = new Date().toISOString();

  const resultJson: AvmResultJson = {
    address,
    postcode,
    propertyType,
    floorAreaSqm: baseValuation.floorAreaSqm,
    bedrooms,
    epcRating: bld.epcBand,
    buildEra: bld.buildEra,
    constructionType: bld.constructionType,

    avmPointEstimate: baseValuation.pointEstimate,
    avmLow: Math.round(baseValuation.pointEstimate * (1 - baseValuation.confidenceInterval)),
    avmHigh: Math.round(baseValuation.pointEstimate * (1 + baseValuation.confidenceInterval)),
    confidenceLevel: baseValuation.confidenceLevel,
    comparableCount: baseValuation.comparables.length,
    avmSources: baseValuation.source,

    environmentalBand: env.envBand,
    envScoreTotal: env.totalEnvScore,
    radonScore: env.radon.score,
    radonDiscount: env.radon.discountFraction,
    coalMiningScore: env.coalMining.score,
    coalMiningDiscount: env.coalMining.discountFraction,
    knotweedScore: env.knotweed.score,
    knotweedDiscount: env.knotweed.discountFraction,
    floodScore: env.flood.score,
    floodDiscount: env.flood.discountFraction,
    noiseScore: env.noise.score,
    noiseDiscount: env.noise.discountFraction,
    totalEnvDiscount: env.totalEnvDiscount,

    epcAdjustment: bld.epcAdjustment,
    constructionDiscount: bld.constructionDiscount,
    ageAdjustment: bld.ageAdjustment,
    nonStandardFlag: bld.nonStandardFlag,

    sellerType: offer.sellerType,
    investmentGrade: offer.investmentGrade,
    baseAcquisitionMargin: offer.baseAcquisitionMargin,
    baseOffer: offer.baseOffer,
    discountLines: offer.discountLines,
    totalDiscountFraction: offer.totalDiscountFraction,
    finalOffer: offer.finalOffer,
    offerLow: offer.offerLow,
    offerHigh: offer.offerHigh,
    requiresCeoEscalation: offer.requiresCeoEscalation,
    discountCapped: offer.discountCapped,
    validUntil: offer.validUntil,
    justification: offer.justification,

    trendAnnualGrowthRate: trend.annualGrowthRate,
    trendNarrative: trend.narrative,
    forecast12mValue: trend.forecast12m.pointEstimate,
    forecast24mValue: trend.forecast24m.pointEstimate,
    forecast36mValue: trend.forecast36m.pointEstimate,
    forecast36mLow: trend.forecast36m.low80,
    forecast36mHigh: trend.forecast36m.high80,

    preRicsFlags: riskScore.preRicsFlags,

    runAt,
  };

  const expiresAt = new Date(offer.validUntil + 'T23:59:59Z');

  return {
    dealId,
    postcode,
    propertyType,
    riskScore: riskScore.composite,
    resultJson,
    expiresAt,
  };
}

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

import {
  type MarketSignals,
  getSubjectMarketSignals,
} from '@repo/property-data';
import {
  type BaseValuationInput,
  type PropertyType,
  getBaseValuation,
} from './base-valuation';
import {
  type InvestmentGrade,
  type OfferResult,
  type SellerType,
  calculateOffer,
} from './offer-calculation';
import { DEFAULT_OFFER_CONFIG, type OfferConfig } from './offer-config';
import {
  type CoalMiningZone,
  type ConstructionType,
  type FloodZone,
  type KnotweedProximity,
  type NoiseBand,
  type RadonCategory,
  type RiskScoringInput,
  scoreRisk,
} from './risk-scoring';
import { type TrendProjection, projectTrend } from './trend-projection';
import { readUncertainty } from './uncertainty';

// ---------------------------------------------------------------------------
// Re-exports for consumers
// ---------------------------------------------------------------------------

export type {
  PropertyType,
  BaseValuation,
  ComparableSale,
  ConfidenceLevel,
} from './base-valuation';
export { getDistanceWeightedValuation } from './distance-comps';
export {
  buildSqftEvidence,
  triangulationWeights,
  sqmToSqft,
  SQFT_PER_SQM,
} from './sqft-comps';
export type {
  SqftEvidence,
  MatchedSqftComp,
  SqftEvidenceSource,
} from './sqft-comps';
export type {
  DistanceWeightedValuation,
  WeightedComp,
  DistanceCompInput,
} from './distance-comps';
export { generateCompRationale } from './comp-rationale-llm';
export {
  DEEP_APPRAISAL_FEATURE,
  DeepAppraisalSchema,
  formatAvmCrossCheck,
  runDeepAppraisal,
} from './deep-appraisal';
export type {
  AvmCrossCheckInput,
  DeepAppraisal,
  DeepAppraisalInput,
} from './deep-appraisal';
export type {
  RadonCategory,
  CoalMiningZone,
  KnotweedProximity,
  FloodZone,
  NoiseBand,
  ConstructionType,
  RiskScore,
  EnvironmentalScores,
  BuildingCharacteristics,
  FactorScore,
} from './risk-scoring';
export type {
  SellerType,
  InvestmentGrade,
  OfferResult,
  DiscountLine,
} from './offer-calculation';
export { DEFAULT_OFFER_CONFIG, mergeOfferConfig } from './offer-config';
export type { OfferConfig } from './offer-config';
export type { TrendProjection, TrendForecastPoint } from './trend-projection';
export {
  computeBacktest,
  computeBacktestBySegment,
} from './backtest';
export type { BacktestSample, BacktestReport } from './backtest';
export {
  buildAvmSnapshot,
  csaSourceFromLabel,
  currentEngineVersion,
  saveAvmSnapshot,
} from './backtest-snapshot';
export type {
  AvmCsaSource,
  AvmSnapshotRow,
  AvmSnapshotSource,
  AvmSnapshotWriter,
  JsonObject,
  JsonValue,
} from './backtest-snapshot';
export {
  appraiseDeal,
  maxOfferForRoi,
  computeSdltPence,
  computePurchaseLegalsPence,
  DEFAULT_DEAL_COSTS,
} from './deal-model';
export type {
  AcquisitionRoute,
  SdltBand,
  DealCostConfig,
  DealInput,
  DealCostBreakdown,
  CashScenario,
  FinancedScenario,
  DealVerdict,
  DealAppraisal,
  MaxOfferResult,
} from './deal-model';
export {
  estimateGdv,
  appraiseDealFromAvm,
  mapVisualConditionToLevel,
  CONDITION_DISCOUNTS,
  DEFAULT_CONDITION,
} from './gdv';
export type {
  ConditionLevel,
  GdvInput,
  GdvEstimate,
  DealFromAvmInput,
  DealFromAvmResult,
} from './gdv';
export {
  estimateRefurb,
  CONDITION_COST_PER_SQM,
  FLAG_COST,
  DEFAULT_FLOOR_AREA_SQM,
} from './refurb';
export type {
  RefurbInput,
  RefurbLine,
  RefurbEstimate,
  RefurbConfig,
} from './refurb';
export {
  DEFAULT_VALUATION_CONFIG,
  mergeValuationConfig,
} from './valuation-config';
export type { ValuationConfig } from './valuation-config';
export {
  MATERIAL_SHARE_DELTA,
  MATERIAL_SHIFT_RATIO,
  MIN_TREND_SAMPLES,
  compareMedianShift,
  compareShareShift,
  median,
  readUncertainty,
} from './uncertainty';
export type {
  MedianShift,
  ShareShift,
  UncertaintyReading,
} from './uncertainty';

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

  /** Founder-tunable offer policy (margins, guard rails). Defaults built-in. */
  offerConfig?: OfferConfig;
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
  /** Where floorAreaSqm came from — null means we have no verified size. */
  floorAreaSource: 'caller' | 'propertydata' | null;
  /** Address the floor area was matched to (carries the house number). */
  resolvedAddress: string | null;
  /** floorAreaSqm in square feet — the unit the founder reads. */
  floorAreaSqft: number | null;
  /** Point estimate ÷ floor area, £/sqft. Null without a verified size. */
  pricePerSqft: number | null;
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
  /**
   * Size economics: our estimate's implied £/m², the area's median £ per
   * SQUARE FOOT (PropertyData /prices-per-sqf), the value that benchmark
   * implies for the verified size, and whether that size anchor actually
   * joined the triangulation (verified size + benchmark + deviation guard).
   */
  pricePerSqm: number | null;
  /**
   * Uncertainty discipline (Zillow lesson): (avmHigh − avmLow) ÷ point
   * estimate. Recorded on every run so portfolio-level widening is trendable.
   */
  intervalWidthRatio: number | null;
  /** The configured throttle bound this run was judged against. */
  uncertaintyMaxWidthRatio: number;
  /**
   * Interval wider than the bound — a person must re-check the comparables
   * before any offer, regardless of score. Surfaced, never enforced.
   */
  secondCheckRequired: boolean;
  /** The actual sold comps that drove the estimate (address/price/date/dist). */
  comparables: {
    address: string | null;
    postcode: string | null;
    soldPricePence: number;
    adjustedPricePence: number;
    date: string;
    monthsAgo: number;
    distanceMiles: number | null;
    /** EPC floor area of the comp (m²) when a register row matched. */
    floorAreaSqm: number | null;
    /** Time-adjusted £/sqft of the comp when its size is known. */
    pricePerSqft: number | null;
  }[];
  avmSources: string;
  /**
   * The size pillar — nearby sold £/sqft (comps matched to EPC floor areas)
   * and the estimate it gives for this house. Null when the lookup was
   * skipped; present-but-thin (matchedCount 0) when nothing matched.
   */
  sqftEvidence: {
    poundsPerSqft: number | null;
    nearMedianPerSqft: number | null;
    farMedianPerSqft: number | null;
    matchedCount: number;
    benchmarkPerSqft: number | null;
    /** Rate × subject sqft, in POUNDS. */
    sqftEstimate: number | null;
    source: 'matched_comps' | 'area_benchmark' | null;
    /** Subject size vs the median matched comp, as a fraction (+0.25). */
    sizeVsCompsPct: number | null;
    /** Weight the size estimate carried in the triangulation (0–1). */
    weight: number;
  } | null;

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

  /**
   * The subject listing's live body language — days on market, price cuts,
   * distress-list membership — plus nearby distress-flagged listings. Null
   * when PropertyData was unreachable (a different fact from "no signals",
   * which is a result with distressListed=false). Surfaced only; never
   * feeds scoring or the offer.
   */
  marketSignals: MarketSignals | null;

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
    postcode,
    propertyType,
    address,
    floorAreaSqm,
    bedrooms,
    sellerType,
    dealId,
    radonCategory,
    coalMiningZone,
    knotweedProximity,
    floodZone,
    noiseBand,
    constructionType,
    remainingLeaseYears,
    grossRentalYield,
    investmentGrade,
    offerConfig = DEFAULT_OFFER_CONFIG,
  } = input;

  // Step 1: Base valuation + market signals, fetched concurrently. Signals
  // are display-context (the listing's own body language) — a dark
  // PropertyData call records null rather than failing the valuation.
  const baseValuationInput: BaseValuationInput = {
    postcode,
    propertyType,
    floorAreaSqm,
    bedrooms,
    address,
  };
  const [baseValuation, marketSignals] = await Promise.all([
    getBaseValuation(baseValuationInput),
    getSubjectMarketSignals({ postcode, address }).catch((err) => {
      console.warn(`[runAVM] market signals unavailable for ${postcode}`, err);
      return null;
    }),
  ]);

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
  const trend: TrendProjection = projectTrend(
    baseValuation.pointEstimate,
    baseValuation.hpi
  );

  // Step 4: Offer calculation
  const offer: OfferResult = calculateOffer(
    {
      baseValuation,
      riskScore,
      sellerType,
      investmentGrade,
      remainingLeaseYears,
      grossRentalYield,
    },
    offerConfig
  );

  // Step 5: Assemble AvmResultJson
  const env = riskScore.environmental;
  const bld = riskScore.building;
  const runAt = new Date().toISOString();

  const avmLow = Math.round(
    baseValuation.pointEstimate * (1 - baseValuation.confidenceInterval)
  );
  const avmHigh = Math.round(
    baseValuation.pointEstimate * (1 + baseValuation.confidenceInterval)
  );
  const uncertainty = readUncertainty({
    pointEstimate: baseValuation.pointEstimate,
    low: avmLow,
    high: avmHigh,
    comparableCount: baseValuation.comparables.length,
    maxWidthRatio: offerConfig.maxIntervalWidthRatio,
  });

  const resultJson: AvmResultJson = {
    address,
    postcode,
    propertyType,
    floorAreaSqm: baseValuation.floorAreaSqm,
    floorAreaSource: baseValuation.floorAreaSource,
    resolvedAddress: baseValuation.resolvedAddress,
    floorAreaSqft: baseValuation.floorAreaSqft,
    pricePerSqft: baseValuation.pricePerSqft,
    bedrooms,
    epcRating: bld.epcBand,
    buildEra: bld.buildEra,
    constructionType: bld.constructionType,

    avmPointEstimate: baseValuation.pointEstimate,
    avmLow,
    avmHigh,
    confidenceLevel: baseValuation.confidenceLevel,
    comparableCount: baseValuation.comparables.length,
    pricePerSqm: baseValuation.pricePerSqm,
    intervalWidthRatio: uncertainty.intervalWidthRatio,
    uncertaintyMaxWidthRatio: uncertainty.maxWidthRatio,
    secondCheckRequired: uncertainty.secondCheckRequired,
    comparables: baseValuation.comparables.map((c) => ({
      address: c.address,
      postcode: c.postcode,
      soldPricePence: Math.round(c.price * 100),
      adjustedPricePence: Math.round(c.adjustedPrice * 100),
      date: c.date,
      monthsAgo: c.monthsAgo,
      distanceMiles: c.distanceMiles,
      floorAreaSqm: c.floorAreaSqm,
      pricePerSqft: c.pricePerSqft,
    })),
    avmSources: baseValuation.source,
    sqftEvidence: baseValuation.sqft
      ? {
          poundsPerSqft: baseValuation.sqft.poundsPerSqft,
          nearMedianPerSqft: baseValuation.sqft.nearMedianPerSqft,
          farMedianPerSqft: baseValuation.sqft.farMedianPerSqft,
          matchedCount: baseValuation.sqft.matchedCount,
          benchmarkPerSqft: baseValuation.sqft.benchmarkPerSqft,
          sqftEstimate: baseValuation.sqft.sqftEstimate,
          source: baseValuation.sqft.source,
          sizeVsCompsPct: baseValuation.sqft.sizeVsCompsPct,
          weight: baseValuation.sqftWeight,
        }
      : null,

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

    marketSignals,

    runAt,
  };

  const expiresAt = new Date(`${offer.validUntil}T23:59:59Z`);

  return {
    dealId,
    postcode,
    propertyType,
    riskScore: riskScore.composite,
    resultJson,
    expiresAt,
  };
}

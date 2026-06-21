/**
 * Base Valuation Module — Land Registry comparable analysis
 *
 * Implements Step 1-4 of the AVM Triangulation Engine (BELA-12 spec):
 *   1. Hedonic regression base value from EPC + postcode characteristics
 *   2. Comparable sales adjustment (CSA) from HMLR Price Paid Data
 *   3. HPI trend adjustment for time-stale comps
 *   4. Weighted triangulation → point estimate + confidence interval
 *
 * Source weights: HMLR-CSA 40%, Hedonic 40%, External cross-check 20%
 * (External AVM cross-check is provided by caller if available.)
 */

import 'server-only';

import {
  getPricePaid,
  getHousepriceIndex,
  getEpcData,
  getPropertyDataValuation,
  type PpdTransaction,
  type Epc,
  type Hpi,
} from '@repo/property-data';
import {
  getDistanceWeightedValuation,
  type DistanceWeightedValuation,
} from './distance-comps';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PropertyType = 'detached' | 'semi-detached' | 'terraced' | 'flat';

export interface BaseValuationInput {
  postcode: string;
  propertyType: PropertyType;
  floorAreaSqm?: number;
  bedrooms?: number;
  address?: string;
}

export interface ComparableSale {
  price: number;
  date: string;
  propertyType: string;
  adjustedPrice: number;
  monthsAgo: number;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface BaseValuation {
  postcode: string;
  propertyType: PropertyType;
  pointEstimate: number;
  /** Confidence interval half-width as a fraction (e.g. 0.03 = ±3%) */
  confidenceInterval: number;
  confidenceLevel: ConfidenceLevel;
  hedonicValue: number;
  csaValue: number;
  /** Raw HMLR comps used */
  comparables: ComparableSale[];
  hpi: Hpi;
  epc: Epc;
  floorAreaSqm: number | null;
  pricePerSqm: number | null;
  source: string;
  /** Present when the distance-weighted PropertyData path produced the CSA. */
  distanceWeighted?: DistanceWeightedValuation | null;
}

// ---------------------------------------------------------------------------
// Property type normalisation
// ---------------------------------------------------------------------------

const PPDTYPE_MAP: Record<string, PropertyType> = {
  D: 'detached',
  S: 'semi-detached',
  T: 'terraced',
  F: 'flat',
  Detached: 'detached',
  'Semi-detached': 'semi-detached',
  Terraced: 'terraced',
  Flat: 'flat',
  'Semi-Detached house': 'semi-detached',
  'Detached house': 'detached',
  'Terraced house': 'terraced',
};

function normaliseType(raw: string): PropertyType {
  return PPDTYPE_MAP[raw] ?? PPDTYPE_MAP[raw.charAt(0).toUpperCase()] ?? 'terraced';
}

// ---------------------------------------------------------------------------
// Hedonic adjustments — built-era and bedroom count relative value
// ---------------------------------------------------------------------------

const BEDROOM_PREMIUM: Record<number, number> = {
  1: -0.20,
  2: -0.05,
  3: 0.00,
  4: 0.12,
  5: 0.22,
};

function bedroomPremium(bedrooms: number): number {
  return BEDROOM_PREMIUM[Math.max(1, Math.min(bedrooms, 5))] ?? 0;
}

// ---------------------------------------------------------------------------
// Time adjustment — +0.4% per month for HPI drift
// ---------------------------------------------------------------------------

const MONTHLY_APPRECIATION_RATE = 0.004;

function monthsAgo(dateStr: string): number {
  const sold = new Date(dateStr).getTime();
  return Math.max(0, Math.round((Date.now() - sold) / (30 * 86_400_000)));
}

function timeAdjust(price: number, months: number): number {
  return Math.round(price * (1 + MONTHLY_APPRECIATION_RATE * months));
}

// ---------------------------------------------------------------------------
// Comp filtering — same type within 18 months (36 max), outlier removal
// ---------------------------------------------------------------------------

function filterComps(
  transactions: PpdTransaction[],
  targetType: PropertyType,
  floorAreaSqm?: number
): Array<PpdTransaction & { adjustedPrice: number; monthsAgo: number }> {
  const MAX_MONTHS = 36;
  const MAX_COMPS = 12;

  const typed = transactions.filter((t) => {
    const mapped = normaliseType(t.propertyType);
    return mapped === targetType;
  });

  const recent = typed
    .map((t) => ({
      ...t,
      monthsAgo: monthsAgo(t.date),
    }))
    .filter((t) => t.monthsAgo <= MAX_MONTHS)
    .sort((a, b) => a.monthsAgo - b.monthsAgo);

  const adjusted = recent.map((t) => ({
    ...t,
    adjustedPrice: timeAdjust(t.price, t.monthsAgo),
  }));

  if (adjusted.length < 2) return adjusted.slice(0, MAX_COMPS);

  // Remove outliers beyond 2σ
  const prices = adjusted.map((t) => t.adjustedPrice);
  const mean = prices.reduce((s, p) => s + p, 0) / prices.length;
  const variance = prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length;
  const sd = Math.sqrt(variance);
  const cleaned = adjusted.filter(
    (t) => Math.abs(t.adjustedPrice - mean) <= 2 * sd
  );

  return cleaned.slice(0, MAX_COMPS);
}

// ---------------------------------------------------------------------------
// Confidence interval — based on spread between hedonic and CSA
// ---------------------------------------------------------------------------

function calcConfidence(
  hedonicVal: number,
  csaVal: number
): { level: ConfidenceLevel; interval: number } {
  if (hedonicVal === 0 || csaVal === 0)
    return { level: 'low', interval: 0.08 };

  const spread = Math.abs(hedonicVal - csaVal) / ((hedonicVal + csaVal) / 2);

  if (spread < 0.05) return { level: 'high', interval: 0.03 };
  if (spread < 0.10) return { level: 'medium', interval: 0.05 };
  return { level: 'low', interval: 0.08 };
}

// ---------------------------------------------------------------------------
// Core hedonic model — size + bedroom count relative to avg area price
// ---------------------------------------------------------------------------

function hedonicEstimate(
  avgComparablePrice: number,
  floorAreaSqm: number | null | undefined,
  bedrooms: number | null | undefined,
  epcFloorArea: number | null
): number {
  let estimate = avgComparablePrice;

  // Apply bedroom premium if we have bedrooms and no floor area
  if (bedrooms && !floorAreaSqm && !epcFloorArea) {
    estimate = estimate * (1 + bedroomPremium(bedrooms));
  }

  return Math.round(estimate);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getBaseValuation(
  input: BaseValuationInput
): Promise<BaseValuation> {
  const { postcode, propertyType, floorAreaSqm, bedrooms, address } = input;

  const [pricePaid, hpi, epc, externalAvm, distanceWeighted] = await Promise.all([
    getPricePaid(postcode, 20),
    getHousepriceIndex(postcode),
    getEpcData(postcode, address),
    // PropertyData's £/sqft-driven AVM. Returns null silently if no key
    // is configured or the call fails — the rest of the engine carries on.
    // Cached 7 days per postcode+type+bedrooms so we burn ~3 credits per
    // unique property per week.
    getPropertyDataValuation({
      postcode,
      propertyType,
      bedrooms: bedrooms ?? undefined,
      internalArea: floorAreaSqm ?? undefined,
    }),
    // Distance-weighted sold comps (last 12mo, 0.25mi=60% / 0.5mi=40%).
    // Returns null when the subject can't be geolocated or there are no
    // comps — we then fall back to the Land-Registry exact-postcode path.
    getDistanceWeightedValuation({
      postcode,
      propertyType,
      bedrooms: bedrooms ?? undefined,
      maxAgeMonths: 12,
    }),
  ]);

  const hmlrComps = filterComps(pricePaid.transactions, propertyType, floorAreaSqm);

  const effectiveFloorArea = floorAreaSqm ?? epc.floorAreaSqm;
  const effectiveBedrooms = bedrooms ?? epc.totalBedrooms ?? undefined;

  // CSA value — comparable sales adjusted value. Priority:
  //   1. Distance-weighted PropertyData comps (the real radius — best)
  //   2. Land Registry exact-postcode comps (median of adjusted)
  //   3. Area-average fallback with a type discount (deterministic, low conf.)
  let csaValue: number;
  let comparables: ComparableSale[];
  let csaSource: 'distance' | 'hmlr' | 'fallback';

  if (distanceWeighted) {
    csaValue = Math.round(distanceWeighted.estimatePence / 100);
    comparables = distanceWeighted.comps.map((c) => ({
      price: Math.round(c.pricePence / 100),
      date: c.date,
      propertyType,
      adjustedPrice: Math.round(c.adjustedPricePence / 100),
      monthsAgo: c.monthsAgo,
    }));
    csaSource = 'distance';
  } else if (hmlrComps.length > 0) {
    const sorted = [...hmlrComps].sort((a, b) => a.adjustedPrice - b.adjustedPrice);
    const mid = Math.floor(sorted.length / 2);
    csaValue =
      sorted.length % 2 === 0
        ? Math.round(((sorted[mid - 1]?.adjustedPrice ?? 0) + (sorted[mid]?.adjustedPrice ?? 0)) / 2)
        : (sorted[mid]?.adjustedPrice ?? 0);
    comparables = hmlrComps.map((c) => ({
      price: c.price,
      date: c.date,
      propertyType: c.propertyType,
      adjustedPrice: c.adjustedPrice,
      monthsAgo: c.monthsAgo,
    }));
    csaSource = 'hmlr';
  } else {
    // No same-type comps anywhere: use overall avg with type discount.
    const fallback = pricePaid.avgPrice ?? 250_000;
    const typeDiscount: Record<PropertyType, number> = {
      detached: 1.35,
      'semi-detached': 1.0,
      terraced: 0.85,
      flat: 0.72,
    };
    csaValue = Math.round(fallback * (typeDiscount[propertyType] ?? 1.0));
    comparables = [];
    csaSource = 'fallback';
  }

  // Hedonic estimate — anchored to CSA, adjusted for size/bedrooms
  const hedonicValue = hedonicEstimate(csaValue, effectiveFloorArea, effectiveBedrooms, epc.floorAreaSqm);

  // HPI trend nudge: apply half the annual change as a sentiment adjustment
  const hpiNudge = 1 + (hpi.annualChange / 100) * 0.15;
  const hpiAdjustedHedonic = Math.round(hedonicValue * hpiNudge);

  // Weighted triangulation.
  //   Distance CSA present:  CSA 60%, Hedonic 25%, External 15% (or 70/30)
  //   HMLR CSA, with ext:    CSA 40%, Hedonic 40%, External 20%
  //   HMLR CSA, no ext:      CSA 50%, Hedonic 50%
  let pointEstimate: number;
  if (csaSource === 'distance') {
    pointEstimate = externalAvm
      ? Math.round(csaValue * 0.6 + hpiAdjustedHedonic * 0.25 + externalAvm.estimate * 0.15)
      : Math.round(csaValue * 0.7 + hpiAdjustedHedonic * 0.3);
  } else {
    pointEstimate = externalAvm
      ? Math.round(csaValue * 0.4 + hpiAdjustedHedonic * 0.4 + externalAvm.estimate * 0.2)
      : Math.round(csaValue * 0.5 + hpiAdjustedHedonic * 0.5);
  }

  // Confidence. Distance comps carry their own confidence; a synthetic /
  // fallback valuation is never presented as better than low confidence.
  const DISTANCE_INTERVAL: Record<DistanceWeightedValuation['confidence'], number> = {
    high: 0.03,
    medium: 0.05,
    low: 0.08,
  };
  let confidenceLevel: ConfidenceLevel;
  let confidenceInterval: number;
  if (csaSource === 'distance' && distanceWeighted) {
    confidenceLevel = distanceWeighted.confidence;
    confidenceInterval = DISTANCE_INTERVAL[distanceWeighted.confidence];
  } else if (pricePaid.source === 'synthetic' || csaSource === 'fallback') {
    confidenceLevel = 'low';
    confidenceInterval = 0.08;
  } else {
    const c = calcConfidence(hpiAdjustedHedonic, csaValue);
    confidenceLevel = c.level;
    confidenceInterval = c.interval;
  }

  const pricePerSqm =
    effectiveFloorArea && effectiveFloorArea > 0
      ? Math.round(pointEstimate / effectiveFloorArea)
      : null;

  const source =
    csaSource === 'distance' && distanceWeighted
      ? `propertydata_sold_distance(${distanceWeighted.nearCount}@0.25mi/${distanceWeighted.farCount}@0.5mi)+hmlr_hpi+epc`
      : pricePaid.source === 'synthetic'
        ? 'synthetic'
        : 'hmlr_ppd+hmlr_hpi+epc';

  return {
    postcode,
    propertyType,
    pointEstimate,
    confidenceInterval,
    confidenceLevel,
    hedonicValue: hpiAdjustedHedonic,
    csaValue,
    comparables,
    hpi,
    epc,
    floorAreaSqm: effectiveFloorArea ?? null,
    pricePerSqm,
    source,
    distanceWeighted: distanceWeighted ?? null,
  };
}

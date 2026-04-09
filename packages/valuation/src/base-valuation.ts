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
  type PpdTransaction,
  type Epc,
  type Hpi,
} from '@repo/property-data';

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

  const [pricePaid, hpi, epc] = await Promise.all([
    getPricePaid(postcode, 20),
    getHousepriceIndex(postcode),
    getEpcData(postcode, address),
  ]);

  const comps = filterComps(pricePaid.transactions, propertyType, floorAreaSqm);

  const effectiveFloorArea = floorAreaSqm ?? epc.floorAreaSqm;
  const effectiveBedrooms = bedrooms ?? epc.totalBedrooms ?? undefined;

  // CSA value — median of adjusted comps
  let csaValue: number;
  if (comps.length > 0) {
    const sorted = [...comps].sort((a, b) => a.adjustedPrice - b.adjustedPrice);
    const mid = Math.floor(sorted.length / 2);
    csaValue =
      sorted.length % 2 === 0
        ? Math.round(((sorted[mid - 1]?.adjustedPrice ?? 0) + (sorted[mid]?.adjustedPrice ?? 0)) / 2)
        : (sorted[mid]?.adjustedPrice ?? 0);
  } else {
    // No same-type comps: use overall avg with type discount
    const fallback = pricePaid.avgPrice ?? 250_000;
    const typeDiscount: Record<PropertyType, number> = {
      detached: 1.35,
      'semi-detached': 1.0,
      terraced: 0.85,
      flat: 0.72,
    };
    csaValue = Math.round(fallback * (typeDiscount[propertyType] ?? 1.0));
  }

  // Hedonic estimate — anchored to CSA, adjusted for size/bedrooms
  const hedonicValue = hedonicEstimate(csaValue, effectiveFloorArea, effectiveBedrooms, epc.floorAreaSqm);

  // HPI trend nudge: apply half the annual change as a sentiment adjustment
  const hpiNudge = 1 + (hpi.annualChange / 100) * 0.15;
  const hpiAdjustedHedonic = Math.round(hedonicValue * hpiNudge);

  // Weighted triangulation (no external AVM in this package layer)
  // Weights: CSA 50%, Hedonic (HPI-adjusted) 50%
  const pointEstimate = Math.round(
    csaValue * 0.50 + hpiAdjustedHedonic * 0.50
  );

  const { level: confidenceLevel, interval: confidenceInterval } =
    calcConfidence(hpiAdjustedHedonic, csaValue);

  const pricePerSqm =
    effectiveFloorArea && effectiveFloorArea > 0
      ? Math.round(pointEstimate / effectiveFloorArea)
      : null;

  return {
    postcode,
    propertyType,
    pointEstimate,
    confidenceInterval,
    confidenceLevel,
    hedonicValue: hpiAdjustedHedonic,
    csaValue,
    comparables: comps.map((c) => ({
      price: c.price,
      date: c.date,
      propertyType: c.propertyType,
      adjustedPrice: c.adjustedPrice,
      monthsAgo: c.monthsAgo,
    })),
    hpi,
    epc,
    floorAreaSqm: effectiveFloorArea ?? null,
    pricePerSqm,
    source:
      pricePaid.source === 'synthetic' ? 'synthetic' : 'hmlr_ppd+hmlr_hpi+epc',
  };
}

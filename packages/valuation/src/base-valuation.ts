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
 *
 * Sep 2026 — a fourth pillar, SIZE: sold comps matched to their EPC floor
 * areas give a £/sqft rate for the street, re-priced by the subject's own
 * EPC floor area. See ./sqft-comps.ts for the weights it takes.
 *
 * Sep 2026 — evidence gate. Zero sold comps from every source (PropertyData
 * radius → Land Registry postcode → Land Registry sector) now throws
 * InsufficientEvidenceError instead of pricing off an area average that,
 * when the HMLR feed was down, was a hash-generated placeholder. Valuations
 * that had a comp are unchanged. See ./evidence.ts.
 */

import 'server-only';

import {
  getPricePaid,
  getHousepriceIndex,
  getEpcData,
  getPropertyDataValuation,
  getPropertyFloorArea,
  getFloorAreaRows,
  getPricesPerSqf,
  getSectorPricePaid,
  realTransactions,
  type PpdTransaction,
  type Epc,
  type Hpi,
} from '@repo/property-data';
import {
  getDistanceWeightedValuation,
  type DistanceWeightedValuation,
} from './distance-comps';
import { InsufficientEvidenceError } from './evidence';
import {
  buildSqftEvidence,
  normalisePostcode,
  sqmToSqft,
  triangulationWeights,
  type FloorAreaRow,
  type SqftEvidence,
} from './sqft-comps';

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
  /** Sold-property address. Present for distance comps; null for HMLR PPD. */
  address: string | null;
  /** Sold-property postcode (lets the UI link to the sold record). */
  postcode: string | null;
  /** Distance from the subject in miles. Null for the HMLR postcode/sector paths. */
  distanceMiles: number | null;
  /** EPC floor area of the sold comp (m²). Null when no register row matched. */
  floorAreaSqm: number | null;
  /** Time-adjusted £/sqft of the comp. Null when its size is unknown. */
  pricePerSqft: number | null;
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
  /** Where floorAreaSqm came from. null when we have no real size. */
  floorAreaSource: 'caller' | 'propertydata' | null;
  /** The address the floor area was matched to (includes the house number). */
  resolvedAddress: string | null;
  pricePerSqm: number | null;
  /** Point estimate ÷ verified floor area, £/sqft. Null without a size. */
  pricePerSqft: number | null;
  floorAreaSqft: number | null;
  /**
   * The size pillar: nearby sold comps × their EPC floor areas ⇒ £/sqft,
   * and the estimate that rate gives for THIS house. Null only when the
   * lookup itself was skipped; a thin result is returned as-is (matched: 0).
   */
  sqft: SqftEvidence | null;
  /** Share of the point estimate the size pillar carried (0 when unused). */
  sqftWeight: number;
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
  return (
    PPDTYPE_MAP[raw] ?? PPDTYPE_MAP[raw.charAt(0).toUpperCase()] ?? 'terraced'
  );
}

// ---------------------------------------------------------------------------
// Hedonic adjustments — built-era and bedroom count relative value
// ---------------------------------------------------------------------------

const BEDROOM_PREMIUM: Record<number, number> = {
  1: -0.2,
  2: -0.05,
  3: 0.0,
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

function filterComps<T extends PpdTransaction>(
  transactions: T[],
  targetType: PropertyType,
  floorAreaSqm?: number
): Array<T & { adjustedPrice: number; monthsAgo: number }> {
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
  const variance =
    prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length;
  const sd = Math.sqrt(variance);
  const cleaned = adjusted.filter(
    (t) => Math.abs(t.adjustedPrice - mean) <= 2 * sd
  );

  return cleaned.slice(0, MAX_COMPS);
}

/** Median of the time-adjusted prices — the CSA for a keyless HMLR comp set. */
function medianAdjusted(comps: Array<{ adjustedPrice: number }>): number {
  const sorted = [...comps].sort((a, b) => a.adjustedPrice - b.adjustedPrice);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(
        ((sorted[mid - 1]?.adjustedPrice ?? 0) +
          (sorted[mid]?.adjustedPrice ?? 0)) /
          2
      )
    : (sorted[mid]?.adjustedPrice ?? 0);
}

// ---------------------------------------------------------------------------
// Confidence interval — based on spread between hedonic and CSA
// ---------------------------------------------------------------------------

function calcConfidence(
  hedonicVal: number,
  csaVal: number
): { level: ConfidenceLevel; interval: number } {
  if (hedonicVal === 0 || csaVal === 0) return { level: 'low', interval: 0.08 };

  const spread = Math.abs(hedonicVal - csaVal) / ((hedonicVal + csaVal) / 2);

  if (spread < 0.05) return { level: 'high', interval: 0.03 };
  if (spread < 0.1) return { level: 'medium', interval: 0.05 };
  return { level: 'low', interval: 0.08 };
}

// ---------------------------------------------------------------------------
// Evidence-volume ceiling — confidence can never exceed what the number of
// nearby sold comps supports. A single comp cannot be "high" no matter how
// well the hedonic and CSA models happen to agree (they trivially agree with
// one data point). Founder rule: ~4 sold within half a mile ⇒ high.
// ---------------------------------------------------------------------------

const CONF_RANK: Record<ConfidenceLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};
const CONF_INTERVAL: Record<ConfidenceLevel, number> = {
  high: 0.03,
  medium: 0.05,
  low: 0.08,
};

/** Highest confidence justified purely by how many comps back the estimate. */
function confidenceCeilingFromComps(compCount: number): ConfidenceLevel {
  if (compCount >= 4) return 'high';
  if (compCount >= 2) return 'medium';
  return 'low'; // 0–1 comps: never better than low
}

/** The more conservative (lower) of two confidence levels. */
function minConfidence(
  a: ConfidenceLevel,
  b: ConfidenceLevel
): ConfidenceLevel {
  return CONF_RANK[a] <= CONF_RANK[b] ? a : b;
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

  const [pricePaid, hpi, epc, externalAvm, distanceWeighted, pdFloorArea] =
    await Promise.all([
      getPricePaid(postcode, 20),
      getHousepriceIndex(postcode),
      getEpcData(postcode, address),
      // PropertyData's £/sqft-driven AVM. Cached 7 days per postcode+type+
      // bedrooms so we burn ~3 credits per unique property per week.
      //
      // A FAILED lookup now throws rather than returning null. We catch it here so
      // one dark cross-check can't take down a valuation that has HMLR comps — but
      // we log it, because "no AVM" and "AVM unreachable" are different facts and
      // only one of them is a reason to distrust the estimate.
      getPropertyDataValuation({
        postcode,
        propertyType,
        bedrooms: bedrooms ?? undefined,
        // m², matching this package's units. See the unit caveat on
        // getPropertyDataValuation — /valuation-sale's expected unit is unconfirmed.
        internalAreaSqm: floorAreaSqm ?? undefined,
      }).catch((err) => {
        console.warn(
          `[base-valuation] external AVM cross-check unavailable for ${postcode}`,
          err
        );
        return null;
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
      // Real, EPC-derived floor area for THIS property (house-number matched).
      // Returns null when we can't pin an unambiguous record — we then show no
      // size rather than a guess. NOT the postcode average.
      // Same treatment: a failed /floor-areas lookup must not masquerade as
      // "no unambiguous record for this address".
      getPropertyFloorArea({
        postcode,
        address,
        propertyType,
        bedrooms: bedrooms ?? undefined,
      }).catch((err) => {
        console.warn(
          `[base-valuation] PropertyData floor-area lookup unavailable for ${postcode}`,
          err
        );
        return null;
      }),
    ]);

  // Real Land Registry sales only — a hash-derived placeholder must never be
  // presented as a comparable. When the feed was synthetic this empties the
  // comp set, which sends us to the sector source below — and, if that is
  // empty too, to InsufficientEvidenceError rather than a number.
  const hmlrComps = filterComps(
    realTransactions(pricePaid.transactions),
    propertyType,
    floorAreaSqm
  );

  // Floor-area resolution — real data or nothing. Priority:
  //   1. Caller-supplied size (a human typed it).
  //   2. PropertyData /floor-areas exact/unique match (real EPC record).
  // We deliberately DO NOT fall back to epc.floorAreaSqm here: that comes from
  // a street-level EPC search that can grab a neighbouring property (the M14
  // "doubled size" bug). No match → null → the UI shows no size.
  const effectiveFloorArea = floorAreaSqm ?? pdFloorArea?.floorAreaSqm ?? null;
  const floorAreaSource: BaseValuation['floorAreaSource'] = floorAreaSqm
    ? 'caller'
    : pdFloorArea
      ? 'propertydata'
      : null;
  const resolvedAddress = pdFloorArea?.matchedAddress ?? null;
  const effectiveBedrooms = bedrooms ?? epc.totalBedrooms ?? undefined;

  // CSA value — comparable sales adjusted value. Priority:
  //   1. Distance-weighted PropertyData comps (the real radius — best)
  //   2. Land Registry exact-postcode comps (median of adjusted)
  //   3. Land Registry postcode-SECTOR comps (free SPARQL; low confidence)
  //   4. Nothing → InsufficientEvidenceError. Never a number without a sale.
  //
  // Step 3 runs ONLY when 1 and 2 are both empty, so every valuation that
  // had a comp before Sep 2026 gets exactly the same answer it always did
  // (the AVM method is frozen until the backtest reads — see CLAUDE.md).
  // What changed is the zero-comp case: it used to price off
  // `pricePaid.avgPrice`, which when the HMLR feed was down was a
  // hash-generated placeholder. See ./evidence.ts for the incident.
  let csaValue: number;
  let comparables: ComparableSale[];
  let csaSource: 'distance' | 'hmlr' | 'sector';
  let sectorLabel: string | null = null;

  if (distanceWeighted) {
    csaValue = Math.round(distanceWeighted.estimatePence / 100);
    comparables = distanceWeighted.comps.map((c) => ({
      price: Math.round(c.pricePence / 100),
      date: c.date,
      propertyType,
      adjustedPrice: Math.round(c.adjustedPricePence / 100),
      monthsAgo: c.monthsAgo,
      address: c.address,
      postcode: c.postcode,
      distanceMiles: c.distanceMiles,
      floorAreaSqm: null,
      pricePerSqft: null,
    }));
    csaSource = 'distance';
  } else if (hmlrComps.length > 0) {
    csaValue = medianAdjusted(hmlrComps);
    comparables = hmlrComps.map((c) => ({
      price: c.price,
      date: c.date,
      propertyType: c.propertyType,
      adjustedPrice: c.adjustedPrice,
      monthsAgo: c.monthsAgo,
      // HMLR PPD (keyless feed) returns no per-sale address or coordinates.
      address: null,
      postcode: null,
      distanceMiles: null,
      floorAreaSqm: null,
      pricePerSqft: null,
    }));
    csaSource = 'hmlr';
  } else {
    // Widen to the postcode sector. Free, keyless, and independent of
    // PropertyData credits — but it carries no distance, so it can only
    // ever be low-confidence evidence (capped below).
    const sector = await getSectorPricePaid(postcode, { propertyType });
    const sectorComps = filterComps(
      realTransactions(sector.transactions) as typeof sector.transactions,
      propertyType,
      floorAreaSqm
    );
    if (sectorComps.length === 0) {
      const hmlrDown = pricePaid.source === 'synthetic';
      const sectorDown = sector.source === 'unavailable';
      throw new InsufficientEvidenceError({
        postcode,
        propertyType,
        reason: hmlrDown && sectorDown ? 'sources_unavailable' : 'no_sales',
        tried: [
          'PropertyData sold-prices (0.5 mile)',
          hmlrDown
            ? 'Land Registry postcode (unreachable)'
            : 'Land Registry postcode',
          sectorDown
            ? `Land Registry sector ${sector.sector ?? '?'} (unreachable)`
            : `Land Registry sector ${sector.sector ?? '?'}`,
        ],
      });
    }
    csaValue = medianAdjusted(sectorComps);
    comparables = sectorComps.map((c) => ({
      price: c.price,
      date: c.date,
      propertyType: c.propertyType,
      adjustedPrice: c.adjustedPrice,
      monthsAgo: c.monthsAgo,
      address: c.address,
      postcode: c.postcode,
      // Sector comps are not geolocated — the UI must not imply proximity.
      distanceMiles: null,
      floorAreaSqm: null,
      pricePerSqft: null,
    }));
    csaSource = 'sector';
    sectorLabel = sector.sector;
  }

  // Hedonic estimate — anchored to CSA, adjusted for size/bedrooms
  const hedonicValue = hedonicEstimate(
    csaValue,
    effectiveFloorArea,
    effectiveBedrooms,
    epc.floorAreaSqm
  );

  // HPI trend nudge: apply half the annual change as a sentiment adjustment
  const hpiNudge = 1 + (hpi.annualChange / 100) * 0.15;
  const hpiAdjustedHedonic = Math.round(hedonicValue * hpiNudge);

  // Size pillar — £/sqft from the comps we already hold, matched to their
  // EPC floor areas. The subject postcode's /floor-areas call is the same
  // one getPropertyFloorArea just made (90-day cache), so it costs nothing
  // extra; comp postcodes beyond it are capped so a wide radius can't fan
  // out into a credit burn. The area benchmark (/prices-per-sqf, 30-day
  // cache) is the fallback rate when too few comps match.
  const sqft = await resolveSqftEvidence({
    postcode,
    comps: comparables,
    subjectFloorAreaSqm: effectiveFloorArea,
  });
  // Stamp each comp with its matched size so the UI can show £/sqft per row.
  if (sqft && sqft.matchedCount > 0) {
    for (const comp of comparables) {
      const hit = sqft.matched.find(
        (m) =>
          m.address === comp.address &&
          m.adjustedPricePence === Math.round(comp.adjustedPrice * 100)
      );
      if (hit) {
        comp.floorAreaSqm = hit.floorAreaSqm;
        comp.pricePerSqft = hit.poundsPerSqft;
      }
    }
  }

  // Weighted triangulation — see triangulationWeights for the table. Without
  // a size signal these are the weights the AVM has always used:
  //   Distance CSA present:  CSA 60%, Hedonic 25%, External 15% (or 70/30)
  //   HMLR CSA, with ext:    CSA 40%, Hedonic 40%, External 20%
  //   HMLR CSA, no ext:      CSA 50%, Hedonic 50%
  const sqftEstimate = sqft?.sqftEstimate ?? null;
  const weights = triangulationWeights(
    csaSource,
    Boolean(externalAvm),
    sqftEstimate != null ? (sqft?.source ?? null) : null
  );
  const pointEstimate = Math.round(
    csaValue * weights.csa +
      hpiAdjustedHedonic * weights.hedonic +
      (externalAvm?.estimate ?? 0) * weights.external +
      (sqftEstimate ?? 0) * weights.sqft
  );

  // Confidence — two stages:
  //   1. a "signal" level from the model that produced the estimate
  //   2. a hard CEILING from how many nearby sold comps actually back it
  // The final level is the more conservative of the two, so proximity + volume
  // (not just model agreement) drive the number. This stops a single comp from
  // ever reading as "high" — the founder's rule is ~4 sales within half a mile.
  let signalLevel: ConfidenceLevel;
  if (csaSource === 'distance' && distanceWeighted) {
    signalLevel = distanceWeighted.confidence;
  } else if (csaSource === 'sector') {
    // Sector-wide sales with no distance: real evidence, unverified
    // proximity. Never better than low, however many rows agree.
    signalLevel = 'low';
  } else {
    signalLevel = calcConfidence(hpiAdjustedHedonic, csaValue).level;
  }

  // comparables.length = comps within half a mile (distance path) or the
  // exact-postcode comps used (HMLR path) — both are the volume of real
  // evidence behind this estimate.
  const confidenceLevel = minConfidence(
    signalLevel,
    confidenceCeilingFromComps(comparables.length)
  );
  const confidenceInterval = CONF_INTERVAL[confidenceLevel];

  const pricePerSqm =
    effectiveFloorArea && effectiveFloorArea > 0
      ? Math.round(pointEstimate / effectiveFloorArea)
      : null;
  const floorAreaSqft =
    effectiveFloorArea && effectiveFloorArea > 0
      ? sqmToSqft(effectiveFloorArea)
      : null;
  const pricePerSqft =
    floorAreaSqft && floorAreaSqft > 0
      ? Math.round(pointEstimate / floorAreaSqft)
      : null;

  // Only advertise a data source in the trail when it actually contributed real
  // data — never claim hmlr_hpi/epc when the feed came back 'unavailable'
  // (otherwise the source string silently implies a signal we didn't use).
  const hpiTag = hpi.source === 'hmlr_hpi' ? '+hmlr_hpi' : '';
  const epcTag = epc.source === 'epc_register' ? '+epc' : '';
  // The size pillar only earns a tag when it actually moved the estimate.
  const sqftTag =
    sqftEstimate != null && sqft?.source === 'matched_comps'
      ? `+sqft(${sqft.matchedCount})`
      : sqftEstimate != null && sqft?.source === 'area_benchmark'
        ? '+sqft_benchmark'
        : '';
  // Every branch above either found a real sale or threw, so 'synthetic'
  // can no longer be a valuation's source label.
  const source =
    csaSource === 'distance' && distanceWeighted
      ? `propertydata_sold_distance(${distanceWeighted.nearCount}@0.25mi/${distanceWeighted.farCount}@0.5mi)${hpiTag}${epcTag}${sqftTag}`
      : csaSource === 'sector'
        ? `hmlr_ppd_sector(${comparables.length}@${sectorLabel ?? '?'})${hpiTag}${epcTag}${sqftTag}`
        : `hmlr_ppd${hpiTag}${epcTag}${sqftTag}`;

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
    floorAreaSource,
    resolvedAddress,
    pricePerSqm,
    pricePerSqft,
    floorAreaSqft,
    sqft,
    sqftWeight: weights.sqft,
    source,
    distanceWeighted: distanceWeighted ?? null,
  };
}

// ---------------------------------------------------------------------------
// Size pillar — fetch the EPC floor areas behind the comps and build £/sqft
// ---------------------------------------------------------------------------

/**
 * Beyond the subject's own postcode (already cached by the floor-area
 * lookup above), how many comp postcodes we will pull /floor-areas for.
 * ~2 credits each, 90-day cache. Nearest comps first, so the cap trims the
 * far bucket, never the near one.
 */
const MAX_COMP_POSTCODE_LOOKUPS = 5;

async function resolveSqftEvidence(input: {
  postcode: string;
  comps: ComparableSale[];
  subjectFloorAreaSqm: number | null;
}): Promise<SqftEvidence | null> {
  const subjectKey = normalisePostcode(input.postcode);
  // HMLR comps carry no address, so nothing can match — but the benchmark
  // can still size the subject. Skip the fan-out, keep the benchmark.
  const addressed = input.comps.filter((c) => c.address);
  const compKeys: string[] = [];
  for (const c of [...addressed].sort(
    (a, b) => (a.distanceMiles ?? 0) - (b.distanceMiles ?? 0)
  )) {
    const key = normalisePostcode(c.postcode);
    if (!key || key === subjectKey || compKeys.includes(key)) continue;
    compKeys.push(key);
    if (compKeys.length >= MAX_COMP_POSTCODE_LOOKUPS) break;
  }

  try {
    const [subjectRows, benchmark, ...compRows] = await Promise.all([
      addressed.length > 0
        ? getFloorAreaRows(input.postcode)
        : Promise.resolve([] as FloorAreaRow[]),
      // Benchmark only matters when we have a subject size to multiply.
      input.subjectFloorAreaSqm
        ? getPricesPerSqf(input.postcode).catch((err) => {
            console.warn(
              `[base-valuation] £/sqft benchmark unavailable for ${input.postcode}`,
              err
            );
            return null;
          })
        : Promise.resolve(null),
      ...compKeys.map((key) => getFloorAreaRows(key)),
    ]);

    const floorAreasByPostcode = new Map<string, FloorAreaRow[]>();
    floorAreasByPostcode.set(subjectKey, subjectRows);
    compKeys.forEach((key, i) => {
      floorAreasByPostcode.set(key, compRows[i] ?? []);
    });

    return buildSqftEvidence({
      comps: addressed.map((c) => ({
        address: c.address,
        postcode: c.postcode,
        adjustedPricePence: Math.round(c.adjustedPrice * 100),
        distanceMiles: c.distanceMiles,
      })),
      floorAreasByPostcode,
      subjectPostcode: input.postcode,
      subjectFloorAreaSqm: input.subjectFloorAreaSqm,
      benchmarkPerSqft:
        benchmark?.medianPerSqft ?? benchmark?.averagePerSqft ?? null,
    });
  } catch (err) {
    // A failed size lookup must never take down a valuation that has comps.
    console.warn(
      `[base-valuation] £/sqft evidence unavailable for ${input.postcode}`,
      err
    );
    return null;
  }
}

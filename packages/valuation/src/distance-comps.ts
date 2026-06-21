/**
 * Distance-weighted comparable analysis.
 *
 * The founder's rule: comparable sold prices within a quarter of a mile carry
 * 60% of the weight, those between a quarter and half a mile carry 40%, and
 * anything beyond half a mile is ignored. Only sales in the last 12 months
 * count.
 *
 * Land Registry's keyless feed only returns the *exact* postcode, so it can't
 * support a radius. This module instead uses PropertyData's /sold-prices feed
 * (a real radius of comparables) and computes the true distance of each comp
 * from the subject using postcodes.io coordinates (also keyless). Everything
 * here works in PENCE, matching the PropertyData wrapper.
 *
 * Returns null when we can't geolocate the subject or have no comps — callers
 * must fall back to the Land-Registry path rather than fabricate a number.
 */

import 'server-only';

import {
  distanceMiles,
  geocodePostcode,
  geocodePostcodes,
  getSoldPrices,
  type LatLng,
} from '@repo/property-data';

export type DistanceCompType = 'detached' | 'semi-detached' | 'terraced' | 'flat';

export interface DistanceCompInput {
  postcode: string;
  propertyType: DistanceCompType;
  bedrooms?: number;
  /** Pre-resolved subject coordinates; geocoded from postcode if omitted. */
  subjectLatLng?: LatLng | null;
  /** Sale-age window. Default 12 months per the founder's rule. */
  maxAgeMonths?: number;
  /** Monthly HPI drift used to time-adjust older comps. Default 0.4%/mo. */
  monthlyAppreciation?: number;
}

export interface WeightedComp {
  address: string;
  postcode: string | null;
  pricePence: number;
  adjustedPricePence: number;
  date: string;
  monthsAgo: number;
  distanceMiles: number;
  bucket: 'near' | 'far';
}

export interface DistanceWeightedValuation {
  estimatePence: number;
  nearMedianPence: number | null;
  farMedianPence: number | null;
  nearCount: number;
  farCount: number;
  comps: WeightedComp[];
  /** Effective weights actually applied (renormalised if a bucket is empty). */
  weighting: { near: number; far: number };
  confidence: 'high' | 'medium' | 'low';
  source: 'propertydata_sold_distance';
}

const NEAR_RADIUS_MILES = 0.25;
const FAR_RADIUS_MILES = 0.5;
const NEAR_WEIGHT = 0.6;
const FAR_WEIGHT = 0.4;
const DEFAULT_MAX_AGE_MONTHS = 12;
const DEFAULT_MONTHLY_APPRECIATION = 0.004;

function monthsBetweenNow(dateStr: string): number {
  const sold = new Date(dateStr).getTime();
  if (Number.isNaN(sold)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((Date.now() - sold) / (30 * 86_400_000)));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
    : (sorted[mid] ?? 0);
}

/**
 * Produce a distance-weighted market value (pence) for the subject, or null
 * if it can't be computed from real comparables.
 */
export async function getDistanceWeightedValuation(
  input: DistanceCompInput,
): Promise<DistanceWeightedValuation | null> {
  const maxAgeMonths = input.maxAgeMonths ?? DEFAULT_MAX_AGE_MONTHS;
  const monthlyAppreciation =
    input.monthlyAppreciation ?? DEFAULT_MONTHLY_APPRECIATION;

  // 1. Subject coordinates — required to measure distance.
  const subject =
    input.subjectLatLng ?? (await geocodePostcode(input.postcode));
  if (!subject) return null;

  // 2. Pull a wide net of recent same-type, same-bedroom sold comps.
  const sold = await getSoldPrices(input.postcode, {
    maxAgeMonths,
    type: input.propertyType,
    bedrooms: input.bedrooms,
    points: 100,
  });
  if (!sold || sold.transactions.length === 0) return null;

  // 3. Geocode every comp postcode in one bulk call.
  const compPostcodes = sold.transactions
    .map((t) => t.postcode)
    .filter((p): p is string => Boolean(p));
  const coords = await geocodePostcodes(compPostcodes);

  // 4. Build distance + time-adjusted comps inside the half-mile, 12-month box.
  const comps: WeightedComp[] = [];
  for (const t of sold.transactions) {
    if (!t.postcode) continue;
    const key = t.postcode.toUpperCase().replace(/\s+/g, '');
    const ll = coords.get(key);
    if (!ll) continue;

    const dist = distanceMiles(subject, ll);
    if (dist > FAR_RADIUS_MILES) continue;

    const monthsAgo = monthsBetweenNow(t.date);
    if (monthsAgo > maxAgeMonths) continue;

    const adjustedPricePence = Math.round(
      t.pricePence * (1 + monthlyAppreciation * monthsAgo),
    );

    comps.push({
      address: t.address,
      postcode: t.postcode,
      pricePence: t.pricePence,
      adjustedPricePence,
      date: t.date,
      monthsAgo,
      distanceMiles: Math.round(dist * 100) / 100,
      bucket: dist <= NEAR_RADIUS_MILES ? 'near' : 'far',
    });
  }

  if (comps.length === 0) return null;

  const nearPrices = comps
    .filter((c) => c.bucket === 'near')
    .map((c) => c.adjustedPricePence);
  const farPrices = comps
    .filter((c) => c.bucket === 'far')
    .map((c) => c.adjustedPricePence);

  const nearMedian = median(nearPrices);
  const farMedian = median(farPrices);

  // 5. Blend the two buckets 60/40, renormalising when one is empty.
  let estimate: number;
  let weighting: { near: number; far: number };
  if (nearMedian != null && farMedian != null) {
    estimate = Math.round(nearMedian * NEAR_WEIGHT + farMedian * FAR_WEIGHT);
    weighting = { near: NEAR_WEIGHT, far: FAR_WEIGHT };
  } else if (nearMedian != null) {
    estimate = nearMedian;
    weighting = { near: 1, far: 0 };
  } else {
    // farMedian must be non-null here (comps.length > 0)
    estimate = farMedian as number;
    weighting = { near: 0, far: 1 };
  }

  // 6. Confidence from how much near-radius evidence we have.
  const confidence: DistanceWeightedValuation['confidence'] =
    nearPrices.length >= 3
      ? 'high'
      : comps.length >= 3
        ? 'medium'
        : 'low';

  return {
    estimatePence: estimate,
    nearMedianPence: nearMedian,
    farMedianPence: farMedian,
    nearCount: nearPrices.length,
    farCount: farPrices.length,
    comps: comps.sort((a, b) => a.distanceMiles - b.distanceMiles),
    weighting,
    confidence,
    source: 'propertydata_sold_distance',
  };
}

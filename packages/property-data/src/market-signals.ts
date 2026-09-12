/**
 * Market signals (market-signals.ts) — a property's live body language.
 *
 * The AVM prices a property; this reads how its LISTING is behaving — days
 * on market, price cuts and their velocity, whether it sits on any of
 * PropertyData's distress lists — plus what else is distress-flagged nearby.
 * One /sourced-properties call per appraisal (all seven lists combined,
 * cached 24h), surfaced next to the valuation and never fed into scoring.
 *
 * This module is PURE (no server-only, no network): the subject-matching
 * rules live here so they can be unit-tested. The fetch half —
 * `getSubjectMarketSignals` — lives in propertydata.ts with the other
 * endpoint wrappers.
 *
 * Matching rule, per the repo's no-guessing principle: a subject is matched
 * to a listing ONLY on same postcode + unambiguous house-number evidence.
 * Anything ambiguous returns null — "not matched" is honest, a guessed match
 * pins another house's price cuts on this one.
 */

import type { SourcedProperty } from './propertydata';

export interface NearbyDistressListing {
  address: string;
  postcode: string;
  pricePence: number | null;
  bedrooms: number | null;
  propertyType: string | null;
  daysOnMarket: number | null;
  discountPercent: number | null;
  listingUrl: string | null;
}

export interface MarketSignals {
  /** True when the subject itself was found on a distress list. */
  distressListed: boolean;
  /** The listing address we matched — carries the house number. */
  matchedAddress: string | null;
  pricePence: number | null;
  originalPricePence: number | null;
  discountPercent: number | null;
  reductionCount: number | null;
  daysOnMarket: number | null;
  daysSincePriceChange: number | null;
  velocityScore: number | null;
  /** Sold-subject-to-contract flag as PropertyData reports it. */
  sstc: boolean | null;
  /** Distress-flagged listings within the radius, subject excluded. */
  nearby: NearbyDistressListing[];
  /** Total distress-flagged listings within the radius (before the cap). */
  nearbyDistressCount: number;
  radiusMiles: number;
  checkedAt: string;
}

/** How many nearby listings we carry on the result (sorted, capped). */
export const NEARBY_CAP = 12;

const WHITESPACE = /\s+/g;
const NON_ALNUM = /[^a-z0-9\s]/g;
const HOUSE_NUMBER = /^\d+[a-z]?$/;

function compactPostcode(value: string | null | undefined): string {
  return (value ?? '').replace(WHITESPACE, '').toUpperCase();
}

function tokens(value: string | null | undefined): string[] {
  return (value ?? '')
    .toLowerCase()
    .replace(NON_ALNUM, ' ')
    .split(WHITESPACE)
    .filter(Boolean);
}

/** First house-number-shaped token ("12", "8a") in an address, else null. */
export function houseNumber(address: string | null | undefined): string | null {
  for (const t of tokens(address)) {
    if (HOUSE_NUMBER.test(t)) {
      return t;
    }
  }
  return null;
}

/**
 * Find the subject property among sourced listings. Same postcode is
 * required; within it, the subject's house number must appear in exactly one
 * candidate. No house number (or several candidates carrying it) → null.
 */
export function matchSubjectListing(
  subject: { address?: string | null; postcode: string },
  candidates: readonly SourcedProperty[]
): SourcedProperty | null {
  const pc = compactPostcode(subject.postcode);
  if (!pc) {
    return null;
  }
  const samePostcode = candidates.filter(
    (c) => compactPostcode(c.postcode) === pc
  );
  if (samePostcode.length === 0) {
    return null;
  }

  const num = houseNumber(subject.address);
  if (num === null) {
    // Without a house number the only honest match is a whole-address one.
    const subjectTokens = tokens(subject.address).join(' ');
    if (!subjectTokens) {
      return null;
    }
    const exact = samePostcode.filter(
      (c) => tokens(c.preciseAddress ?? c.address).join(' ') === subjectTokens
    );
    return exact.length === 1 ? (exact[0] ?? null) : null;
  }

  const withNumber = samePostcode.filter((c) =>
    tokens(c.preciseAddress ?? c.address).includes(num)
  );
  return withNumber.length === 1 ? (withNumber[0] ?? null) : null;
}

/**
 * Shape a MarketSignals result from a sweep. Pure — callers supply the
 * listings and the clock.
 */
export function buildMarketSignals(input: {
  subject: { address?: string | null; postcode: string };
  listings: readonly SourcedProperty[];
  radiusMiles: number;
  now?: Date;
}): MarketSignals {
  const { subject, listings, radiusMiles } = input;
  const matched = matchSubjectListing(subject, listings);

  const nearby = listings
    .filter((l) => l !== matched)
    .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))
    .slice(0, NEARBY_CAP)
    .map((l) => ({
      address: l.preciseAddress ?? l.address,
      postcode: l.postcode,
      pricePence: l.pricePence,
      bedrooms: l.bedrooms,
      propertyType: l.propertyType,
      daysOnMarket: l.daysOnMarket,
      discountPercent: l.discountPercent,
      listingUrl: l.listingUrl,
    }));

  return {
    distressListed: matched !== null,
    matchedAddress: matched
      ? (matched.preciseAddress ?? matched.address)
      : null,
    pricePence: matched?.pricePence ?? null,
    originalPricePence: matched?.originalPricePence ?? null,
    discountPercent: matched?.discountPercent ?? null,
    reductionCount: matched?.reductionCount ?? null,
    daysOnMarket: matched?.daysOnMarket ?? null,
    daysSincePriceChange: matched?.daysSincePriceChange ?? null,
    velocityScore: matched?.velocityScore ?? null,
    sstc: matched?.sstc ?? null,
    nearby,
    nearbyDistressCount: listings.length - (matched ? 1 : 0),
    radiusMiles,
    checkedAt: (input.now ?? new Date()).toISOString(),
  };
}

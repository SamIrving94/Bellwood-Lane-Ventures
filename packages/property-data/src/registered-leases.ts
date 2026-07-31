/**
 * Registered-lease intelligence (registered-leases.ts)
 *
 * Turns a leasehold's remaining term into a *motivated-seller* signal.
 *
 * Why this matters for sourcing:
 *   A flat with a short lease is hard to sell on the open market — most
 *   mortgage lenders won't lend below ~70–80 years remaining, so the buyer
 *   pool collapses to cash investors. That depresses the price and pushes the
 *   owner toward a fast, direct sale: exactly the off-market opportunity
 *   Bellwood is built to catch (the founder's Flat 5 Milton Court deal was
 *   precisely this play).
 *
 *   The decisive threshold is **80 years remaining** — the
 *   "marriage value" line under the Leasehold Reform, Housing and Urban
 *   Development Act 1993. Below 80 years the statutory cost to extend the
 *   lease jumps (the freeholder becomes entitled to 50% of the uplift in
 *   value the extension creates), so the discount — and the seller's
 *   motivation — both step up sharply as the term falls through 80.
 *
 * This module is deliberately PURE: it computes remaining term and a distress
 * classification from plain inputs. The actual £-cost of extending a lease is
 * out of scope here — that lives in the valuation deal-model, which already
 * prices a lease-extension line. Here we only decide *whether a lease makes a
 * seller motivated*, and *how motivated*.
 *
 * Data sources that feed this (any one will do — all expose a remaining-term
 * number per address):
 *   - HMLR "Registered Leases" dataset (term start + term length → remaining)
 *   - PropertyData /freeholds (`remainingLeaseYears`, key already configured)
 *   - A leasehold title register (Part A term particulars)
 */

// ---------------------------------------------------------------------------
// Thresholds — the statutory + lending lines that define lease distress.
// ---------------------------------------------------------------------------

/** Below this remaining term, "marriage value" is payable on a statutory
 *  extension (LRHUDA 1993). The single most important line for sourcing. */
export const MARRIAGE_VALUE_THRESHOLD_YEARS = 80;

/** Below this, most high-street lenders decline — the buyer pool narrows to
 *  cash purchasers and the open-market discount widens materially. */
export const UNMORTGAGEABLE_THRESHOLD_YEARS = 70;

/** Below this the lease is critically short: extension cost is large and the
 *  property is effectively cash-only. Strongest distress signal. */
export const CRITICAL_LEASE_THRESHOLD_YEARS = 60;

/** Default upper bound for what the short-lease scout will surface as a lead.
 *  We look just above the marriage-value line so leads appear *before* they
 *  tip over it, when there is still time to act. */
export const DEFAULT_SHORT_LEASE_CEILING_YEARS = 85;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LeaseDistressBand =
  | 'critical' // < 60y — cash-only, large extension cost
  | 'unmortgageable' // 60–70y — most lenders decline
  | 'marriage-value' // 70–80y — marriage value payable, sale pressure building
  | 'watch' // 80–~85y — approaching the line; act early
  | 'comfortable' // > ceiling — not a distress signal
  | 'unknown'; // no term data

export interface LeaseAssessment {
  /** Remaining years used for the classification (may be the input value). */
  remainingYears: number | null;
  band: LeaseDistressBand;
  /** True when remaining term is under the 80-year marriage-value line. */
  marriageValue: boolean;
  /** True when the lease is short enough to be a genuine seller-motivation
   *  signal worth sourcing on. */
  motivated: boolean;
  /** 0–1 urgency weight — how strong a motivation signal this is. Scales as
   *  the term falls (a 55-year lease is far hotter than a 79-year one). */
  urgency: number;
  /** Plain-English one-liner, ready to render in the UI / rationale. */
  label: string;
}

// ---------------------------------------------------------------------------
// Remaining-term calculation
// ---------------------------------------------------------------------------

/**
 * Compute the remaining lease term in whole years from a term *start* date and
 * the granted term length. This is how the HMLR Registered Leases dataset
 * encodes a lease (e.g. "term 99 years from 24 June 1985").
 *
 * Returns null when inputs are missing or unparseable — we never guess a term.
 *
 * @param termStartISO Date the term began (any Date-parseable string).
 * @param termYears    Length of the granted term in years (e.g. 99, 125, 999).
 * @param asOf         Reference date (defaults to caller-supplied "now"); pass
 *                     an explicit Date so the function stays pure/testable.
 */
export function computeRemainingLeaseYears(
  termStartISO: string | null | undefined,
  termYears: number | null | undefined,
  asOf: Date
): number | null {
  if (
    !termStartISO ||
    typeof termYears !== 'number' ||
    !Number.isFinite(termYears)
  ) {
    return null;
  }
  const startMs = Date.parse(termStartISO);
  if (Number.isNaN(startMs)) return null;

  const start = new Date(startMs);
  const expiry = new Date(start);
  expiry.setFullYear(expiry.getFullYear() + Math.round(termYears));

  const remainingMs = expiry.getTime() - asOf.getTime();
  // Whole years remaining, floored. Already-expired leases clamp to 0.
  return Math.max(0, Math.floor(remainingMs / (365.25 * 24 * 60 * 60 * 1000)));
}

// ---------------------------------------------------------------------------
// Distress classification
// ---------------------------------------------------------------------------

/**
 * Classify a remaining lease term into a distress band + motivation signal.
 *
 * @param remainingYears Whole years remaining (or null if unknown).
 * @param ceiling        Upper bound at/above which we treat the lease as a
 *                       non-signal. Defaults to DEFAULT_SHORT_LEASE_CEILING_YEARS.
 */
export function classifyLeaseDistress(
  remainingYears: number | null | undefined,
  ceiling: number = DEFAULT_SHORT_LEASE_CEILING_YEARS
): LeaseAssessment {
  if (typeof remainingYears !== 'number' || !Number.isFinite(remainingYears)) {
    return {
      remainingYears: null,
      band: 'unknown',
      marriageValue: false,
      motivated: false,
      urgency: 0,
      label: 'Lease term unknown',
    };
  }

  const years = Math.max(0, Math.floor(remainingYears));
  const marriageValue = years < MARRIAGE_VALUE_THRESHOLD_YEARS;

  let band: LeaseDistressBand;
  if (years < CRITICAL_LEASE_THRESHOLD_YEARS) band = 'critical';
  else if (years < UNMORTGAGEABLE_THRESHOLD_YEARS) band = 'unmortgageable';
  else if (years < MARRIAGE_VALUE_THRESHOLD_YEARS) band = 'marriage-value';
  else if (years < ceiling) band = 'watch';
  else band = 'comfortable';

  // 'unknown' already returned above, so anything but 'comfortable' is a signal.
  const motivated = band !== 'comfortable';

  // Urgency scales linearly from the ceiling (0) down to 40 years (1.0), so a
  // critically short lease reads as a far stronger signal than a borderline one.
  const URGENCY_FLOOR_YEARS = 40;
  const urgency = motivated
    ? Math.min(
        1,
        Math.max(0, (ceiling - years) / (ceiling - URGENCY_FLOOR_YEARS))
      )
    : 0;

  const label =
    band === 'critical'
      ? `Critically short lease (${years}y) — cash-only, strong sale pressure`
      : band === 'unmortgageable'
        ? `Short lease (${years}y) — below most lenders' floor`
        : band === 'marriage-value'
          ? `Short lease (${years}y) — under the 80y marriage-value line`
          : band === 'watch'
            ? `Lease approaching marriage value (${years}y)`
            : `Comfortable lease (${years}y)`;

  return {
    remainingYears: years,
    band,
    marriageValue,
    motivated,
    urgency,
    label,
  };
}

// ---------------------------------------------------------------------------
// Short-lease filter over tenure readings
// ---------------------------------------------------------------------------

/** Minimal shape this module needs from a tenure/lease record. Compatible with
 *  `TenureReading` from ./propertydata and with HMLR Registered-Lease rows. */
export interface LeaseRecordInput {
  address: string;
  tenure?: 'freehold' | 'leasehold' | 'unknown';
  remainingLeaseYears?: number | null;
  /** Optional raw term particulars (HMLR dataset) — used when
   *  remainingLeaseYears isn't pre-computed. */
  termStartISO?: string | null;
  termYears?: number | null;
  groundRentPerYear?: number | null;
  serviceChargePerYear?: number | null;
}

export interface ShortLeaseHit extends LeaseAssessment {
  address: string;
  groundRentPerYear: number | null;
  serviceChargePerYear: number | null;
}

/**
 * Filter a batch of lease/tenure records down to the motivated short-lease
 * hits, newest-distress first (shortest lease at the top).
 *
 * Records are matched on remainingLeaseYears when present; otherwise the
 * remaining term is derived from term particulars. Freeholds and long leases
 * are dropped.
 *
 * @param asOf Reference "now" — passed in so the function stays pure/testable.
 */
export function findShortLeases(
  records: LeaseRecordInput[],
  asOf: Date,
  ceiling: number = DEFAULT_SHORT_LEASE_CEILING_YEARS
): ShortLeaseHit[] {
  const hits: ShortLeaseHit[] = [];
  for (const r of records) {
    // Freeholds can never be a short-lease signal.
    if (r.tenure === 'freehold') continue;

    const remaining =
      typeof r.remainingLeaseYears === 'number'
        ? r.remainingLeaseYears
        : computeRemainingLeaseYears(r.termStartISO, r.termYears, asOf);

    const assessment = classifyLeaseDistress(remaining, ceiling);
    if (!assessment.motivated) continue;

    hits.push({
      ...assessment,
      address: r.address,
      groundRentPerYear: r.groundRentPerYear ?? null,
      serviceChargePerYear: r.serviceChargePerYear ?? null,
    });
  }
  // Shortest lease (highest urgency) first.
  return hits.sort((a, b) => b.urgency - a.urgency);
}

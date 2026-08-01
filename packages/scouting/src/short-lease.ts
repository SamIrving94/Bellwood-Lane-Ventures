/**
 * Short-lease scout source (short-lease.ts)
 *
 * Finds leasehold flats whose remaining term has fallen near or below the
 * 80-year "marriage value" line — a strong motivated-seller signal (see
 * `@repo/property-data/registered-leases` for the why). These owners are hard
 * to sell to on the open market (most lenders decline a short lease), so they
 * are unusually open to a fast, direct, off-market sale. This is the founder's
 * Flat 5 Milton Court pattern, turned into a repeatable feed.
 *
 * Data source: PropertyData `/freeholds` (`getTenureByPostcode`) — the same
 * key the scouting pipeline already uses for tenure enrichment, so this source
 * costs no new integration. Each scanned postcode yields per-address tenure +
 * remaining lease years; we keep the leasehold rows under the short-lease
 * ceiling.
 *
 * Output is shaped as the pipeline's loosely-typed "raw grant" so it flows
 * through the existing enrich → score → persist path. We tag each row with
 * `leadTypeHint: 'lease_expiry'` so the scorer credits it the lease-expiry
 * motivation weight rather than mislabelling it as probate.
 */

import { getTenureByPostcode } from '@repo/property-data/src/propertydata';
import {
  DEFAULT_SHORT_LEASE_CEILING_YEARS,
  type LeaseDistressBand,
  findShortLeases,
} from '@repo/property-data/src/registered-leases';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShortLeaseSeed {
  label?: string;
  /** Full UK postcode to scan (PropertyData /freeholds is postcode-scoped). */
  postcode: string;
}

/**
 * Raw-grant-shaped lead, matching the contract the scouting pipeline consumes
 * (the same loose shape probate/PropertyData/planning sources emit). The
 * `leaseSignal` block is read by the pipeline to drive scoring.
 */
export interface ShortLeaseRawLead {
  probateRef: string;
  address: string;
  postcode: string;
  grantDate: string;
  executorName: null;
  solicitorFirm: string | null;
  estateValuePence: number | null;
  grantType: 'unknown';
  source: string;
  daysSinceGrant: number;
  /** Tells enrichment to score this as a lease-expiry lead, not probate. */
  leadTypeHint: 'lease_expiry';
  /** Lease distress detail — flows to the scorer + UI rationale. */
  leaseSignal: {
    remainingLeaseYears: number;
    band: LeaseDistressBand;
    marriageValue: boolean;
    urgency: number;
    groundRentPerYear: number | null;
    serviceChargePerYear: number | null;
    label: string;
  };
}

export interface ShortLeaseScoutOptions {
  /** Upper bound on remaining years to surface. Default 85 (act before the
   *  marriage-value line, while there's still time). */
  ceilingYears?: number;
  /** Reference "now". Injected for deterministic tests. Default: new Date(). */
  asOf?: Date;
}

export interface ShortLeaseScoutResult {
  leads: ShortLeaseRawLead[];
  /** Postcodes scanned this run. */
  scanned: number;
  /** First error encountered (per-postcode failures are otherwise swallowed). */
  error?: string;
}

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

/**
 * Scan a set of postcodes for short-lease leads.
 *
 * Per-postcode failures are tolerated (one bad postcode never sinks the run);
 * the first error is surfaced on the result so the pipeline can attach it to
 * `sourceErrors`. Returns an empty list when no key is configured — never
 * synthesises leads (same rule as the probate source).
 */
export async function fetchShortLeaseLeads(
  seeds: ShortLeaseSeed[],
  options: ShortLeaseScoutOptions = {}
): Promise<ShortLeaseScoutResult> {
  const ceiling = options.ceilingYears ?? DEFAULT_SHORT_LEASE_CEILING_YEARS;
  const asOf = options.asOf ?? new Date();
  const runDateISO = asOf.toISOString().slice(0, 10);

  const leads: ShortLeaseRawLead[] = [];
  let firstError: string | undefined;
  let scanned = 0;

  for (const seed of seeds) {
    scanned++;
    try {
      const readings = await getTenureByPostcode(seed.postcode);
      const hits = findShortLeases(readings, asOf, ceiling);
      const districtPostcode = seed.postcode.toUpperCase().trim();

      for (const hit of hits) {
        // remainingYears is guaranteed non-null for motivated hits.
        const years = hit.remainingYears ?? 0;
        const refSlug = hit.address
          .slice(0, 24)
          .replace(/\s+/g, '_')
          .replace(/[^A-Za-z0-9_]/g, '');
        leads.push({
          probateRef: `lease-${seed.label ?? districtPostcode}-${refSlug}`,
          address: hit.address,
          postcode: districtPostcode,
          grantDate: runDateISO,
          executorName: null,
          solicitorFirm: null,
          estateValuePence: null,
          grantType: 'unknown',
          source: hit.marriageValue
            ? 'short_lease_marriage_value'
            : 'short_lease_watch',
          daysSinceGrant: 0,
          leadTypeHint: 'lease_expiry',
          leaseSignal: {
            remainingLeaseYears: years,
            band: hit.band,
            marriageValue: hit.marriageValue,
            urgency: hit.urgency,
            groundRentPerYear: hit.groundRentPerYear,
            serviceChargePerYear: hit.serviceChargePerYear,
            label: hit.label,
          },
        });
      }
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      if (!firstError)
        firstError = `${seed.label ?? seed.postcode}: ${msg.slice(0, 150)}`;
      console.warn(
        `[scouting/short-lease] scan failed for ${seed.postcode}`,
        err
      );
    }
  }

  return { leads, scanned, error: firstError };
}

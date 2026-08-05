/**
 * Lapsing/stalled planning consents — the brownfield register source.
 *
 * Every council must publish a brownfield land register. Each entry carries
 * the site address, coordinates, dwelling capacity, and — the key fields —
 * `planning-permission-status` + `planning-permission-date`. A site that is
 * `permissioned`, YEARS past its permission date, and still on the register
 * (no `end-date`) is a stalled scheme: an owner who paid for a consent they
 * have not built out. Full permissions lapse 3 years after grant
 * (s.91 TCPA 1990), so the pressure is real and dated.
 *
 * ---------------------------------------------------------------------------
 * API contract — VERIFIED AGAINST THE LIVE SERVER, 2026-08-05
 * ---------------------------------------------------------------------------
 * Founder browser probe of
 * https://www.planning.data.gov.uk/entity.json?dataset=brownfield-land
 * returned HTTP 200, count=37505. The response is checked in as
 * `__tests__/fixtures/planning-brownfield-live-2026-08-05.json` and locked
 * by `planning-consents.test.ts`. Facts baked in:
 *
 *  - Entities carry `site-address` (with postcode), `point`,
 *    `planning-permission-status` ('permissioned' per the 3-value
 *    planning-permission-status vocabulary), `planning-permission-date`,
 *    `minimum-net-dwellings` / `maximum-net-dwellings` (strings), `notes`,
 *    `site-plan-url`, `deliverable`, `hectares`, `ownership-status`.
 *  - A COMPLETED/REMOVED site gets an `end-date` — live entries have ''.
 *  - Pagination is offset-based via `links.next` (plain URLs). No key.
 *
 * The dataset is ~37.5k rows, so this source walks it WEEKLY (Wednesdays),
 * not daily — a full walk is bounded by MAX_PAGES below. On other days it
 * returns `{ skipped: true }` and the pipeline marks the source skipped in
 * health reporting rather than dark.
 *
 * FAILURE CONTRACT (matches gazette/receiverships): first-page failure
 * THROWS; later pages degrade to partial results with the error surfaced.
 */

import 'server-only';

const API_ORIGIN = 'https://www.planning.data.gov.uk';
const REQUEST_TIMEOUT_MS = 15_000;
const PAGE_SIZE = 500; // the API caps limit at 500; links.next carries it on
const MAX_PAGES = 90; // 90 × 500 = 45k — covers the whole register with slack
/** Weekly cadence: 3 = Wednesday (auction scan owns Monday). */
const RUN_DAY = 3;

/** Permission must be at least this old to read as "stalled". */
const MIN_PERMISSION_AGE_MONTHS = 18;
/** UK postcode inside site-address. */
const POSTCODE_REGEX = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})\b/i;

export interface PlanningConsentRawLead {
  probateRef: string;
  address: string;
  postcode: string;
  grantDate: string;
  executorName: null;
  solicitorFirm: string | null;
  estateValuePence: number | null;
  grantType: 'unknown';
  source: 'brownfield_register';
  daysSinceGrant: number;
  /** Scorer motivation class (see scorer-config leadTypeScores). */
  leadTypeHint: 'lapsing_consent';
  /**
   * Free text carried so the track classifier can read the dwelling count
   * ("15 dwellings" ⇒ block) without special-casing this source.
   */
  planningSignal: {
    reference: string;
    permissionDate: string | null;
    permissionType: string | null;
    minDwellings: number | null;
    maxDwellings: number | null;
    hectares: number | null;
    deliverable: string | null;
    ownershipStatus: string | null;
    sitePlanUrl: string | null;
    notes: string | null;
    organisationEntity: number | null;
    point: string | null;
    summary: string;
  };
}

export interface PlanningConsentsScoutResult {
  leads: PlanningConsentRawLead[];
  sitesScanned: number;
  pagesFetched: number;
  /** True when today isn't the weekly run day — source health shows skipped. */
  skipped?: boolean;
  /** First per-page error, when partial. */
  error?: string;
}

export interface PlanningConsentsScoutOptions {
  /** Run regardless of weekday (debug / scout-debug). */
  force?: boolean;
  minPermissionAgeMonths?: number;
  maxPages?: number;
}

/**
 * Parse one API page into leads. Pure — exported so the checked-in live
 * fixture can assert against it.
 */
export function parseBrownfieldPage(
  page: unknown,
  opts: { minPermissionAgeMonths: number; now: Date }
): { leads: PlanningConsentRawLead[]; nextUrl: string | null; scanned: number } {
  const root = (page ?? {}) as Record<string, unknown>;
  const entities = Array.isArray(root.entities)
    ? (root.entities as Array<Record<string, unknown>>)
    : [];

  const ageCutoff = new Date(opts.now);
  ageCutoff.setMonth(ageCutoff.getMonth() - opts.minPermissionAgeMonths);

  const leads: PlanningConsentRawLead[] = [];

  for (const e of entities) {
    const str = (key: string): string | null => {
      const v = e[key];
      return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
    };
    const num = (key: string): number | null => {
      const v = str(key);
      if (v === null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    // Live entries only — an end-date means completed or removed.
    if (str('end-date')) continue;
    if (str('planning-permission-status') !== 'permissioned') continue;

    const permissionDate = str('planning-permission-date');
    if (!permissionDate) continue;
    if (new Date(permissionDate) > ageCutoff) continue; // too fresh to be stalled

    const address = str('site-address');
    if (!address) continue;
    const pcMatch = POSTCODE_REGEX.exec(address);
    if (!pcMatch) continue;
    const postcode = `${pcMatch[1]} ${pcMatch[2]}`.toUpperCase();

    const minDwellings = num('minimum-net-dwellings');
    const maxDwellings = num('maximum-net-dwellings');
    const dwellings = maxDwellings ?? minDwellings;
    const notes = str('notes');

    // The summary is what the track classifier reads: an explicit dwelling
    // count reads as multi-unit stock ("15 dwellings" ⇒ block track).
    const summary = [
      dwellings !== null && dwellings >= 2 ? `${dwellings} dwellings` : null,
      'consented, unbuilt brownfield site',
      `permissioned ${permissionDate}`,
      notes,
    ]
      .filter(Boolean)
      .join(' — ');

    const daysSinceGrant = Math.max(
      0,
      Math.floor(
        (opts.now.getTime() - new Date(permissionDate).getTime()) / 86_400_000
      )
    );

    leads.push({
      probateRef: `bfl-${String(e.entity ?? e.reference ?? address)}`,
      address,
      postcode,
      grantDate: permissionDate,
      executorName: null,
      solicitorFirm: null,
      estateValuePence: null,
      grantType: 'unknown',
      source: 'brownfield_register',
      daysSinceGrant,
      leadTypeHint: 'lapsing_consent',
      planningSignal: {
        reference: str('reference') ?? String(e.entity ?? ''),
        permissionDate,
        permissionType: str('planning-permission-type'),
        minDwellings,
        maxDwellings,
        hectares: num('hectares'),
        deliverable: str('deliverable'),
        ownershipStatus: str('ownership-status'),
        sitePlanUrl: str('site-plan-url'),
        notes,
        organisationEntity: num('organisation-entity'),
        point: str('point'),
        summary,
      },
    });
  }

  const links = (root.links ?? {}) as Record<string, unknown>;
  const nextUrl = typeof links.next === 'string' ? links.next : null;

  return { leads, nextUrl, scanned: entities.length };
}

export async function fetchPlanningConsentLeads(
  options: PlanningConsentsScoutOptions = {}
): Promise<PlanningConsentsScoutResult> {
  const now = new Date();
  if (!options.force && now.getDay() !== RUN_DAY) {
    return { leads: [], sitesScanned: 0, pagesFetched: 0, skipped: true };
  }

  const minAge = options.minPermissionAgeMonths ?? MIN_PERMISSION_AGE_MONTHS;
  const maxPages = options.maxPages ?? MAX_PAGES;

  const leads: PlanningConsentRawLead[] = [];
  let url: string | null =
    `${API_ORIGIN}/entity.json?dataset=brownfield-land&limit=${PAGE_SIZE}`;
  let pagesFetched = 0;
  let sitesScanned = 0;
  let firstError: string | undefined;

  while (url && pagesFetched < maxPages) {
    let pageJson: unknown;
    try {
      pageJson = await fetchJson(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (pagesFetched === 0) {
        throw new Error(
          `planning-consents source: brownfield register unreachable — ${msg}`
        );
      }
      firstError = `page ${pagesFetched + 1}: ${msg}`;
      break;
    }
    pagesFetched++;

    const parsed = parseBrownfieldPage(pageJson, {
      minPermissionAgeMonths: minAge,
      now,
    });
    leads.push(...parsed.leads);
    sitesScanned += parsed.scanned;
    if (parsed.scanned === 0) break; // empty page = end, whatever links say
    url = parsed.nextUrl;
  }

  // One lead per site: the register occasionally repeats a site across
  // council submissions; (postcode, address-prefix) collapses those.
  const seen = new Set<string>();
  const deduped = leads.filter((l) => {
    const key = `${l.postcode}|${l.address.toLowerCase().slice(0, 40)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    leads: deduped,
    sitesScanned,
    pagesFetched,
    ...(firstError ? { error: firstError.slice(0, 200) } : {}),
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

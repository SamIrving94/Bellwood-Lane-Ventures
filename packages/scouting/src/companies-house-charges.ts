/**
 * Companies House distress-signal source (companies-house-charges.ts)
 *
 * Surfaces TWO fresh distress signals against property-holding companies:
 *
 *  1. Newly REGISTERED CHARGES — a new lender taking security over a
 *     property company almost always means bridging finance / refinance
 *     under pressure. The owner is paying 0.8–1.5%/month and needs an
 *     exit: a fast, certain cash sale is exactly Bellwood's offer.
 *  2. Fresh INSOLVENCY filings — administration / liquidation /
 *     winding-up events. The office-holder must realise the property
 *     assets quickly; speed + certainty beats price.
 *
 * Why REST polling, not the CH Streaming API: the streaming API needs a
 * persistent long-lived connection which does not fit Vercel cron
 * functions. Instead each run does a stateless, date-bounded poll
 * (default: events delivered in the last 48h, so a daily cron double
 * covers itself and the dedupe in the pipeline collapses repeats).
 *
 * Endpoints (Companies House Public Data API, base
 * https://api.company-information.service.gov.uk — verified 19 Jul 2026
 * via developer-specs.company-information.service.gov.uk):
 *
 *  - Advanced company search — candidate discovery by SIC + status:
 *    GET /advanced-search/companies?sic_codes=…&company_status=active&size=…
 *    https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/search/advanced-company-search
 *  - Charges list per company:
 *    GET /company/{company_number}/charges
 *    https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/charges/list
 *    Item fields (chargeList resource: …/resources/chargelist): created_on,
 *    delivered_on, satisfied_on, status (outstanding | part-satisfied |
 *    fully-satisfied | satisfied), classification{type,description},
 *    particulars{type,description,contains_fixed_charge,…},
 *    persons_entitled[]{name}, charge_code, charge_number.
 *  - Filing history per company (insolvency category):
 *    GET /company/{company_number}/filing-history?category=insolvency&items_per_page=N
 *    https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/filing-history/list
 *
 * Request budget per run (rate limit is 600 req / 5 min):
 *   1 advanced-search call + (2 calls × ≤ MAX_CANDIDATES companies)
 *   = ≤ 41 requests with the default cap of 20 candidates. Well inside
 *   the limit even if the cron ever overlaps itself.
 *
 * Auth: reuses the existing COMPANIES_HOUSE_API_KEY env var (HTTP Basic,
 * key as username, blank password) — same convention as
 * packages/property-data/src/companies-house.ts.
 *
 * Failure contract (mirrors the gazette source): a missing API key or a
 * dead search endpoint THROWS so runScoutingPipeline's `.catch` records
 * sourceErrors and raises one deduped founder action — never a silent
 * skip. Per-company failures degrade gracefully (partial results + the
 * first error surfaced on the result, like the short-lease source).
 */

import 'server-only';

import { extractPostcode } from './address-normalise';

const CH_BASE = 'https://api.company-information.service.gov.uk';
const REQUEST_TIMEOUT_MS = 8_000;

/** Default look-back window: 48h so a daily cron double-covers itself. */
export const DEFAULT_SINCE_HOURS = 48;
/** Hard cap on per-company polling — keeps the run inside ~41 requests. */
export const DEFAULT_MAX_CANDIDATES = 20;

/**
 * Real-estate SIC classes to scan (subset of the codes the dissolved-
 * company source uses — the "owns actual property" classes):
 *  68100 — Buying and selling of own real estate
 *  68209 — Other letting and operating of own or leased real estate
 *  68320 — Management of real estate on a fee or contract basis
 */
export const CH_DISTRESS_SIC_CODES = ['68100', '68209', '68320'] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChCandidateCompany {
  companyNumber: string;
  companyName: string;
  registeredAddress: string | null;
  registeredPostcode: string | null;
}

/** One fresh charge parsed off GET /company/{n}/charges. */
export interface ParsedCharge {
  chargeRef: string;
  /** Date the charge was created (security granted). */
  createdOn: string | null;
  /** Date the charge was delivered to (registered at) Companies House. */
  deliveredOn: string | null;
  status: string;
  /** First entitled person — the lender taking security. */
  lender: string | null;
  classification: string | null;
  /** Concatenated particulars text — often names the charged property. */
  particulars: string | null;
  containsFixedCharge: boolean;
}

/** One fresh insolvency filing parsed off filing-history. */
export interface ParsedInsolvencyFiling {
  transactionId: string;
  filedOn: string;
  filingType: string | null;
  description: string | null;
}

/**
 * Raw-grant-shaped lead matching the loose contract the scouting pipeline
 * consumes (same shape as the probate / short-lease sources).
 */
export interface ChDistressRawLead {
  probateRef: string;
  address: string;
  postcode: string;
  grantDate: string;
  executorName: null;
  solicitorFirm: string | null;
  estateValuePence: number | null;
  grantType: 'unknown';
  source: 'companies_house_charge' | 'companies_house_insolvency';
  daysSinceGrant: number;
  /** Scorer motivation class (see scorer-config leadTypeScores). */
  leadTypeHint: 'mortgage_default' | 'distressed_sale';
  /** Charge detail — flows through rawPayload to the UI. */
  chargeSignal?: {
    companyNumber: string;
    companyName: string;
    chargeRef: string;
    lender: string | null;
    createdOn: string | null;
    deliveredOn: string | null;
    classification: string | null;
    particulars: string | null;
    containsFixedCharge: boolean;
  };
  /** Insolvency detail — flows through rawPayload to the UI. */
  insolvencySignal?: {
    companyNumber: string;
    companyName: string;
    filedOn: string;
    filingType: string | null;
    description: string | null;
  };
}

export interface ChDistressScoutOptions {
  /** Postcode districts to keep candidates in (e.g. ['M14', 'SK4']).
   *  Empty = no geographic filter (first N search hits). */
  districts?: readonly string[];
  /** Look-back window in hours. Default 48. */
  sinceHours?: number;
  /** Max companies polled per run. Default 20. */
  maxCandidates?: number;
  /** Reference "now" — injected for deterministic tests. */
  asOf?: Date;
}

export interface ChDistressScoutResult {
  leads: ChDistressRawLead[];
  /** Companies polled this run. */
  scanned: number;
  /** First per-company error (fatal search errors THROW instead). */
  error?: string;
}

// ---------------------------------------------------------------------------
// HTTP helper (same auth convention as property-data/companies-house.ts)
// ---------------------------------------------------------------------------

async function chGet(
  path: string,
  queryParams: Record<string, string | number> = {},
): Promise<unknown> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY ?? '';
  if (!apiKey) {
    // Mirrors the HMCTS source's missing-key message shape — bubbled up so
    // the pipeline records sourceErrors and alerts the founder.
    throw new Error('COMPANIES_HOUSE_API_KEY not configured');
  }
  const url = new URL(`${CH_BASE}${path}`);
  for (const [k, v] of Object.entries(queryParams)) {
    url.searchParams.set(k, String(v));
  }

  const creds = Buffer.from(`${apiKey}:`).toString('base64');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${creds}`,
      },
      signal: controller.signal,
    });
    if (res.status === 401) throw new Error('Companies House: invalid API key');
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Companies House ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Pure parsers (exported for unit tests — no network)
// ---------------------------------------------------------------------------

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * Parse GET /advanced-search/companies into candidate companies, keeping
 * only those registered in one of our target districts (when given).
 */
export function parseAdvancedSearchCandidates(
  json: unknown,
  districts: readonly string[] = [],
  maxCandidates = DEFAULT_MAX_CANDIDATES,
): ChCandidateCompany[] {
  const items =
    ((json as { items?: unknown[] } | null)?.items as
      | Record<string, unknown>[]
      | undefined) ?? [];
  const wanted = districts.map((d) => d.toUpperCase().replace(/\s+/g, ''));
  const out: ChCandidateCompany[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (out.length >= maxCandidates) break;
    const number = str(item.company_number);
    if (!number || seen.has(number)) continue;

    const addr = item.registered_office_address as
      | Record<string, string | undefined>
      | undefined;
    const postcode = str(addr?.postal_code);
    if (wanted.length > 0) {
      if (!postcode) continue;
      const pc = postcode.toUpperCase().replace(/\s+/g, '');
      if (!wanted.some((d) => pc.startsWith(d))) continue;
    }
    seen.add(number);
    const parts = addr
      ? [addr.address_line_1, addr.address_line_2, addr.locality, addr.postal_code].filter(
          Boolean,
        )
      : [];
    out.push({
      companyNumber: number,
      companyName: str(item.company_name) ?? '(unknown)',
      registeredAddress: parts.length > 0 ? parts.join(', ') : null,
      registeredPostcode: postcode,
    });
  }
  return out;
}

/**
 * Parse GET /company/{n}/charges, keeping only live security registered
 * inside the window: status outstanding/part-satisfied AND
 * (delivered_on ?? created_on) >= cutoff.
 *
 * chargeList item fields per
 * https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/resources/chargelist
 */
export function parseRecentCharges(
  json: unknown,
  cutoffMs: number,
): ParsedCharge[] {
  const items =
    ((json as { items?: unknown[] } | null)?.items as
      | Record<string, unknown>[]
      | undefined) ?? [];
  const out: ParsedCharge[] = [];

  for (const item of items) {
    const status = str(item.status) ?? 'unknown';
    // Satisfied security is a RESOLVED signal — skip.
    if (status !== 'outstanding' && status !== 'part-satisfied') continue;

    const createdOn = str(item.created_on);
    const deliveredOn = str(item.delivered_on);
    const eventDate = deliveredOn ?? createdOn;
    if (!eventDate) continue;
    const eventMs = new Date(eventDate).getTime();
    if (!Number.isFinite(eventMs) || eventMs < cutoffMs) continue;

    // classification is documented as an object {type, description} but some
    // responses carry an array — accept both.
    const classifications = Array.isArray(item.classification)
      ? (item.classification as Record<string, unknown>[])
      : item.classification
        ? [item.classification as Record<string, unknown>]
        : [];
    const classification =
      classifications.map((c) => str(c.description)).find(Boolean) ?? null;

    const particularsArr = Array.isArray(item.particulars)
      ? (item.particulars as Record<string, unknown>[])
      : item.particulars
        ? [item.particulars as Record<string, unknown>]
        : [];
    const particularsText =
      particularsArr
        .map((p) => str(p.description))
        .filter(Boolean)
        .join(' ') || null;
    const containsFixedCharge = particularsArr.some(
      (p) => p.contains_fixed_charge === true,
    );

    const persons = Array.isArray(item.persons_entitled)
      ? (item.persons_entitled as Record<string, unknown>[])
      : [];
    const lender = persons.map((p) => str(p.name)).find(Boolean) ?? null;

    out.push({
      chargeRef:
        str(item.charge_code) ??
        (typeof item.charge_number === 'number'
          ? String(item.charge_number)
          : (str(item.charge_number) ?? eventDate)),
      createdOn,
      deliveredOn,
      status,
      lender,
      classification,
      particulars: particularsText,
      containsFixedCharge,
    });
  }
  return out;
}

/**
 * Parse GET /company/{n}/filing-history?category=insolvency, keeping only
 * insolvency-category filings dated inside the window.
 */
export function parseRecentInsolvencyFilings(
  json: unknown,
  cutoffMs: number,
): ParsedInsolvencyFiling[] {
  const items =
    ((json as { items?: unknown[] } | null)?.items as
      | Record<string, unknown>[]
      | undefined) ?? [];
  const out: ParsedInsolvencyFiling[] = [];

  for (const item of items) {
    // The category filter is applied server-side, but re-check defensively.
    if (str(item.category) !== 'insolvency') continue;
    const filedOn = str(item.date);
    if (!filedOn) continue;
    const filedMs = new Date(filedOn).getTime();
    if (!Number.isFinite(filedMs) || filedMs < cutoffMs) continue;

    out.push({
      transactionId:
        str(item.transaction_id) ?? `${filedOn}-${str(item.type) ?? 'ins'}`,
      filedOn,
      filingType: str(item.type),
      description: str(item.description),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mapping to raw leads (exported for unit tests)
// ---------------------------------------------------------------------------

function daysSince(dateISO: string, asOf: Date): number {
  const ms = new Date(dateISO).getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.floor((asOf.getTime() - ms) / 86_400_000));
}

/**
 * Map a fresh charge to a pipeline lead. Address preference:
 *  1. Charge particulars, when they name the charged property (a postcode
 *     found in the text) — that IS the distressed asset.
 *  2. Registered office (the fallback the dissolved source uses).
 * Returns null when neither yields an address + postcode (never guesses).
 */
export function mapChargeToLead(
  company: ChCandidateCompany,
  charge: ParsedCharge,
  asOf: Date = new Date(),
): ChDistressRawLead | null {
  const particularsPostcode = charge.particulars
    ? extractPostcode(charge.particulars)
    : null;

  let address: string | null = null;
  let postcode: string | null = null;
  if (particularsPostcode && charge.particulars) {
    postcode = particularsPostcode.toUpperCase();
    // Keep the human-readable particulars (truncated) as the address line.
    address = charge.particulars.replace(/\s+/g, ' ').trim().slice(0, 160);
  } else if (company.registeredAddress && company.registeredPostcode) {
    address = company.registeredAddress;
    postcode = company.registeredPostcode.toUpperCase();
  }
  if (!address || !postcode) return null;

  const eventDate =
    charge.deliveredOn ?? charge.createdOn ?? asOf.toISOString().slice(0, 10);
  return {
    probateRef: `chc-${company.companyNumber}-${charge.chargeRef.replace(/\s+/g, '_')}`,
    address,
    postcode,
    grantDate: eventDate,
    executorName: null,
    solicitorFirm: company.companyName,
    estateValuePence: null,
    grantType: 'unknown',
    source: 'companies_house_charge',
    daysSinceGrant: daysSince(eventDate, asOf),
    leadTypeHint: 'mortgage_default',
    chargeSignal: {
      companyNumber: company.companyNumber,
      companyName: company.companyName,
      chargeRef: charge.chargeRef,
      lender: charge.lender,
      createdOn: charge.createdOn,
      deliveredOn: charge.deliveredOn,
      classification: charge.classification,
      particulars: charge.particulars,
      containsFixedCharge: charge.containsFixedCharge,
    },
  };
}

/**
 * Map a fresh insolvency filing to a pipeline lead (registered office
 * address — the property schedule comes later via the office-holder).
 */
export function mapInsolvencyToLead(
  company: ChCandidateCompany,
  filing: ParsedInsolvencyFiling,
  asOf: Date = new Date(),
): ChDistressRawLead | null {
  if (!company.registeredAddress || !company.registeredPostcode) return null;
  return {
    probateRef: `chi-${company.companyNumber}-${filing.transactionId.replace(/\s+/g, '_')}`,
    address: company.registeredAddress,
    postcode: company.registeredPostcode.toUpperCase(),
    grantDate: filing.filedOn,
    executorName: null,
    solicitorFirm: company.companyName,
    estateValuePence: null,
    grantType: 'unknown',
    source: 'companies_house_insolvency',
    daysSinceGrant: daysSince(filing.filedOn, asOf),
    leadTypeHint: 'distressed_sale',
    insolvencySignal: {
      companyNumber: company.companyNumber,
      companyName: company.companyName,
      filedOn: filing.filedOn,
      filingType: filing.filingType,
      description: filing.description,
    },
  };
}

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

/**
 * Poll Companies House for fresh charge + insolvency distress signals
 * against property-holding companies in our target districts.
 *
 * Stateless per run: one advanced-search call for candidates, then two
 * calls per candidate (charges + insolvency filing history), keeping only
 * events inside the `sinceHours` window. THROWS on missing API key or a
 * failed candidate search (the pipeline's `.catch` records it); tolerates
 * per-company failures with partial results.
 */
export async function fetchCompaniesHouseDistressLeads(
  options: ChDistressScoutOptions = {},
): Promise<ChDistressScoutResult> {
  const districts = options.districts ?? [];
  const sinceHours = options.sinceHours ?? DEFAULT_SINCE_HOURS;
  const maxCandidates = options.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  const asOf = options.asOf ?? new Date();
  const cutoffMs = asOf.getTime() - sinceHours * 3_600_000;

  // ---- 1. Candidate discovery (1 request) ----
  // NOT wrapped: a search failure (or missing key, thrown inside chGet)
  // must reject so the pipeline surfaces it — never a silent zero-lead run.
  const searchJson = await chGet('/advanced-search/companies', {
    sic_codes: CH_DISTRESS_SIC_CODES.join(','),
    company_status: 'active',
    // Over-fetch so the district filter still leaves ~maxCandidates.
    size: 200,
  });
  const candidates = parseAdvancedSearchCandidates(
    searchJson,
    districts,
    maxCandidates,
  );

  // ---- 2. Per-company polling (2 requests each, serial) ----
  const leads: ChDistressRawLead[] = [];
  let firstError: string | undefined;
  let scanned = 0;

  for (const company of candidates) {
    scanned++;
    try {
      const [chargesJson, filingsJson] = await Promise.all([
        chGet(`/company/${company.companyNumber}/charges`),
        chGet(`/company/${company.companyNumber}/filing-history`, {
          category: 'insolvency',
          items_per_page: 10,
        }),
      ]);

      for (const charge of parseRecentCharges(chargesJson, cutoffMs)) {
        const lead = mapChargeToLead(company, charge, asOf);
        if (lead) leads.push(lead);
      }
      // One insolvency lead per company is enough — the freshest filing.
      const filings = parseRecentInsolvencyFilings(filingsJson, cutoffMs);
      if (filings.length > 0) {
        const lead = mapInsolvencyToLead(company, filings[0]!, asOf);
        if (lead) leads.push(lead);
      }
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      if (!firstError) {
        firstError = `${company.companyNumber}: ${msg.slice(0, 150)}`;
      }
      console.warn(
        `[scouting/ch-distress] poll failed for ${company.companyNumber}`,
        err,
      );
    }
  }

  console.info(
    `[scouting/ch-distress] candidates=${candidates.length} scanned=${scanned} leads=${leads.length}`,
  );
  return { leads, scanned, error: firstError };
}

/**
 * EPC client — Energy Performance of Buildings Data API (MHCLG, 2026 service)
 *
 * MIGRATION NOTE (July 2026): the old EPC Register open-data API at
 * https://epc.opendatacommunities.org/ was RETIRED on 30 May 2026 (it now
 * serves HTML, so the old Basic-auth JSON calls silently fail). This client
 * targets the replacement service:
 *
 *   Service:   https://get-energy-performance-data.communities.gov.uk/
 *   API base:  https://api.get-energy-performance-data.communities.gov.uk
 *   Docs:      https://get-energy-performance-data.communities.gov.uk/api-technical-documentation
 *   Requests:  https://get-energy-performance-data.communities.gov.uk/api-technical-documentation/making-a-request
 *   Search:    https://get-energy-performance-data.communities.gov.uk/api-technical-documentation/search-certificates/domestic
 *   OpenAPI:   https://raw.githubusercontent.com/communitiesuk/epb-data-warehouse/main/api/api.yml
 *
 * Auth (per "making-a-request" doc): a Bearer token, NOT the old Basic
 * email:api-key pair. Sign in to the service with GOV.UK One Login and copy
 * the token from the "My account" page.
 *
 * Required env var (see keys.ts):
 *   EPC_API_TOKEN — bearer token from the My account page of
 *                   get-energy-performance-data.communities.gov.uk
 *
 * (The old EPC_API_EMAIL / EPC_API_KEY vars are dead — the endpoints that
 * accepted them no longer exist.)
 *
 * Lookup is now two calls (the search response only carries address + band):
 *   1. GET /api/domestic/search?postcode=...&address=...  → certificateNumber
 *   2. GET /api/certificate?certificate_number=...        → full EPC document
 *
 * Rate limit: 6000 requests / 5 min / IP (HTTP 429 beyond that) — per
 * /api-technical-documentation.
 *
 * REAL DATA OR NOTHING: this client never fabricates values. When credentials
 * are absent, the call fails, or no certificate is found, it returns an
 * `unavailable` record with every data field null — so downstream code shows
 * nothing rather than a made-up number.
 */

import { z } from 'zod';

const EPC_API_BASE =
  'https://api.get-energy-performance-data.communities.gov.uk';

const REQUEST_TIMEOUT_MS = 8_000;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const EPC_RATINGS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

export const EpcSchema = z.object({
  postcode: z.string(),
  epcRating: z.enum(EPC_RATINGS).nullable(),
  epcScore: z.number().nullable(),
  propertyType: z.string().nullable(),
  floorAreaSqm: z.number().nullable(),
  constructionAgeBand: z.string().nullable(),
  heatingType: z.string().nullable(),
  totalBedrooms: z.number().nullable(),
  inspectionDate: z.string().nullable(),
  source: z.string(),
});

export type Epc = z.infer<typeof EpcSchema>;

// ---------------------------------------------------------------------------
// "Unavailable" record — no data, no guesses
// ---------------------------------------------------------------------------

/**
 * The null-object returned when we have no real EPC certificate. Every data
 * field is null and `source` is 'unavailable' so callers can tell real data
 * from no-data and render nothing rather than a fabricated value.
 */
function unavailableEpc(postcode: string): Epc {
  return {
    postcode,
    epcRating: null,
    epcScore: null,
    propertyType: null,
    floorAreaSqm: null,
    constructionAgeBand: null,
    heatingType: null,
    totalBedrooms: null,
    inspectionDate: null,
    source: 'unavailable',
  };
}

// ---------------------------------------------------------------------------
// Response parsing (exported for fixture tests — no network involved)
// ---------------------------------------------------------------------------

/**
 * Shape of GET /api/domestic/search — see
 * https://get-energy-performance-data.communities.gov.uk/api-technical-documentation/search-certificates/domestic
 * Fields are camelCase; certificateNumber keys the follow-up fetch.
 */
interface DomesticSearchResponse {
  data?: Array<{
    certificateNumber?: string;
    postcode?: string;
    registrationDate?: string;
    currentEnergyEfficiencyBand?: string;
  }>;
}

/**
 * Pick the most recently registered certificate from a domestic search
 * response. Returns null when the response has no usable rows.
 */
export function pickLatestCertificateNumber(
  body: unknown
): string | null {
  const rows = (body as DomesticSearchResponse)?.data;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const sorted = [...rows]
    .filter((r) => typeof r?.certificateNumber === 'string')
    .sort((a, b) =>
      String(b.registrationDate ?? '').localeCompare(
        String(a.registrationDate ?? '')
      )
    );
  return sorted[0]?.certificateNumber ?? null;
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

/**
 * Map a GET /api/certificate response body onto our stable `Epc` shape.
 *
 * The document is snake_case and its exact keys vary by lodgement schema
 * (RdSAP/SAP versions) — per
 * https://get-energy-performance-data.communities.gov.uk/api-technical-documentation/fetch-certificate-data
 * Field names below match the RdSAP JSON export sample in the service's
 * warehouse repo:
 * https://github.com/communitiesuk/epb-data-warehouse/blob/main/spec/fixtures/json_export/rdsap.json
 */
export function parseCertificateResponse(
  body: unknown,
  fallbackPostcode: string
): Epc {
  const doc = ((body as { data?: unknown })?.data ?? {}) as Record<
    string,
    unknown
  >;
  const address = (doc.address ?? {}) as Record<string, unknown>;
  const propertyType = (doc.property_type ?? {}) as Record<string, unknown>;
  const ageBand = (doc.construction_age_band ?? {}) as Record<string, unknown>;
  const heating = doc.main_heating_descriptions;

  // Band arrives lowercase in the export samples (e.g. "e") — normalise.
  const rawRating = str(doc.current_energy_efficiency_band)?.toUpperCase();
  const epcRating =
    rawRating && (EPC_RATINGS as readonly string[]).includes(rawRating)
      ? (rawRating as (typeof EPC_RATINGS)[number])
      : null;

  return {
    postcode: str(address.postcode) ?? fallbackPostcode,
    epcRating,
    epcScore: num(doc.current_energy_efficiency_rating),
    // property_type.description ("House"/"Flat"…) matches the old API's
    // property-type column; dwelling_type ("Mid-terrace house") as fallback.
    propertyType:
      str(propertyType.description) ?? str(doc.dwelling_type) ?? null,
    floorAreaSqm: num(doc.total_floor_area),
    // construction_age_band.description is the same human string the old API
    // returned (e.g. "England and Wales: 2007-2011").
    constructionAgeBand: str(ageBand.description) ?? null,
    heatingType: Array.isArray(heating) ? str(heating[0]) : str(heating),
    // The new certificate document has no bedroom count (only
    // habitable_room_count, which is NOT bedrooms). The old client queried a
    // "number-bedrooms" column that the old API never populated either, so
    // this stays null rather than conflating rooms with bedrooms.
    totalBedrooms: null,
    inspectionDate: str(doc.date_of_assessment),
    source: 'epc_register',
  };
}

// ---------------------------------------------------------------------------
// Live fetch
// ---------------------------------------------------------------------------

async function apiGet(path: string, token: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${EPC_API_BASE}${path}`, {
      headers: {
        Accept: 'application/json',
        // Bearer token from the service's My account page — see
        // .../api-technical-documentation/making-a-request
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    if (res.status === 401)
      throw new Error('EPC API: invalid bearer token (EPC_API_TOKEN)');
    if (res.status === 404) throw new Error('No EPC records found');
    if (res.status === 429) throw new Error('EPC API: rate limited (429)');
    if (!res.ok) throw new Error(`EPC API ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchEpcLive(
  postcode: string,
  token: string,
  address?: string
): Promise<Epc> {
  // Step 1: search domestic certificates by postcode (and optional address)
  const params = new URLSearchParams();
  if (postcode) params.set('postcode', postcode.toUpperCase().trim());
  if (address) params.set('address', address);
  params.set('page_size', '10');

  const search = await apiGet(
    `/api/domestic/search?${params.toString()}`,
    token
  );
  const certificateNumber = pickLatestCertificateNumber(search);
  if (!certificateNumber) throw new Error('No EPC records found');

  // Step 2: fetch the full certificate document
  const cert = await apiGet(
    `/api/certificate?certificate_number=${encodeURIComponent(certificateNumber)}`,
    token
  );
  return parseCertificateResponse(cert, postcode);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up EPC data for a postcode (and optionally an address string).
 * Returns an `unavailable` record (all fields null) when credentials are
 * absent or the call fails — never synthetic data.
 */
export async function getEpcData(
  postcode: string,
  address?: string
): Promise<Epc> {
  const token = process.env.EPC_API_TOKEN ?? '';

  if (token) {
    try {
      return await fetchEpcLive(postcode, token, address);
    } catch (err) {
      console.warn(
        `[property-data/epc] live fetch failed (${(err as Error).message}) — returning unavailable (no synthetic)`
      );
    }
  }
  return unavailableEpc(postcode);
}

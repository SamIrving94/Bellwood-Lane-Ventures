/**
 * EPC Register API client (MHCLG / Open Data Communities)
 *
 * Free API for Energy Performance Certificate data in England & Wales.
 * Register at: https://epc.opendatacommunities.org/
 *
 * Required env vars (see keys.ts):
 *   EPC_API_EMAIL  — email address used to register
 *   EPC_API_KEY    — API key from the dashboard
 *
 * Auth: HTTP Basic auth (email:key base64-encoded)
 *
 * REAL DATA OR NOTHING: this client never fabricates values. When credentials
 * are absent, the call fails, or no certificate is found, it returns an
 * `unavailable` record with every data field null — so downstream code shows
 * nothing rather than a made-up number. (It used to fall back to random
 * synthetic data, which silently drove the AVM/refurb off a fake floor area.)
 */

import { z } from 'zod';

const EPC_BASE =
  'https://epc.opendatacommunities.org/api/v1/domestic/search';

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
// Live fetch
// ---------------------------------------------------------------------------

async function fetchEpcLive(postcode: string, address?: string): Promise<Epc> {
  const email = process.env.EPC_API_EMAIL ?? '';
  const key = process.env.EPC_API_KEY ?? '';

  const url = new URL(EPC_BASE);
  if (postcode) url.searchParams.set('postcode', postcode.toUpperCase().trim());
  if (address) url.searchParams.set('address', address);
  url.searchParams.set('size', '5');

  const creds = Buffer.from(`${email}:${key}`).toString('base64');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let data: unknown;
  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${creds}`,
      },
      signal: controller.signal,
    });
    if (res.status === 401)
      throw new Error('EPC API: invalid credentials');
    if (!res.ok)
      throw new Error(`EPC API ${res.status}`);
    data = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const raw = data as Record<string, unknown>;
  const rows = (raw.rows as unknown[][] | undefined) ?? [];
  if (!rows.length) throw new Error('No EPC records found');

  const cols = (raw['column-names'] as string[] | undefined) ?? [];
  const row = rows[0]!;

  function col(name: string): string | undefined {
    const idx = cols.indexOf(name);
    return idx >= 0 ? String(row[idx] ?? '') || undefined : undefined;
  }

  const rawRating = col('current-energy-rating') ?? col('potential-energy-rating');
  const epcRating =
    rawRating && (EPC_RATINGS as readonly string[]).includes(rawRating)
      ? (rawRating as (typeof EPC_RATINGS)[number])
      : null;

  return {
    postcode: col('postcode') ?? postcode,
    epcRating,
    epcScore: parseInt(col('current-energy-efficiency') ?? '0', 10) || null,
    propertyType: col('property-type') ?? null,
    floorAreaSqm: parseFloat(col('total-floor-area') ?? '0') || null,
    constructionAgeBand: col('construction-age-band') ?? null,
    heatingType:
      col('main-heating-description') ??
      col('mainheat-description') ??
      null,
    totalBedrooms:
      parseInt(col('number-bedrooms') ?? '0', 10) || null,
    inspectionDate: col('inspection-date') ?? null,
    source: 'epc_register',
  };
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
  const email = process.env.EPC_API_EMAIL ?? '';
  const key = process.env.EPC_API_KEY ?? '';

  if (email && key) {
    try {
      return await fetchEpcLive(postcode, address);
    } catch (err) {
      console.warn(
        `[property-data/epc] live fetch failed (${(err as Error).message}) — returning unavailable (no synthetic)`
      );
    }
  }
  return unavailableEpc(postcode);
}

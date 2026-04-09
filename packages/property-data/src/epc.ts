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
 * Falls back to synthetic data when credentials are absent or the call fails.
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
// Synthetic fallback
// ---------------------------------------------------------------------------

const PROPERTY_TYPES = [
  'Semi-detached house',
  'Terraced house',
  'Detached house',
  'Flat',
];
const CONSTRUCTION_ERAS = [
  '1900-1929',
  '1930-1949',
  '1950-1966',
  '1967-1975',
  '1976-1982',
  '1983-1990',
  '1991-1995',
  '1996-2002',
  '2003-2006',
  '2007-2011',
  '2012 onwards',
];
const RATING_SCORES: Record<string, number> = {
  A: 92, B: 82, C: 72, D: 60, E: 48, F: 36, G: 20,
};

function syntheticEpc(postcode: string): Epc {
  const ratingIdx = Math.floor(Math.random() * EPC_RATINGS.length);
  const rating = EPC_RATINGS[ratingIdx] ?? 'D';
  const baseScore = RATING_SCORES[rating] ?? 60;
  const score = Math.min(baseScore + Math.floor(Math.random() * 8), 100);

  return {
    postcode,
    epcRating: rating,
    epcScore: score,
    propertyType:
      PROPERTY_TYPES[Math.floor(Math.random() * PROPERTY_TYPES.length)] ??
      null,
    floorAreaSqm: 60 + Math.floor(Math.random() * 140),
    constructionAgeBand:
      CONSTRUCTION_ERAS[
        Math.floor(Math.random() * CONSTRUCTION_ERAS.length)
      ] ?? null,
    heatingType: Math.random() > 0.3 ? 'Gas' : 'Electric',
    totalBedrooms: 2 + Math.floor(Math.random() * 4),
    inspectionDate: new Date(
      Date.now() - Math.floor(Math.random() * 5 * 365 * 86_400_000)
    )
      .toISOString()
      .slice(0, 10),
    source: 'synthetic',
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
 * Falls back to synthetic data when credentials are absent or the call fails.
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
        `[property-data/epc] live fetch failed (${(err as Error).message}), using synthetic`
      );
    }
  }
  return syntheticEpc(postcode);
}

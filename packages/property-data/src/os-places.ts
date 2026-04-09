/**
 * OS Places API client (Ordnance Survey Data Hub)
 *
 * Used for canonical UK address normalisation and UPRN resolution.
 * A UPRN (Unique Property Reference Number) is the stable identifier used
 * across all government property datasets.
 *
 * Free tier: 250,000 API transactions/month via OS Data Hub
 * Register at: https://osdatahub.os.uk/
 *
 * Required env var (see keys.ts):
 *   OS_PLACES_API_KEY  — API key from OS Data Hub dashboard
 *
 * Falls back to a synthetic UPRN when credentials are absent or the call fails.
 */

import { z } from 'zod';

const OS_BASE = 'https://api.os.uk/search/places/v1';

const REQUEST_TIMEOUT_MS = 8_000;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const OsPlaceSchema = z.object({
  uprn: z.string().nullable(),
  address: z.string().nullable(),
  postcode: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  classificationCode: z.string().nullable(),
  source: z.string(),
});

export type OsPlace = z.infer<typeof OsPlaceSchema>;

// ---------------------------------------------------------------------------
// Synthetic fallback
// ---------------------------------------------------------------------------

function normaliseAddress(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').replace(/,\s*/g, ', ').toUpperCase();
}

function syntheticUprn(address: string, postcode: string): OsPlace {
  // Generate a stable-ish synthetic UPRN from the combined address string
  let hash = 10_000_000_000;
  const str = `${address}${postcode}`.toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + (str.charCodeAt(i) | 0)) >>> 0;
  }
  const uprn = String(100_000_000_000 + (hash % 900_000_000_000)).slice(0, 12);

  return {
    uprn,
    address: address ? normaliseAddress(address) : null,
    postcode: postcode ? postcode.toUpperCase().trim() : null,
    latitude: null,
    longitude: null,
    classificationCode: 'RD', // Residential Dwelling
    source: 'synthetic',
  };
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function osGet(
  path: string,
  params: Record<string, string | number>
): Promise<unknown> {
  const apiKey = process.env.OS_PLACES_API_KEY ?? '';
  const url = new URL(`${OS_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  if (apiKey) url.searchParams.set('key', apiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403)
      throw new Error('OS Places: invalid API key');
    if (!res.ok) throw new Error(`OS Places ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Parse OS Places result item
// ---------------------------------------------------------------------------

function parseResult(item: Record<string, unknown>): OsPlace {
  const dpa =
    (item.DPA as Record<string, unknown> | undefined) ??
    (item.LPI as Record<string, unknown> | undefined) ??
    {};

  return {
    uprn: (dpa.UPRN as string | undefined) ?? null,
    address:
      (dpa.ADDRESS as string | undefined) ??
      (dpa.LPI_KEY as string | undefined) ??
      null,
    postcode:
      (dpa.POSTCODE as string | undefined) ??
      (dpa.POSTAL_CODE as string | undefined) ??
      null,
    latitude: (dpa.LAT as number | undefined) ?? null,
    longitude: (dpa.LNG as number | undefined) ?? null,
    classificationCode:
      (dpa.CLASSIFICATION_CODE as string | undefined) ?? null,
    source: 'os_places',
  };
}

// ---------------------------------------------------------------------------
// Live fetch helpers
// ---------------------------------------------------------------------------

async function lookupByPostcodeLive(postcode: string): Promise<OsPlace[]> {
  const data = (await osGet('/postcode', {
    postcode: postcode.toUpperCase().trim(),
    maxresults: 10,
    dataset: 'DPA',
  })) as Record<string, unknown>;

  const results = (data.results as Record<string, unknown>[] | undefined) ?? [];
  return results.map(parseResult);
}

async function lookupByAddressLive(address: string): Promise<OsPlace[]> {
  const data = (await osGet('/find', {
    query: address,
    maxresults: 5,
    dataset: 'DPA',
  })) as Record<string, unknown>;

  const results = (data.results as Record<string, unknown>[] | undefined) ?? [];
  return results.map(parseResult);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up all residential addresses within a postcode, returning their UPRNs.
 */
export async function lookupByPostcode(postcode: string): Promise<OsPlace[]> {
  const apiKey = process.env.OS_PLACES_API_KEY ?? '';
  if (apiKey) {
    try {
      const results = await lookupByPostcodeLive(postcode);
      if (results.length) return results;
    } catch (err) {
      console.warn(
        `[property-data/os-places] postcode lookup failed (${(err as Error).message}), using synthetic`
      );
    }
  }
  return [syntheticUprn('', postcode)];
}

/**
 * Resolve a free-text address to a canonical OS Places record with UPRN.
 * Returns the best-matching result or a synthetic fallback.
 */
export async function resolveAddress(
  address: string,
  postcode?: string
): Promise<OsPlace> {
  const query = postcode ? `${address} ${postcode}` : address;
  const apiKey = process.env.OS_PLACES_API_KEY ?? '';

  if (apiKey) {
    try {
      const results = await lookupByAddressLive(query);
      if (results.length && results[0]) return results[0];
    } catch (err) {
      console.warn(
        `[property-data/os-places] address resolve failed (${(err as Error).message}), using synthetic`
      );
    }
  }
  return syntheticUprn(address, postcode ?? '');
}

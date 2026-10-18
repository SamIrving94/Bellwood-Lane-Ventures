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
 * When credentials are absent or the call fails, the record comes back with
 * `uprn: null` and `source: 'unavailable'`. It used to hash the address into
 * a "synthetic" UPRN; that is a fabricated identifier, and a fake UPRN that
 * looks real is exactly what downstream joins would trust (the SW3 rule).
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
// Unresolved fallback
// ---------------------------------------------------------------------------

function normaliseAddress(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').replace(/,\s*/g, ', ').toUpperCase();
}

/** The address we were given, tidied, with no identifier attached. */
function unresolvedPlace(address: string, postcode: string): OsPlace {
  return {
    uprn: null,
    address: address ? normaliseAddress(address) : null,
    postcode: postcode ? postcode.toUpperCase().trim() : null,
    latitude: null,
    longitude: null,
    classificationCode: null,
    source: 'unavailable',
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
    classificationCode: (dpa.CLASSIFICATION_CODE as string | undefined) ?? null,
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
 * Free-text search returning up to N OsPlace suggestions. Used by
 * typeahead UIs where the user types a town, area, or partial postcode
 * and we want a ranked list of matches.
 *
 * Returns [] (not synthetic) on failure so the UI can fall back to its
 * own resolver or show "no suggestions".
 */
export async function findPlaces(query: string, limit = 8): Promise<OsPlace[]> {
  const apiKey = process.env.OS_PLACES_API_KEY ?? '';
  if (!apiKey || !query.trim()) return [];
  try {
    const data = (await osGet('/find', {
      query,
      maxresults: limit,
      dataset: 'DPA',
    })) as Record<string, unknown>;
    const results =
      (data.results as Record<string, unknown>[] | undefined) ?? [];
    return results.map(parseResult).filter((r) => !!r.postcode);
  } catch (err) {
    console.warn(
      `[property-data/os-places] findPlaces failed: ${(err as Error).message}`
    );
    return [];
  }
}

/**
 * Look up addresses within a postcode (first 10), returning their UPRNs.
 * Empty when OS can't answer.
 */
export async function lookupByPostcode(postcode: string): Promise<OsPlace[]> {
  const apiKey = process.env.OS_PLACES_API_KEY ?? '';
  if (apiKey) {
    try {
      const results = await lookupByPostcodeLive(postcode);
      if (results.length) return results;
    } catch (err) {
      console.warn(
        `[property-data/os-places] postcode lookup failed (${(err as Error).message})`
      );
    }
  }
  return [];
}

/** OS Places caps one page at 100; a unit postcode rarely passes 300. */
const POSTCODE_PAGE_SIZE = 100;
const POSTCODE_MAX_PAGES = 3;

/**
 * Every addressable record in a postcode, for UPRN matching. Distinguishes
 * "OS couldn't answer" (null: no key, or the call failed) from "OS answered
 * and the postcode is empty" ([]), so a resolver never records an outage as
 * a confirmed no-match.
 */
export async function listPostcodeAddresses(
  postcode: string
): Promise<OsPlace[] | null> {
  if (!process.env.OS_PLACES_API_KEY) return null;
  const out: OsPlace[] = [];
  try {
    for (let page = 0; page < POSTCODE_MAX_PAGES; page++) {
      const data = (await osGet('/postcode', {
        postcode: postcode.toUpperCase().trim(),
        maxresults: POSTCODE_PAGE_SIZE,
        offset: page * POSTCODE_PAGE_SIZE,
        dataset: 'DPA',
      })) as Record<string, unknown>;
      const results =
        (data.results as Record<string, unknown>[] | undefined) ?? [];
      out.push(...results.map(parseResult));
      const total = Number(
        (data.header as Record<string, unknown> | undefined)?.totalresults
      );
      if (results.length < POSTCODE_PAGE_SIZE || out.length >= total) break;
    }
    return out;
  } catch (err) {
    // OS answers an unknown postcode with 400; that is "no addresses", not
    // an outage.
    if ((err as Error).message === 'OS Places 400') return [];
    console.warn(
      `[property-data/os-places] listPostcodeAddresses failed for ${postcode}: ${(err as Error).message}`
    );
    return null;
  }
}

/**
 * Resolve a free-text address to a canonical OS Places record.
 *
 * Returns OS's top hit, which is a search ranking, not a verified match. For
 * an identifier to store against a lead or deal, use `resolveUprn` (it
 * checks house number, flat and street). Without a key or on failure the
 * record carries `uprn: null`.
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
        `[property-data/os-places] address resolve failed (${(err as Error).message})`
      );
    }
  }
  return unresolvedPlace(address, postcode ?? '');
}

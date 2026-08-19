/**
 * postcodes.io — free, keyless UK postcode → coordinates lookup.
 *
 * Used to compute the real distance (in miles) between a subject property and
 * each sold comparable, so the AVM can weight nearby comps more heavily. No
 * API key, no credit cost. Falls back to null on any failure — callers must
 * handle a missing coordinate gracefully (the comp is simply dropped from the
 * distance-weighted set rather than mis-placed).
 *
 * Bulk endpoint accepts up to 100 postcodes per POST request.
 */

const BASE = 'https://api.postcodes.io';
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — postcodes don't move

export type LatLng = { latitude: number; longitude: number };

const cache = new Map<string, { value: LatLng | null; expiresAt: number }>();

function normalise(postcode: string): string {
  return postcode.toUpperCase().replace(/\s+/g, '');
}

function cacheGet(key: string): LatLng | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

async function withTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Single postcode → coordinates (null if not found / on error). */
export async function geocodePostcode(
  postcode: string
): Promise<LatLng | null> {
  const key = normalise(postcode);
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  try {
    const res = await withTimeout(
      `${BASE}/postcodes/${encodeURIComponent(key)}`,
      {
        headers: { Accept: 'application/json' },
      }
    );
    if (!res.ok) {
      cache.set(key, { value: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }
    const json = (await res.json()) as {
      result?: { latitude?: number; longitude?: number };
    };
    const r = json.result;
    const value =
      r && typeof r.latitude === 'number' && typeof r.longitude === 'number'
        ? { latitude: r.latitude, longitude: r.longitude }
        : null;
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch {
    return null;
  }
}

/**
 * Bulk postcode → coordinates. Returns a Map keyed by the *normalised*
 * postcode (uppercase, no spaces). Postcodes that fail to resolve are simply
 * absent from the map. Chunks requests at 100 per the API limit and serves
 * cached entries without a network round-trip.
 */
export async function geocodePostcodes(
  postcodes: string[]
): Promise<Map<string, LatLng>> {
  const out = new Map<string, LatLng>();
  const toFetch: string[] = [];

  for (const raw of postcodes) {
    const key = normalise(raw);
    if (!key) continue;
    const cached = cacheGet(key);
    if (cached !== undefined) {
      if (cached) out.set(key, cached);
    } else if (!toFetch.includes(key)) {
      toFetch.push(key);
    }
  }

  for (let i = 0; i < toFetch.length; i += 100) {
    const chunk = toFetch.slice(i, i + 100);
    try {
      const res = await withTimeout(`${BASE}/postcodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ postcodes: chunk }),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        result?: Array<{
          query: string;
          result: { latitude?: number; longitude?: number } | null;
        }>;
      };
      for (const entry of json.result ?? []) {
        const key = normalise(entry.query);
        const r = entry.result;
        const value =
          r && typeof r.latitude === 'number' && typeof r.longitude === 'number'
            ? { latitude: r.latitude, longitude: r.longitude }
            : null;
        cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
        if (value) out.set(key, value);
      }
    } catch {
      // chunk failed — leave those postcodes unresolved, caller drops them
    }
  }

  return out;
}

/**
 * Outcode (postcode district) resolution.
 *
 * Added for the scouting area-add flow after the SW3 incident: the resolver
 * used to fabricate `"<DISTRICT> 1AA"` for districts missing from its
 * hand-curated table and hope PropertyData accepted it. SW3 1AA does not
 * exist, PropertyData answered 422, and the failure surfaced days later as a
 * truncated probe error. These two functions make ANY real UK district
 * resolvable with no table maintenance — and make "we do not know this
 * district" a first-class answer instead of a guess.
 *
 * The results are discriminated three ways on purpose. `not-found` is a fact
 * about the input (cacheable: ZZ99 will not exist tomorrow either), while
 * `unavailable` is a fact about the network right now (never cached — the
 * next attempt may succeed, and caching it would turn a blip into a 30-day
 * outage for that district).
 */

export type OutcodeLookup =
  | { outcome: 'found'; centroid: LatLng }
  | { outcome: 'not-found' }
  | { outcome: 'unavailable' };

export type OutcodeSeed =
  | { outcome: 'found'; postcode: string }
  | { outcome: 'not-found' }
  | { outcome: 'unavailable' };

const outcodeCache = new Map<
  string,
  { value: LatLng | null; expiresAt: number }
>();

/** Outcode → centroid. `not-found` (404) is cached; `unavailable` is not. */
export async function lookupOutcode(outcode: string): Promise<OutcodeLookup> {
  const key = normalise(outcode);
  const cached = outcodeCache.get(key);
  if (cached && cached.expiresAt >= Date.now()) {
    return cached.value
      ? { outcome: 'found', centroid: cached.value }
      : { outcome: 'not-found' };
  }

  try {
    const res = await withTimeout(
      `${BASE}/outcodes/${encodeURIComponent(key)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (res.status === 404) {
      outcodeCache.set(key, {
        value: null,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return { outcome: 'not-found' };
    }
    if (!res.ok) {
      return { outcome: 'unavailable' };
    }
    const json = (await res.json()) as {
      result?: { latitude?: number; longitude?: number };
    };
    const r = json.result;
    if (
      !r ||
      typeof r.latitude !== 'number' ||
      typeof r.longitude !== 'number'
    ) {
      // A 200 with no usable coordinates (a handful of outcodes have no
      // centroid data). Treat as not-found: it is a fact about the outcode.
      outcodeCache.set(key, {
        value: null,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return { outcome: 'not-found' };
    }
    const centroid = { latitude: r.latitude, longitude: r.longitude };
    outcodeCache.set(key, {
      value: centroid,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return { outcome: 'found', centroid };
  } catch {
    return { outcome: 'unavailable' };
  }
}

/**
 * Outcode → a REAL, central postcode inside that district.
 *
 * Method: outcode centroid, then reverse-geocode to the nearest live
 * postcodes and take the first that belongs to the requested district. The
 * district check uses the API's own per-result `outcode` field, not string
 * surgery — a centroid near a district boundary can land its nearest
 * postcode in the neighbouring district.
 *
 * Some centroids sit on ground with no postcode at all (N4's is in Finsbury
 * Park, NW5's on Hampstead Heath), so an empty first pass widens the search
 * radius once before giving up.
 */
export async function seedPostcodeForOutcode(
  outcode: string
): Promise<OutcodeSeed> {
  const looked = await lookupOutcode(outcode);
  if (looked.outcome !== 'found') {
    return looked;
  }

  const key = normalise(outcode);
  const { latitude, longitude } = looked.centroid;

  for (const radius of [1000, 2000]) {
    try {
      const res = await withTimeout(
        `${BASE}/postcodes?lon=${longitude}&lat=${latitude}&limit=10&radius=${radius}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) {
        return { outcome: 'unavailable' };
      }
      const json = (await res.json()) as {
        result?: Array<{ postcode?: string; outcode?: string }> | null;
      };
      const match = (json.result ?? []).find(
        (p) => p.outcode && normalise(p.outcode) === key && p.postcode
      );
      if (match?.postcode) {
        return { outcome: 'found', postcode: match.postcode };
      }
      // fall through to the wider radius
    } catch {
      return { outcome: 'unavailable' };
    }
  }

  // Tier 3 — sector scan. In postcode-dense city centres the reverse
  // geocode fills its result cap with NEIGHBOURING districts before the
  // first in-district postcode appears (B2: 100 nearest postcodes to its
  // own centroid, zero of them B2). The text search DOES respect the
  // sector space when exact-prefix matches exist ("B2 2" → B2 2AB, while
  // "B2 1" falls back to B21), so scan the ten possible sectors and
  // validate each hit by prefix rather than trusting the search.
  const spaced = `${key} `;
  for (let sector = 0; sector <= 9; sector++) {
    try {
      const res = await withTimeout(
        `${BASE}/postcodes?q=${encodeURIComponent(`${key} ${sector}`)}&limit=4`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) {
        return { outcome: 'unavailable' };
      }
      const json = (await res.json()) as {
        result?: Array<{ postcode?: string }> | null;
      };
      const hit = (json.result ?? []).find((p) =>
        p.postcode?.toUpperCase().startsWith(spaced)
      );
      if (hit?.postcode) {
        return { outcome: 'found', postcode: hit.postcode };
      }
    } catch {
      return { outcome: 'unavailable' };
    }
  }

  // The outcode exists but no live postcode was reachable by any method.
  // Genuinely exotic; treat as a fact rather than a blip.
  return { outcome: 'not-found' };
}

/** Haversine distance in miles between two coordinates. */
export function distanceMiles(a: LatLng, b: LatLng): number {
  const R = 3958.7613; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

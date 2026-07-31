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
export async function geocodePostcode(postcode: string): Promise<LatLng | null> {
  const key = normalise(postcode);
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  try {
    const res = await withTimeout(`${BASE}/postcodes/${encodeURIComponent(key)}`, {
      headers: { Accept: 'application/json' },
    });
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
  postcodes: string[],
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
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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

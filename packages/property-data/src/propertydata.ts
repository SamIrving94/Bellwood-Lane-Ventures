/**
 * PropertyData REST API client
 *
 * Server-only wrapper around https://api.propertydata.co.uk. Each endpoint
 * costs credits; we cache aggressively in-memory to keep the live form path
 * cheap. Long-term we'll move the cache to Postgres so it survives cold
 * starts — for now an in-memory LRU is enough for the agent quick-form
 * volume profile.
 *
 * IMPORTANT: never log the API key. Never expose this module to the
 * browser. The 'server-only' import enforces that.
 */

import 'server-only';
import { type PropertyDataType, toPropertyDataType } from './property-type';
import { acquireRateSlot } from './rate-limiter';
import { type PersistentCacheStore, getPersistentStore } from './store';

export { toPropertyDataType };
export type { PropertyDataType };

import { z } from 'zod';
import { keys } from '../keys';
import { type MarketSignals, buildMarketSignals } from './market-signals';

const env = keys();

const API_BASE = 'https://api.propertydata.co.uk';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_CACHE_ENTRIES = 500;

// ---------------------------------------------------------------------------
// In-memory cache (per server instance)
// ---------------------------------------------------------------------------

type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function cacheSet<T>(key: string, value: T, ttlMs: number) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // Drop the oldest entry. Map preserves insertion order.
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Test-only: empty the in-memory cache to simulate a serverless cold start. */
export function __clearMemoryCache(): void {
  cache.clear();
}

/**
 * Drop a poisoned durable row. Best-effort: `delete` is optional on the store
 * contract (older host wiring may not implement it), and a failed invalidation
 * must never fail the live request — the row simply expires on its own TTL.
 */
async function invalidatePersistent(
  store: PersistentCacheStore,
  key: string,
  endpoint: string
): Promise<void> {
  cache.delete(key);
  if (!store.delete) return;
  try {
    await store.delete(key);
  } catch (error) {
    console.warn(
      `[propertydata] persistent cache invalidate failed for ${endpoint}`,
      error
    );
  }
}

// ---------------------------------------------------------------------------
// Credit usage logging — single source of truth so we can watch spend
// ---------------------------------------------------------------------------

let creditsThisProcess = 0;

export function getProcessCredits() {
  return creditsThisProcess;
}

function logCreditUsage(endpoint: string, credits: number, fromCache: boolean) {
  if (fromCache) {
    console.info(`[propertydata] ${endpoint} cache hit — 0 credits`);
    return;
  }
  creditsThisProcess += credits;
  console.info(
    `[propertydata] ${endpoint} +${credits} credits (process total: ${creditsThisProcess})`
  );
}

// ---------------------------------------------------------------------------
// Result model
// ---------------------------------------------------------------------------

/**
 * WHY three states instead of `T | null`: a 429, a timeout, a 5xx, a schema
 * mismatch and a genuinely empty postcode all collapsed to `null`, and every
 * caller read `null` as "there is no data here". An outage therefore became a
 * confident zero — no EPC discount, no short-lease flag, tenure 'unknown' — i.e.
 * a HIGHER offer on exactly the distressed stock we exist to discount, with
 * nothing recorded anywhere to show it happened.
 *
 * The non-ok branches deliberately carry NO `value` property, so `res.value` is
 * a type error until the caller has narrowed on `outcome`. Treating a failure as
 * an absence has to be a deliberate, visible act.
 */
export type PropertyDataResult<T> =
  | { outcome: 'ok'; value: T }
  | { outcome: 'not_found' }
  | { outcome: 'failed'; error: string };

/**
 * Thrown by the legacy `T | null` helpers when the lookup FAILED (as opposed to
 * returning nothing). Callers that already wrap PropertyData in try/catch —
 * scouting's per-seed catch, the snapshot's `safe()` — now record a real error
 * instead of silently booking an empty result.
 */
export class PropertyDataUnavailableError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly detail: string
  ) {
    super(`[propertydata ${endpoint}] lookup unavailable: ${detail}`);
    this.name = 'PropertyDataUnavailableError';
  }
}

/**
 * Bridge from the result model to the historical `T | null` helper signatures.
 * `not_found` keeps its old empty answer; `failed` throws so it can never be
 * read as "no such data".
 */
function unwrap<T>(endpoint: string, res: PropertyDataResult<T>): T | null {
  if (res.outcome === 'ok') return res.value;
  if (res.outcome === 'not_found') return null;
  throw new PropertyDataUnavailableError(endpoint, res.error);
}

/** Map a thrown error back into the result model (for Promise.all fan-outs). */
function toFailedResult(error: unknown): PropertyDataResult<never> {
  return {
    outcome: 'failed',
    error: (error as Error)?.message?.slice(0, 200) ?? String(error),
  };
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

class PropertyDataError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly status: number,
    message: string
  ) {
    super(`[propertydata ${endpoint}] ${status}: ${message}`);
  }
}

/**
 * Postcodes are the cache key for nearly every endpoint. 'm14 5xy' and
 * 'M14 5XY' are the same postcode and the same paid-for answer, so they must
 * produce the same key — before this normalisation they were two separately
 * billed entries in both cache tiers.
 */
function normalisePostcodeParam(value: string | number): string {
  return String(value).replace(/\s+/g, '').toUpperCase();
}

// ---------------------------------------------------------------------------
// Value parsers for the formats PropertyData actually sends. Several endpoints
// return numbers as strings: percentages ("2.8%", "-3.9%"), pounds with
// thousands separators ("1,748.10"), and plain decimals ("9.1", "0.45"). Each
// parser returns null for anything it cannot read — never 0, never NaN.
// ---------------------------------------------------------------------------

/** "2.8%" → 2.8, "-3.9%" → -3.9, "11%" → 11. Null for anything else. */
function parsePercentString(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*%$/);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** "1,748.10" → 1748.1, "£2,622" → 2622. Null for anything else. */
function parsePoundsString(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/^£/, '').replace(/,/g, '');
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** A number, or a plain decimal string ("9.1", "54.579"). Null otherwise. */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

type FetchOptions<T> = {
  ttlMs: number;
  estimatedCredits: number;
  schema: z.ZodType<T>;
  /**
   * Does this validated body actually carry the fields the caller reads?
   *
   * Every response schema here is fully optional (upstream shapes vary by plan),
   * so a renamed upstream field still PASSES validation and yields an
   * effectively empty object — which we then cached for up to 90 days and served
   * to every instance. A content check turns that silent drift into a loud
   * failure that is never written to either cache tier.
   *
   * Check for the PRESENCE of the expected keys, not for non-emptiness: an empty
   * `properties: []` is a real "nothing in this postcode" answer and must stay
   * cacheable.
   */
  hasContent: (value: T) => boolean;
  /**
   * Per-endpoint request budget. Most endpoints answer in well under a second,
   * but a few do a live portal scrape on the way (`process_time` of ~9s on
   * /yields and ~8s on /agents in the 2026-09-13 probe) and were timing out
   * against the 10s default — every /yields call in production failed that
   * way. Defaults to REQUEST_TIMEOUT_MS.
   */
  timeoutMs?: number;
};

async function fetchPropertyData<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  options: FetchOptions<T>
): Promise<PropertyDataResult<T>> {
  const apiKey = env.PROPERTYDATA_API_KEY;
  if (!apiKey) {
    // A missing key is a FAILURE, not an absence of data. Reporting it as "no
    // data" is how an unconfigured project looked healthy for weeks.
    console.warn(
      `[propertydata] ${endpoint} skipped — no PROPERTYDATA_API_KEY configured`
    );
    return { outcome: 'failed', error: 'PROPERTYDATA_API_KEY not configured' };
  }

  const normalisedParams: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    normalisedParams[k] = k === 'postcode' ? normalisePostcodeParam(v) : v;
  }

  // Build the URL. PropertyData accepts the key as a query param (`key=`).
  // We never log the URL because the key is in it.
  const url = new URL(`${API_BASE}${endpoint}`);
  url.searchParams.set('key', apiKey);
  for (const [k, v] of Object.entries(normalisedParams)) {
    url.searchParams.set(k, String(v));
  }

  // Cache key excludes the API key (don't bake it into stored cache keys).
  const cacheKey = `${endpoint}:${JSON.stringify(normalisedParams)}`;
  const cached = cacheGet<T>(cacheKey);
  if (cached !== null) {
    logCreditUsage(endpoint, 0, true);
    return { outcome: 'ok', value: cached };
  }

  // Durable second tier: survives cold starts and is shared across instances, so
  // a postcode is bought once per TTL window rather than re-bought on every fresh
  // lambda. Additive — a no-op when no persistent store is registered — and a DB
  // read never consumes a rate slot (it's not a PropertyData call).
  const persistentStore = getPersistentStore();
  if (persistentStore) {
    try {
      const entry = await persistentStore.get(cacheKey);
      if (entry) {
        const remainingMs = entry.expiresAt - Date.now();
        if (remainingMs > 0) {
          // Durable rows outlive deploys and are shared across instances, so the
          // value under this key may have been written by an OLDER code version
          // against an older upstream shape. Handing it back as `T` unchecked
          // made the durable tier the one path that skipped validation entirely.
          const revalidated = options.schema.safeParse(entry.value);
          const usable =
            revalidated.success && options.hasContent(revalidated.data);
          if (usable) {
            cacheSet(cacheKey, revalidated.data, remainingMs);
            logCreditUsage(endpoint, 0, true);
            return { outcome: 'ok', value: revalidated.data };
          }
          console.warn(
            `[propertydata] ${endpoint} durable cache entry rejected (${
              revalidated.success ? 'no usable content' : 'schema mismatch'
            }) — invalidating and re-fetching`
          );
          await invalidatePersistent(persistentStore, cacheKey, endpoint);
        }
      }
    } catch (error) {
      console.warn(
        `[propertydata] persistent cache read failed for ${endpoint}`,
        error
      );
    }
  }

  // Respect PropertyData's 4-calls/10s limit before every live fetch.
  await acquireRateSlot();

  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (res.status === 429) {
      // X14 despite the client throttle — another server instance sharing
      // the key can still collectively exceed 4/10s. Wait out the window
      // and retry exactly once, with a fresh timeout budget.
      await new Promise((r) => setTimeout(r, 2500));
      await acquireRateSlot();
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), timeoutMs);
      res = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
    }
    if (res.status === 404) {
      // The only status that genuinely means "we looked, there is nothing here".
      return { outcome: 'not_found' };
    }
    if (!res.ok) {
      throw new PropertyDataError(
        endpoint,
        res.status,
        await res.text().catch(() => res.statusText)
      );
    }
    const json = await res.json();
    const parsed = options.schema.safeParse(json);
    if (!parsed.success) {
      console.warn(
        `[propertydata] ${endpoint} response failed schema validation`,
        parsed.error.flatten()
      );
      return {
        outcome: 'failed',
        error: `response failed schema validation for ${endpoint}`,
      };
    }
    if (!options.hasContent(parsed.data)) {
      // Validated but hollow — the schemas are all-optional, so an upstream
      // rename passes validation and produces an empty object. Loud, and NOT
      // cached: a 90-day TTL on drift poisons every instance until it expires.
      console.error(
        `[propertydata] ${endpoint} SCHEMA DRIFT — response validated but carries none of the expected fields. Not cached. Top-level keys: ${Object.keys(
          (json ?? {}) as Record<string, unknown>
        ).join(', ')}`
      );
      return {
        outcome: 'failed',
        error: `schema drift on ${endpoint} — response carried no usable fields`,
      };
    }
    cacheSet(cacheKey, parsed.data, options.ttlMs);
    if (persistentStore) {
      // Fire-and-forget: a durable-cache write must never block or fail a live
      // response.
      persistentStore
        .set(cacheKey, parsed.data, Date.now() + options.ttlMs)
        .catch((error) =>
          console.warn(
            `[propertydata] persistent cache write failed for ${endpoint}`,
            error
          )
        );
    }
    logCreditUsage(endpoint, options.estimatedCredits, false);
    return { outcome: 'ok', value: parsed.data };
  } catch (error) {
    if (error instanceof PropertyDataError) {
      console.warn(error.message);
      return {
        outcome: 'failed',
        error: `HTTP ${error.status} from ${endpoint}`,
      };
    }
    if ((error as { name?: string })?.name === 'AbortError') {
      console.warn(`[propertydata] ${endpoint} timed out after ${timeoutMs}ms`);
      return {
        outcome: 'failed',
        error: `${endpoint} timed out after ${timeoutMs}ms`,
      };
    }
    console.warn(`[propertydata] ${endpoint} failed`, error);
    return {
      outcome: 'failed',
      error: `${endpoint} failed: ${(error as Error)?.message ?? String(error)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Endpoint: /valuation-sale
// ---------------------------------------------------------------------------

const ValuationSaleSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      estimate: z.number().optional(),
      points_low: z.number().optional(),
      points_high: z.number().optional(),
      points_estimate: z.number().optional(),
      confidence: z.string().optional(),
    })
    .partial()
    .optional(),
});

export type ValuationSaleResult = {
  estimate: number;
  low: number;
  high: number;
  confidence: string;
} | null;

/**
 * UK's only £/sqft-driven AVM. ~3 credits per call.
 * Used by base-valuation as the external cross-check (BELA-12 spec slot).
 * 7-day cache by postcode + property type + bedrooms.
 *
 * Money here is POUNDS, not pence — the rest of the monorepo is integer pence,
 * and callers convert at the boundary (see getPropertySnapshot).
 *
 * ⚠ `internalAreaSqm` — UNIT UNCONFIRMED against PropertyData's own docs.
 * Nothing in this repo pins down what unit `/valuation-sale`'s `internal_area`
 * expects, and the two available conventions disagree: PropertyData's own
 * `/floor-areas` hands back `total_floor_area` in SQUARE METRES (it is the EPC
 * register, which is metric — see PropertyFloorArea.floorAreaSqm), while its
 * price endpoints are square-FOOT denominated (`/prices-per-sqf`,
 * `/sold-prices-per-sqf`, the `sqf` field on /sourced-properties). The two
 * differ by 10.76×, and this AVM carries 15-20% of pointEstimate.
 *
 * The parameter is named for the unit it actually receives so the two callers
 * can no longer disagree silently: `base-valuation.ts` was passing m² and
 * `getPropertySnapshot` declared sqft. Both now pass m². CONFIRM the expected
 * unit against PropertyData's /valuation-sale documentation and convert here if
 * it turns out to want square feet — do NOT change it on a hunch (docs/LEARNINGS.md).
 */
export async function getPropertyDataValuation(input: {
  postcode: string;
  propertyType: 'detached' | 'semi-detached' | 'terraced' | 'flat';
  bedrooms?: number;
  /** Internal floor area in SQUARE METRES. See the unit caveat above. */
  internalAreaSqm?: number;
}): Promise<ValuationSaleResult> {
  const data = unwrap(
    '/valuation-sale',
    await fetchPropertyData(
      '/valuation-sale',
      {
        postcode: input.postcode,
        property_type: toPropertyDataType(input.propertyType),
        bedrooms: input.bedrooms,
        internal_area: input.internalAreaSqm,
      },
      {
        ttlMs: 7 * 24 * 60 * 60 * 1000,
        estimatedCredits: 3,
        schema: ValuationSaleSchema,
        hasContent: (d) => d.result !== undefined,
      }
    )
  );
  if (!data?.result) return null;
  const r = data.result;
  if (typeof r.estimate !== 'number') return null;
  return {
    estimate: r.estimate,
    low: r.points_low ?? r.estimate * 0.95,
    high: r.points_high ?? r.estimate * 1.05,
    confidence: r.confidence ?? 'medium',
  };
}

// ---------------------------------------------------------------------------
// Endpoint: /floor-areas
// ---------------------------------------------------------------------------

/**
 * Real shape (captured 2026-09-13): a top-level `known_floor_areas[]` of
 * `{ inspection_date, address, square_feet, habitable_rooms }`. The unit is
 * SQUARE FEET — the field says so — not the m² the old schema assumed. There
 * is no bedrooms count, no property type and no postcode average.
 */
const FloorAreasSchema = z
  .object({
    status: z.string().optional(),
    postcode: z.string().optional(),
    known_floor_areas: z
      .array(
        z
          .object({
            inspection_date: z.string().optional(),
            address: z.string().optional(),
            square_feet: z.number().optional(),
            habitable_rooms: z.number().optional(),
          })
          .partial()
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

/** 1 sq ft in m². Applied once, at the boundary, so every caller sees m². */
const SQFT_TO_SQM = 0.09290304;

/**
 * EPC-derived floor areas by postcode. ~2 credits per call.
 * Critical for the agent quick-form path where we don't ask for sqft.
 * 90-day cache.
 */
export async function getFloorAreas(postcode: string) {
  return unwrap(
    '/floor-areas',
    await fetchPropertyData(
      '/floor-areas',
      { postcode },
      {
        ttlMs: 90 * 24 * 60 * 60 * 1000,
        estimatedCredits: 2,
        schema: FloorAreasSchema,
        hasContent: (d) => Array.isArray(d.known_floor_areas),
      }
    )
  );
}

/** One EPC floor-area row, as the £/sqft comp matcher consumes it. */
export type FloorAreaRow = {
  address: string;
  /** Real EPC-derived internal floor area, m² (converted from `square_feet`). */
  floorAreaSqm: number;
  /** Always null — the endpoint does not publish bedrooms. */
  bedrooms: number | null;
  /** Always null — not on this endpoint. */
  propertyType: string | null;
  /** Habitable rooms as recorded on the certificate. */
  habitableRooms: number | null;
  inspectionDate: string | null;
};

/** Rows with a real, positive floor area, in m². */
function floorAreaRows(
  data: Awaited<ReturnType<typeof getFloorAreas>>
): FloorAreaRow[] {
  const out: FloorAreaRow[] = [];
  for (const p of data?.known_floor_areas ?? []) {
    if (
      typeof p.address !== 'string' ||
      typeof p.square_feet !== 'number' ||
      p.square_feet <= 0
    ) {
      continue;
    }
    out.push({
      address: p.address,
      floorAreaSqm: Math.round(p.square_feet * SQFT_TO_SQM * 10) / 10,
      bedrooms: null,
      propertyType: null,
      habitableRooms:
        typeof p.habitable_rooms === 'number' ? p.habitable_rooms : null,
      inspectionDate:
        typeof p.inspection_date === 'string' ? p.inspection_date : null,
    });
  }
  return out;
}

/**
 * Every EPC floor-area row the register holds for a postcode — the whole-
 * postcode view the £/sqft comp matcher needs (vs `getPropertyFloorArea`'s
 * single-property view). Same /floor-areas call, same 90-day cache, so
 * matching many comps in one postcode costs one lookup. Returns [] without
 * a key or on failure — the caller sees "no rows", never invented ones.
 */
export async function getFloorAreaRows(
  postcode: string
): Promise<FloorAreaRow[]> {
  let data: Awaited<ReturnType<typeof getFloorAreas>>;
  try {
    data = await getFloorAreas(postcode);
  } catch (err) {
    console.warn(
      `[propertydata] /floor-areas unavailable for ${postcode} — no £/sqft rows`,
      err
    );
    return [];
  }
  return floorAreaRows(data);
}

// ---------------------------------------------------------------------------
// Resolve ONE property's real floor area (EPC-derived) from /floor-areas
// ---------------------------------------------------------------------------

export interface PropertyFloorArea {
  /** Real EPC-derived internal floor area, m². Never a guess/average. */
  floorAreaSqm: number;
  /** The matched EPC address (includes the house number). */
  matchedAddress: string;
  /**
   * How the row was matched — surfaced in the UI for transparency.
   * 'unique_type_match' is kept for persisted results; it cannot be produced
   * any more (the register rows carry neither type nor bedrooms).
   */
  matchSource: 'house_number' | 'unique_type_match';
}

/**
 * Extract the leading house identifier from an address so we can match it
 * against an EPC row. Handles "12 …", "12A …", "Flat 3 …", "Unit 2 …".
 * Returns null when the address has no number (street-only), which is common
 * for scraped listings — in that case we must NOT guess a size.
 */
function houseIdentifier(address: string): string | null {
  const trimmed = address.trim();
  const numbered = trimmed.match(/^(\d+\s*[a-z]?)\b/i);
  if (numbered?.[1]) return numbered[1].replace(/\s+/g, '').toLowerCase();
  const unit = trimmed.match(/^((?:flat|apartment|apt|unit)\s+\w+)\b/i);
  if (unit?.[1]) return unit[1].replace(/\s+/g, ' ').toLowerCase();
  return null;
}

/**
 * Resolve a single property's REAL floor area from PropertyData's /floor-areas
 * (EPC register) for the postcode, by exact house-number match against the
 * supplied address.
 *
 * Returns null when no unambiguous real row matches. We deliberately never
 * fall back to a postcode average — that is a guess, and the house-of-record
 * could be half or double it (the M14 doubling bug). The old second path (a
 * unique match on property type + bedrooms for street-only addresses) is gone:
 * the register rows carry neither field, so it could never fire. `propertyType`
 * and `bedrooms` stay on the input so callers need not change.
 */
export async function getPropertyFloorArea(input: {
  postcode: string;
  address?: string;
  propertyType?: string;
  bedrooms?: number;
}): Promise<PropertyFloorArea | null> {
  const rows = floorAreaRows(await getFloorAreas(input.postcode));
  if (rows.length === 0) return null;

  const wanted = input.address ? houseIdentifier(input.address) : null;
  // No house number → nothing to match on → no size (real data or nothing).
  if (!wanted) return null;

  const hit = rows.find((p) => houseIdentifier(p.address) === wanted);
  if (!hit) return null; // Had a number but it isn't in the register → don't guess.
  return {
    floorAreaSqm: Math.round(hit.floorAreaSqm),
    matchedAddress: hit.address,
    matchSource: 'house_number',
  };
}

// ---------------------------------------------------------------------------
// Endpoint: /flood-risk
// ---------------------------------------------------------------------------

/**
 * Real shape (captured 2026-09-13): a single top-level `flood_risk` string
 * ("Very Low"). No `result` object and no rivers-vs-surface-water split.
 */
const FloodRiskSchema = z
  .object({
    status: z.string().optional(),
    postcode: z.string().optional(),
    flood_risk: z.string().optional(),
  })
  .passthrough();

export type FloodRiskReading = {
  /** PropertyData's band as published, e.g. "Very Low", "Low", "Medium", "High". */
  floodRisk: string;
};

/**
 * Flood risk by postcode (England only). ~2 credits.
 * 90-day cache — postcode-level risk barely changes.
 */
export async function getFloodRisk(
  postcode: string
): Promise<FloodRiskReading | null> {
  const data = unwrap(
    '/flood-risk',
    await fetchPropertyData(
      '/flood-risk',
      { postcode },
      {
        ttlMs: 90 * 24 * 60 * 60 * 1000,
        estimatedCredits: 2,
        schema: FloodRiskSchema,
        hasContent: (d) => typeof d.flood_risk === 'string',
      }
    )
  );
  if (!data || typeof data.flood_risk !== 'string') return null;
  return { floodRisk: data.flood_risk };
}

// ---------------------------------------------------------------------------
// Endpoint: /demand
// ---------------------------------------------------------------------------

/**
 * Real shape (captured 2026-09-13): everything is TOP-LEVEL —
 * `total_for_sale` (19), `average_sales_per_month` (2), `turnover_per_month`
 * ("11%"), `months_of_inventory` ("9.1"), `days_on_market` (277) and
 * `demand_rating` ("Balanced market"), plus `radius`. There is no `result`
 * object and no 0-100 `sales_demand_score`.
 */
const DemandSchema = z
  .object({
    status: z.string().optional(),
    postcode: z.string().optional(),
    radius: z.union([z.string(), z.number()]).optional(),
    total_for_sale: z.number().optional(),
    average_sales_per_month: z.number().optional(),
    turnover_per_month: z.union([z.string(), z.number()]).optional(),
    months_of_inventory: z.union([z.string(), z.number()]).optional(),
    days_on_market: z.number().optional(),
    demand_rating: z.string().optional(),
  })
  .passthrough();

export type DemandReading = {
  /** PropertyData's text rating, e.g. "Balanced market". */
  demandRating: string | null;
  /** Average days a listing sits before selling. */
  daysOnMarket: number | null;
  totalForSale: number | null;
  averageSalesPerMonth: number | null;
  /** Share of stock that sells each month, %. */
  turnoverPerMonthPct: number | null;
  monthsOfInventory: number | null;
};

/**
 * How fast does this postcode sell? Drives our either-outcome
 * conversation: in low-demand postcodes our offer is more compelling.
 * ~2 credits, 7-day cache.
 */
export async function getMarketDemandResult(
  postcode: string
): Promise<PropertyDataResult<DemandReading>> {
  const res = await fetchPropertyData(
    '/demand',
    { postcode },
    {
      ttlMs: 7 * 24 * 60 * 60 * 1000,
      estimatedCredits: 2,
      schema: DemandSchema,
      hasContent: (d) =>
        typeof d.demand_rating === 'string' ||
        typeof d.days_on_market === 'number',
    }
  );
  if (res.outcome !== 'ok') return res;
  const d = res.value;
  return {
    outcome: 'ok',
    value: {
      demandRating:
        typeof d.demand_rating === 'string' ? d.demand_rating : null,
      daysOnMarket:
        typeof d.days_on_market === 'number' ? d.days_on_market : null,
      totalForSale:
        typeof d.total_for_sale === 'number' ? d.total_for_sale : null,
      averageSalesPerMonth:
        typeof d.average_sales_per_month === 'number'
          ? d.average_sales_per_month
          : null,
      turnoverPerMonthPct:
        typeof d.turnover_per_month === 'number'
          ? d.turnover_per_month
          : parsePercentString(d.turnover_per_month),
      monthsOfInventory: toNumber(d.months_of_inventory),
    },
  };
}

export async function getMarketDemand(
  postcode: string
): Promise<DemandReading | null> {
  return unwrap('/demand', await getMarketDemandResult(postcode));
}

// ---------------------------------------------------------------------------
// Endpoint: /agents (PROSPECTING)
// ---------------------------------------------------------------------------

/**
 * Real shape (captured 2026-09-13): `data` is keyed by PORTAL
 * ("zoopla.co.uk", "onthemarket.com"), each holding `sale[]` and `rent[]`
 * rankings of `{ rank, agent, branches[], units_offered, total_value,
 * average_value, recent_instructions[] }` (rent rows add `unit:
 * "gbp_per_week"`). Money is pounds. There is no phone, address or website
 * for the agent — the old schema's fields never existed.
 */
const AgentRowSchema = z
  .object({
    rank: z.number().optional(),
    agent: z.string().optional(),
    branches: z.array(z.string()).optional(),
    units_offered: z.number().optional(),
    total_value: z.number().optional(),
    average_value: z.number().optional(),
    unit: z.string().optional(),
    recent_instructions: z
      .array(
        z
          .object({
            address: z.string().optional(),
            lat: z.number().optional(),
            lng: z.number().optional(),
            price: z.number().optional(),
            link: z.string().optional(),
          })
          .partial()
          .passthrough()
      )
      .optional(),
  })
  .partial()
  .passthrough();

const AgentsSchema = z
  .object({
    status: z.string().optional(),
    postcode: z.string().optional(),
    radius: z.union([z.string(), z.number()]).optional(),
    data: z
      .record(
        z.string(),
        z
          .object({
            sale: z.array(AgentRowSchema).optional(),
            rent: z.array(AgentRowSchema).optional(),
          })
          .partial()
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

export type AgentReading = {
  /** Agent brand as PropertyData names it, e.g. "Hunters". */
  name: string;
  /** Which portal's ranking this row came from, e.g. "zoopla.co.uk". */
  portal: string;
  market: 'sale' | 'rent';
  rank: number | null;
  /** Branch towns as listed, e.g. ["Bishop Auckland"]. */
  branches: string[];
  /** Live instructions on that portal. */
  unitsOffered: number | null;
  /** Pounds (sale) or pounds per week (rent). */
  totalValue: number | null;
  averageValue: number | null;
};

/**
 * Live agent rankings by postcode, per portal and per market, ranked by
 * listing volume. Feeds the weekly prospecting cron. ~3 credits, 7-day cache.
 * Returns [] for an empty postcode; throws on a failed lookup.
 */
export async function getAgentsByPostcode(
  postcode: string
): Promise<AgentReading[]> {
  const data = unwrap(
    '/agents',
    await fetchPropertyData(
      '/agents',
      { postcode },
      {
        ttlMs: 7 * 24 * 60 * 60 * 1000,
        estimatedCredits: 3,
        schema: AgentsSchema,
        hasContent: (d) => d.data !== undefined,
        // ~8s upstream (portal scrape); too close to the 10s default.
        timeoutMs: 30_000,
      }
    )
  );
  const out: AgentReading[] = [];
  for (const [portal, markets] of Object.entries(data?.data ?? {})) {
    for (const market of ['sale', 'rent'] as const) {
      for (const row of markets[market] ?? []) {
        if (typeof row.agent !== 'string' || !row.agent.trim()) continue;
        out.push({
          name: row.agent.trim(),
          portal,
          market,
          rank: typeof row.rank === 'number' ? row.rank : null,
          branches: (row.branches ?? []).filter(
            (b): b is string => typeof b === 'string'
          ),
          unitsOffered:
            typeof row.units_offered === 'number' ? row.units_offered : null,
          totalValue:
            typeof row.total_value === 'number' ? row.total_value : null,
          averageValue:
            typeof row.average_value === 'number' ? row.average_value : null,
        });
      }
    }
  }
  return out;
}

/**
 * Collapse the per-portal sale rankings into one list of agents, most active
 * first. The same brand appears on several portals, usually with the same
 * stock listed on each — so we take the LARGEST units figure rather than
 * summing (a sum would double-count a listing syndicated to both portals).
 */
export function topSaleAgents(
  rows: AgentReading[],
  limit = Number.POSITIVE_INFINITY
): Array<{ name: string; branches: string[]; unitsOffered: number | null }> {
  const byName = new Map<
    string,
    { name: string; branches: Set<string>; unitsOffered: number | null }
  >();
  for (const r of rows) {
    if (r.market !== 'sale') continue;
    const key = r.name.toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      for (const b of r.branches) existing.branches.add(b);
      if (
        r.unitsOffered !== null &&
        (existing.unitsOffered === null ||
          r.unitsOffered > existing.unitsOffered)
      ) {
        existing.unitsOffered = r.unitsOffered;
      }
    } else {
      byName.set(key, {
        name: r.name,
        branches: new Set(r.branches),
        unitsOffered: r.unitsOffered,
      });
    }
  }
  return [...byName.values()]
    .sort((a, b) => (b.unitsOffered ?? -1) - (a.unitsOffered ?? -1))
    .slice(0, limit)
    .map((a) => ({
      name: a.name,
      branches: [...a.branches],
      unitsOffered: a.unitsOffered,
    }));
}

// ---------------------------------------------------------------------------
// Endpoint: /sourced-properties — distressed listings (probate, repos, BMV)
// ---------------------------------------------------------------------------

// Schema reflects the ACTUAL response shape discovered by direct probe.
// Properties live at body.properties, not body.result.properties.
const SourcedPropertiesSchema = z.object({
  status: z.string().optional(),
  list: z
    .object({ id: z.string().optional(), name: z.string().optional() })
    .partial()
    .optional(),
  postcode: z.string().optional(),
  radius: z.number().optional(),
  result_count: z.number().optional(),
  api_calls_cost: z.number().optional(),
  properties: z
    .array(
      z
        .object({
          id: z.string().optional(),
          address: z.string().optional(),
          precise_address: z.string().nullable().optional(),
          postcode: z.string().optional(),
          type: z.string().optional(),
          type_standardised: z.string().optional(),
          bedrooms: z.number().nullable().optional(),
          price: z.number().nullable().optional(),
          sqf: z.number().nullable().optional(),
          days_on_market: z.number().nullable().optional(),
          days_since_price_change: z.number().nullable().optional(),
          sstc: z.number().nullable().optional(),
          lat: z.string().nullable().optional(),
          lng: z.string().nullable().optional(),
          distance_to: z.string().nullable().optional(),
          price_history: z
            .array(z.object({ date: z.string(), price: z.number() }).partial())
            .optional(),
          summary: z.string().nullable().optional(),
          image_url: z.string().nullable().optional(),
          url: z.string().nullable().optional(),
        })
        .partial()
    )
    .optional(),
});

export type SourcedProperty = {
  id: string | null;
  address: string;
  preciseAddress: string | null;
  postcode: string;
  pricePence: number | null;
  bedrooms: number | null;
  propertyType: string | null;
  listingType: string; // the list slug — repossessed-properties etc.
  listingUrl: string | null;
  daysOnMarket: number | null;
  daysSincePriceChange: number | null;
  /** Original asking price (if price history shows a reduction) in pence. */
  originalPricePence: number | null;
  /** Percentage discount from the highest historical price, 0-100. */
  discountPercent: number | null;
  /** How many distinct price reductions in the listing history. */
  reductionCount: number;
  /**
   * Velocity = (totalDropPercent × reductionCount) / max(daysOnMarket, 1).
   * High velocity (>0.5) means the seller is dropping price rapidly →
   * strong motivation signal. Compare: 3 reductions × 10% in 30 days = 1.0;
   * 1 reduction × 5% in 90 days = 0.056.
   */
  velocityScore: number;
  summary: string | null;
  imageUrl: string | null;
  source: string;
  /**
   * Floor area in SQUARE FEET as the LISTING states it (PropertyData `sqf`).
   * Agent-declared, not the EPC — a first read at sourcing time until the
   * AVM verifies the size against the register. Null when the listing has
   * none, which is most of them.
   */
  listingSqft: number | null;
  /**
   * True when PropertyData flags the listing as sold-subject-to-contract.
   * We request exclude_sstc=1 by default, but the flag still comes back set
   * on some rows — carry it so callers can screen instead of discarding it.
   */
  sstc: boolean | null;
};

/**
 * Diagnostic: hit /sourced-properties RAW (bypass cache + schema). Returns
 * whatever PropertyData actually returned, no transformation. Used by the
 * /settings/scouting page to show founders why a postcode produced 0 leads.
 */
/**
 * PropertyData /sourced-properties `list` types. The endpoint MUST receive
 * one of these (or comma-separated) — bare postcode requests get 400.
 * Mapped to lead types our scoring engine understands.
 *
 * Source: PropertyData docs error code 1101 = "Missing input: list".
 */
/**
 * Every list type PropertyData /sourced-properties might accept. The
 * exact set available depends on the account's plan. We probe each
 * individually rather than sending them as a combined list, because
 * PropertyData 422s the whole call if any single value is invalid for
 * the account.
 */
/**
 * PropertyData's documented sourcing-list slugs that map to Bellwood's
 * distressed-buyer wedge. These are the EXACT slugs from PropertyData's
 * /source-on-market page — earlier (incorrect) values like 'repossession'
 * returned 422 because the real slug is 'repossessed-properties'.
 *
 * PropertyData docs list 39 strategies; these 12 are the ones directly
 * relevant to a cash-buyer-of-distressed-stock business.
 */
export const SOURCED_LIST_TYPES = [
  'repossessed-properties',
  'quick-sale-properties',
  'reduced-properties',
  'slow-to-sell-properties',
  'derelict-properties',
  'unmodernised-properties',
  'back-on-market',
  'properties-with-no-chain',
  'cash-buyers-only-properties',
  'auction-properties',
  'short-lease-properties',
  'poor-epc-score',
] as const;

export type SourcedListType = (typeof SOURCED_LIST_TYPES)[number];

/**
 * Default — the seven strongest distress signals. PropertyData accepts
 * comma-separated list values, returning properties matching ANY.
 * `back-on-market` (index 6) earned its place Aug 2026: a sale that fell
 * through is a vendor who already chose to sell, now stuck — it maps to
 * `chain_break` in lead-type.ts. Cost: one extra call per seed per run.
 */
const DEFAULT_LIST = SOURCED_LIST_TYPES.slice(0, 7).join(',');

/**
 * Per-list-type probe — call /sourced-properties once per list type,
 * record what works, return a breakdown. Resilient to any single type
 * being invalid for the account.
 *
 * NOT cached: it goes through getSourcedPropertiesRaw, which deliberately
 * bypasses the cache so the founder sees PropertyData's live answer. Every
 * run costs ~3 credits per list type.
 */
export type ListTypeBreakdown = Record<
  SourcedListType,
  { count: number; error: string | null }
>;

export async function probeSourcedByType(
  postcode: string,
  opts?: { radiusMiles?: number; types?: readonly SourcedListType[] }
): Promise<ListTypeBreakdown> {
  const types = opts?.types ?? SOURCED_LIST_TYPES;
  const out: Partial<ListTypeBreakdown> = {};

  await Promise.all(
    types.map(async (t) => {
      // Use the raw endpoint so the diagnostic page sees PropertyData's actual
      // status and body. getSourcedProperties() now throws rather than
      // returning [], but the thrown message loses the upstream 422 text that
      // tells a founder WHICH list slug their plan rejects.
      const raw = await getSourcedPropertiesRaw(postcode, {
        radiusMiles: opts?.radiusMiles,
        list: t,
      });

      if (!raw.ok) {
        const body = raw.body as Record<string, unknown> | null;
        const msg =
          (body?.message as string | undefined) ??
          raw.error ??
          `HTTP ${raw.status ?? '?'}`;
        out[t] = {
          count: 0,
          error: `${raw.status ?? '?'}: ${msg.slice(0, 80)}`,
        };
        return;
      }

      // Properties live at body.properties, NOT body.result.properties —
      // same path getSourcedProperties() reads. Reading `result.properties`
      // made every successful probe report 0 on the diagnostic page.
      const body = raw.body as { properties?: unknown[] } | null;
      const properties = body?.properties;
      out[t] = {
        count: Array.isArray(properties) ? properties.length : 0,
        error: null,
      };
    })
  );

  for (const t of SOURCED_LIST_TYPES) {
    if (!out[t]) out[t] = { count: 0, error: 'not probed' };
  }
  return out as ListTypeBreakdown;
}

export async function getSourcedPropertiesRaw(
  postcode: string,
  opts?: {
    radiusMiles?: number;
    list?: string;
    standardisedType?: string;
    includeSstc?: boolean;
  }
): Promise<{
  ok: boolean;
  status?: number;
  body?: unknown;
  error?: string;
}> {
  const apiKey = env.PROPERTYDATA_API_KEY;
  if (!apiKey)
    return { ok: false, error: 'PROPERTYDATA_API_KEY not configured' };
  const url = new URL(`${API_BASE}/sourced-properties`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('postcode', normalisePostcodeParam(postcode));
  url.searchParams.set('list', opts?.list ?? DEFAULT_LIST);
  if (typeof opts?.radiusMiles === 'number') {
    url.searchParams.set('radius', String(opts.radiusMiles));
  }
  // Drop sold-subject-to-contract listings by default — they are already under
  // offer and not actionable as fresh leads. Opt back in with includeSstc.
  if (opts?.includeSstc !== true) {
    url.searchParams.set('exclude_sstc', '1');
  }
  if (opts?.standardisedType) {
    url.searchParams.set('standardised_type', opts.standardisedType);
  }
  // This raw helper bypasses fetchPropertyData (it must surface the real
  // status + body, which the wrapper discards), so it has to reproduce the
  // wrapper's safety rails itself: rate slot, abort timeout, 429 retry.
  // Without the timeout, probeSourcedByType's 12-way fan-out could wedge the
  // diagnostic page on a single stalled connection.
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    await acquireRateSlot();
    let res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (res.status === 429) {
      // Same one-shot retry as fetchPropertyData: another instance sharing
      // the key can collectively blow the 4/10s limit. Fresh timeout budget.
      await new Promise((r) => setTimeout(r, 2500));
      await acquireRateSlot();
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
    }
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      return {
        ok: false,
        error: `timed out after ${REQUEST_TIMEOUT_MS}ms`,
      };
    }
    return { ok: false, error: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Distressed property listings for ONE list type. Each call costs ~1
 * PropertyData credit and is cached 24h. Postcode-scoped.
 *
 * The PropertyData /sourced-properties endpoint accepts ONE list slug
 * per call (e.g. 'auction-properties'). For aggregating across multiple
 * distress signals, use {@link getSourcedPropertiesMulti}.
 */
export async function getSourcedProperties(
  postcode: string,
  opts?: {
    radiusMiles?: number;
    list?: string;
    standardisedType?: string;
    includeSstc?: boolean;
  }
): Promise<SourcedProperty[]> {
  const params: Record<string, string | number> = {
    postcode,
    list: opts?.list ?? SOURCED_LIST_TYPES[0],
  };
  if (typeof opts?.radiusMiles === 'number') {
    params.radius = opts.radiusMiles;
  }
  // Drop sold-subject-to-contract listings by default — already under offer,
  // not actionable as fresh leads. Opt back in with includeSstc.
  if (opts?.includeSstc !== true) {
    params.exclude_sstc = 1;
  }
  if (opts?.standardisedType) {
    params.standardised_type = opts.standardisedType;
  }
  // Throws on a FAILED lookup rather than returning []. An empty array from a
  // 429 read as "this postcode has no distressed stock" — the diagnostic page
  // showed "0 listings, error: null" and scouting's source health reported
  // PropertyData ok. Callers already wrap this in try/catch.
  const data = unwrap(
    '/sourced-properties',
    await fetchPropertyData('/sourced-properties', params, {
      ttlMs: 24 * 60 * 60 * 1000,
      estimatedCredits: 1,
      schema: SourcedPropertiesSchema,
      hasContent: (d) => Array.isArray(d.properties),
    })
  );
  // PropertyData puts properties[] at the ROOT of the body, not under `result`.
  // The `list` field at root is an object {id, name}; use id as the listing type.
  const body = data as {
    properties?: unknown[];
    list?: { id?: string; name?: string };
  } | null;
  const properties = body?.properties;
  const listSlug =
    typeof body?.list?.id === 'string' ? body.list.id : 'distressed';
  if (!Array.isArray(properties)) return [];

  const normalised: SourcedProperty[] = [];
  for (const raw of properties) {
    const p = raw as Record<string, unknown>;
    const address = typeof p.address === 'string' ? p.address.trim() : null;
    const postcodeOut =
      typeof p.postcode === 'string' ? p.postcode.toUpperCase().trim() : null;
    if (!address || !postcodeOut) continue;

    // Derive discount + velocity from price_history.
    let originalPricePence: number | null = null;
    let discountPercent: number | null = null;
    let reductionCount = 0;
    let velocityScore = 0;
    const hist = Array.isArray(p.price_history)
      ? (p.price_history as Array<{ price?: number; date?: string }>)
      : [];
    const currentPrice = typeof p.price === 'number' ? p.price : null;
    const maxHistPrice = hist
      .map((h) => h.price)
      .filter((v): v is number => typeof v === 'number')
      .reduce((m, v) => (v > m ? v : m), 0);
    if (currentPrice && maxHistPrice > currentPrice) {
      originalPricePence = Math.round(maxHistPrice * 100);
      discountPercent = Math.round(
        ((maxHistPrice - currentPrice) / maxHistPrice) * 100
      );
    }
    // Walk history chronologically to count distinct price DROPS.
    const sortedHist = [...hist]
      .filter((h) => typeof h.price === 'number')
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    for (let k = 1; k < sortedHist.length; k++) {
      const prev = sortedHist[k - 1]?.price ?? 0;
      const cur = sortedHist[k]?.price ?? 0;
      if (cur < prev) reductionCount++;
    }
    // Velocity = magnitude of drops × frequency, normalised by listing age.
    const daysOnMarket =
      typeof p.days_on_market === 'number' ? p.days_on_market : null;
    if (
      reductionCount > 0 &&
      discountPercent !== null &&
      daysOnMarket !== null &&
      daysOnMarket > 0
    ) {
      velocityScore =
        Math.round(((discountPercent * reductionCount) / daysOnMarket) * 100) /
        100;
    }

    normalised.push({
      id: typeof p.id === 'string' ? p.id : null,
      address,
      preciseAddress:
        typeof p.precise_address === 'string' ? p.precise_address : null,
      postcode: postcodeOut,
      pricePence: currentPrice ? Math.round(currentPrice * 100) : null,
      bedrooms: typeof p.bedrooms === 'number' ? p.bedrooms : null,
      propertyType:
        (typeof p.type_standardised === 'string' && p.type_standardised) ||
        (typeof p.type === 'string' ? p.type : null),
      listingType: listSlug,
      listingUrl: typeof p.url === 'string' ? p.url : null,
      daysOnMarket:
        typeof p.days_on_market === 'number' ? p.days_on_market : null,
      daysSincePriceChange:
        typeof p.days_since_price_change === 'number'
          ? p.days_since_price_change
          : null,
      originalPricePence,
      discountPercent,
      reductionCount,
      velocityScore,
      summary: typeof p.summary === 'string' ? p.summary : null,
      imageUrl: typeof p.image_url === 'string' ? p.image_url : null,
      source: `propertydata_${listSlug}`,
      listingSqft:
        typeof p.sqf === 'number' && p.sqf > 0 ? Math.round(p.sqf) : null,
      sstc: typeof p.sstc === 'number' ? p.sstc === 1 : null,
    });
  }
  return normalised;
}

/**
 * Fan out across multiple PropertyData list types and merge results,
 * deduped by id (or address+postcode if id missing).
 *
 * Throttle: PropertyData rate limit is 4 calls per 10 seconds. We pause
 * 2700ms between calls. For 6 list types × 1 area that's ~16s wall-clock,
 * 6 credits. Each call is cached 24h so repeat probes are free.
 *
 * Returns aggregated SourcedProperty[] with the strongest distress signal
 * surfaced in `listingType` when a property hits multiple lists.
 */
export async function getSourcedPropertiesMulti(
  postcode: string,
  opts?: { radiusMiles?: number; lists?: readonly string[] }
): Promise<SourcedProperty[]> {
  // Seven lists: the six core distress signals + back-on-market (failed
  // sale = motivated vendor). Keep in lockstep with DEFAULT_LIST above.
  const lists = opts?.lists ?? SOURCED_LIST_TYPES.slice(0, 7);
  const seen = new Map<string, SourcedProperty>();
  const failures: string[] = [];

  for (let i = 0; i < lists.length; i++) {
    const list = lists[i]!;
    try {
      const props = await getSourcedProperties(postcode, {
        radiusMiles: opts?.radiusMiles,
        list,
      });
      for (const p of props) {
        const key =
          p.id ?? `${p.address.toLowerCase()}|${p.postcode.toLowerCase()}`;
        if (seen.has(key)) {
          // Stronger signal wins (earlier in SOURCED_LIST_TYPES = higher signal)
          const existing = seen.get(key)!;
          const existingRank = SOURCED_LIST_TYPES.indexOf(
            existing.listingType as (typeof SOURCED_LIST_TYPES)[number]
          );
          const newRank = SOURCED_LIST_TYPES.indexOf(
            p.listingType as (typeof SOURCED_LIST_TYPES)[number]
          );
          if (newRank >= 0 && (existingRank < 0 || newRank < existingRank)) {
            seen.set(key, p);
          }
        } else {
          seen.set(key, p);
        }
      }
    } catch (err) {
      failures.push(`${list}: ${(err as Error)?.message ?? String(err)}`);
      console.warn(`[propertydata multi] ${list} failed`, err);
    }
    // Throttle except after the last
    if (i < lists.length - 1) {
      await new Promise((r) => setTimeout(r, 2700));
    }
  }

  // A partial fan-out still returns what it found — but if EVERY list failed we
  // have no evidence at all, and returning [] would be indistinguishable from
  // "this area has no distressed stock". That is the failure scouting's source
  // health has to see.
  if (failures.length === lists.length && lists.length > 0) {
    throw new PropertyDataUnavailableError(
      '/sourced-properties',
      `all ${lists.length} list types failed — ${failures[0]}`
    );
  }

  return Array.from(seen.values());
}

/**
 * Market signals for ONE subject property — its own listing behaviour (days
 * on market, cuts, velocity, distress-list membership) plus the other
 * distress-flagged listings around it. One /sourced-properties call with all
 * seven lists combined (cached 24h by postcode+list+radius), ~1 credit.
 *
 * `sstc` listings are INCLUDED here: for an appraisal, "under offer after 3
 * cuts" is signal, not noise. Throws when PropertyData is unreachable —
 * callers (runAVM) catch and record null, because "no signals" and
 * "signals unavailable" are different facts.
 */
export async function getSubjectMarketSignals(input: {
  postcode: string;
  address?: string | null;
  radiusMiles?: number;
}): Promise<MarketSignals> {
  const radiusMiles = input.radiusMiles ?? 0.25;
  const listings = await getSourcedProperties(input.postcode, {
    list: DEFAULT_LIST,
    radiusMiles,
    includeSstc: true,
  });
  return buildMarketSignals({
    subject: { address: input.address, postcode: input.postcode },
    listings,
    radiusMiles,
  });
}

// ---------------------------------------------------------------------------
// Endpoint: /energy-efficiency (EPC ratings) — RICE B
// ---------------------------------------------------------------------------

/**
 * Real shape (captured 2026-09-13): a top-level `energy_efficiency[]` of
 * `{ inspection_date, address, score, rating }` — one row per certificate in
 * the postcode. No `result`, no potential rating, no property type, no floor
 * area (that lives on /floor-areas).
 */
const EpcSchema = z
  .object({
    status: z.string().optional(),
    postcode: z.string().optional(),
    energy_efficiency: z
      .array(
        z
          .object({
            inspection_date: z.string().optional(),
            address: z.string().optional(),
            score: z.number().optional(),
            rating: z.string().optional(),
          })
          .partial()
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

export type EpcReading = {
  address: string;
  rating: string | null; // A-G
  efficiency: number | null; // 0-100
  /** Always null — the endpoint publishes the current rating only. */
  potentialRating: string | null;
  /** Always null — not on this endpoint. */
  propertyType: string | null;
  inspectionDate: string | null;
};

/**
 * EPC ratings by postcode (from the public Energy Performance Certificate
 * register). ~2 credits, 90-day cache (EPCs are valid 10 years).
 *
 * Returns every certified property in the postcode. The caller is expected
 * to match by address fuzzy-string.
 */
export async function getEpcByPostcodeResult(
  postcode: string
): Promise<PropertyDataResult<EpcReading[]>> {
  const res = await fetchPropertyData(
    '/energy-efficiency',
    { postcode },
    {
      ttlMs: 90 * 24 * 60 * 60 * 1000,
      estimatedCredits: 2,
      schema: EpcSchema,
      hasContent: (d) => Array.isArray(d.energy_efficiency),
    }
  );
  if (res.outcome !== 'ok') return res;
  return { outcome: 'ok', value: readEpcRows(res.value.energy_efficiency) };
}

export async function getEpcByPostcode(
  postcode: string
): Promise<EpcReading[]> {
  return (
    unwrap('/energy-efficiency', await getEpcByPostcodeResult(postcode)) ?? []
  );
}

function readEpcRows(
  rows: z.infer<typeof EpcSchema>['energy_efficiency']
): EpcReading[] {
  const out: EpcReading[] = [];
  for (const p of rows ?? []) {
    const address = typeof p.address === 'string' ? p.address : null;
    if (!address) continue;
    out.push({
      address,
      rating: typeof p.rating === 'string' ? p.rating.toUpperCase() : null,
      efficiency: typeof p.score === 'number' ? p.score : null,
      potentialRating: null,
      propertyType: null,
      inspectionDate:
        typeof p.inspection_date === 'string' ? p.inspection_date : null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Endpoint: /freeholds (tenure detection) — RICE B
// ---------------------------------------------------------------------------

/**
 * Real shape (captured 2026-09-13): `data[]` is a list of registered
 * FREEHOLD TITLES near the postcode — `title_number`, `class` ("Absolute
 * freehold title"), `num_polygons` and `polygons[]` of `{ id, lat, lng,
 * distance, num_points, leaseholds }` where `leaseholds` counts the leasehold
 * titles registered against that polygon. Plus `result_count` and
 * `api_calls_cost`. There are NO addresses, NO per-property tenure and NO
 * lease lengths — the fields the old schema read never existed.
 */
const FreeholdsSchema = z
  .object({
    status: z.string().optional(),
    postcode: z.string().optional(),
    url: z.string().optional(),
    result_count: z.number().optional(),
    api_calls_cost: z.number().optional(),
    data: z
      .array(
        z
          .object({
            title_number: z.string().optional(),
            class: z.string().optional(),
            num_polygons: z.number().optional(),
            polygons: z
              .array(
                z
                  .object({
                    id: z.number().optional(),
                    lat: z.number().optional(),
                    lng: z.number().optional(),
                    distance: z.union([z.string(), z.number()]).optional(),
                    num_points: z.number().optional(),
                    leaseholds: z.number().optional(),
                  })
                  .partial()
                  .passthrough()
              )
              .optional(),
          })
          .partial()
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

export type FreeholdTitle = {
  titleNumber: string;
  /** HMLR class as published, e.g. "Absolute freehold title". */
  titleClass: string | null;
  polygons: Array<{
    lat: number | null;
    lng: number | null;
    /** Distance from the queried postcode, miles. */
    distanceMiles: number | null;
    /** Leasehold titles registered against this polygon (0 = none). */
    leaseholds: number | null;
  }>;
};

/**
 * Registered freehold titles near a postcode, with the count of leaseholds
 * carved out of each. This is what /freeholds actually returns. ~1 credit
 * per call (`api_calls_cost`), 30-day cache.
 */
export async function getFreeholdTitles(
  postcode: string
): Promise<FreeholdTitle[]> {
  const data = unwrap(
    '/freeholds',
    await fetchPropertyData(
      '/freeholds',
      { postcode },
      {
        ttlMs: 30 * 24 * 60 * 60 * 1000,
        estimatedCredits: 1,
        schema: FreeholdsSchema,
        hasContent: (d) => Array.isArray(d.data),
      }
    )
  );
  const out: FreeholdTitle[] = [];
  for (const t of data?.data ?? []) {
    if (typeof t.title_number !== 'string') continue;
    out.push({
      titleNumber: t.title_number,
      titleClass: typeof t.class === 'string' ? t.class : null,
      polygons: (t.polygons ?? []).map((p) => ({
        lat: typeof p.lat === 'number' ? p.lat : null,
        lng: typeof p.lng === 'number' ? p.lng : null,
        distanceMiles: toNumber(p.distance),
        leaseholds: typeof p.leaseholds === 'number' ? p.leaseholds : null,
      })),
    });
  }
  return out;
}

export type TenureReading = {
  address: string;
  tenure: 'freehold' | 'leasehold' | 'unknown';
  remainingLeaseYears: number | null;
  groundRentPerYear: number | null;
  serviceChargePerYear: number | null;
};

const TENURE_UNAVAILABLE_REASON =
  '/freeholds carries no per-address tenure or lease length (verified against a real response, 2026-09-13) — the short-lease screen needs another source';

let tenureUnavailableLogged = false;

/**
 * Per-address tenure + remaining lease years. There is currently NO source for
 * this: the /freeholds endpoint this was written against returns title
 * polygons, not addresses (see FreeholdsSchema). Rather than return an empty
 * register — which every caller reads as "no leasehold here" and which cleared
 * the short-lease flag before — this reports `failed` with the reason, spends
 * no credits, and lets the preflight route the offer to a person. Swap the body
 * for a real lookup (HMLR Registered Leases, or a PropertyData endpoint that
 * has been probed) when one exists.
 */
export async function getTenureByPostcodeResult(
  _postcode: string
): Promise<PropertyDataResult<TenureReading[]>> {
  if (!tenureUnavailableLogged) {
    tenureUnavailableLogged = true;
    console.warn(
      `[propertydata] tenure lookup unavailable: ${TENURE_UNAVAILABLE_REASON}`
    );
  }
  return { outcome: 'failed', error: TENURE_UNAVAILABLE_REASON };
}

export async function getTenureByPostcode(
  postcode: string
): Promise<TenureReading[]> {
  return unwrap('/freeholds', await getTenureByPostcodeResult(postcode)) ?? [];
}

// ---------------------------------------------------------------------------
// Endpoint: /listings — active Rightmove-style listings — RICE A
// ---------------------------------------------------------------------------

const ListingsSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      properties: z
        .array(
          z
            .object({
              address: z.string().optional(),
              postcode: z.string().optional(),
              price: z.number().optional(),
              bedrooms: z.number().optional(),
              property_type: z.string().optional(),
              listing_url: z.string().optional(),
              days_on_market: z.number().optional(),
              price_changes: z.number().optional(),
              agent_name: z.string().optional(),
              agent_phone: z.string().optional(),
            })
            .partial()
        )
        .optional(),
    })
    .partial()
    .optional(),
});

export type ActiveListing = {
  address: string;
  postcode: string;
  pricePence: number | null;
  bedrooms: number | null;
  propertyType: string | null;
  listingUrl: string | null;
  daysOnMarket: number | null;
  priceChangeCount: number | null;
  agentName: string | null;
  agentPhone: string | null;
};

/**
 * Active sales listings in an area. We use this for the stale-listing
 * harvester — properties that have been on market >60 days without selling
 * are motivated-seller territory. ~3 credits, 1-day cache.
 */
export async function getActiveListings(
  postcode: string,
  opts?: { radiusMiles?: number; minDaysOnMarket?: number }
): Promise<ActiveListing[]> {
  const params: Record<string, string | number> = { postcode };
  if (typeof opts?.radiusMiles === 'number') params.radius = opts.radiusMiles;

  const data = unwrap(
    '/listings',
    await fetchPropertyData('/listings', params, {
      ttlMs: 24 * 60 * 60 * 1000,
      estimatedCredits: 3,
      schema: ListingsSchema,
      hasContent: (d) => Array.isArray(d.result?.properties),
    })
  );
  const rows = (data as { result?: { properties?: unknown[] } } | null)?.result
    ?.properties;
  if (!Array.isArray(rows)) return [];
  const minDays = opts?.minDaysOnMarket ?? 0;
  const out: ActiveListing[] = [];
  for (const raw of rows) {
    const p = raw as Record<string, unknown>;
    const address = typeof p.address === 'string' ? p.address.trim() : null;
    const postcodeOut =
      typeof p.postcode === 'string' ? p.postcode.toUpperCase().trim() : null;
    if (!address || !postcodeOut) continue;
    const dom = typeof p.days_on_market === 'number' ? p.days_on_market : null;
    if (dom !== null && dom < minDays) continue;
    out.push({
      address,
      postcode: postcodeOut,
      pricePence:
        typeof p.price === 'number' ? Math.round(p.price * 100) : null,
      bedrooms: typeof p.bedrooms === 'number' ? p.bedrooms : null,
      propertyType:
        typeof p.property_type === 'string' ? p.property_type : null,
      listingUrl: typeof p.listing_url === 'string' ? p.listing_url : null,
      daysOnMarket: dom,
      priceChangeCount:
        typeof p.price_changes === 'number' ? p.price_changes : null,
      agentName: typeof p.agent_name === 'string' ? p.agent_name : null,
      agentPhone: typeof p.agent_phone === 'string' ? p.agent_phone : null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Endpoint: /growth (price growth + forecast) — RICE C
// ---------------------------------------------------------------------------

/**
 * Real shape (captured 2026-09-13): `data` is an ARRAY of yearly rows, each a
 * 3-tuple `[label, averagePricePounds, growthPctString | null]`, e.g.
 * `["Sep 2021", 231365, "7.9%"]`, oldest first, seven rows ending in the
 * current month. The first row's growth is null (nothing to compare to). No
 * `result` object and no named `annual_growth` / `forecast_growth` fields.
 */
const GrowthSchema = z
  .object({
    status: z.string().optional(),
    postcode: z.string().optional(),
    url: z.string().optional(),
    data: z
      .array(z.array(z.union([z.string(), z.number(), z.null()])))
      .optional(),
  })
  .passthrough();

export type GrowthSeriesPoint = {
  /** Row label as published, e.g. "Sep 2021". */
  label: string;
  averagePricePence: number;
  /** Change vs the previous row, %; null on the first row. */
  growthPct: number | null;
};

export type GrowthReading = {
  /** Change over the latest 12-month row, % (the last row's own figure). */
  annualGrowthPct: number | null;
  /** Price change from the row five years before the latest one, %. */
  fiveYearGrowthPct: number | null;
  /** Always null — the endpoint publishes history only, no forecast. */
  forecastGrowthPct: number | null;
  /** Always null — see above. */
  forecastPeriodMonths: number | null;
  /** The published yearly series, oldest first. */
  series: GrowthSeriesPoint[];
};

/**
 * Local price history by year. Used by Appraiser to adjust offer % of AVM
 * based on market trajectory. ~2 credits, 30-day cache.
 */
export async function getGrowthResult(
  postcode: string
): Promise<PropertyDataResult<GrowthReading | null>> {
  const res = await fetchPropertyData(
    '/growth',
    { postcode },
    {
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      estimatedCredits: 2,
      schema: GrowthSchema,
      hasContent: (d) => Array.isArray(d.data),
    }
  );
  if (res.outcome !== 'ok') return res;
  return { outcome: 'ok', value: readGrowth(res.value.data ?? []) };
}

export async function getGrowth(
  postcode: string
): Promise<GrowthReading | null> {
  return unwrap('/growth', await getGrowthResult(postcode)) ?? null;
}

function readGrowth(
  rows: Array<Array<string | number | null>>
): GrowthReading | null {
  const series: GrowthSeriesPoint[] = [];
  for (const row of rows) {
    const [label, price, pct] = row;
    if (typeof label !== 'string' || typeof price !== 'number') continue;
    series.push({
      label,
      averagePricePence: Math.round(price * 100),
      growthPct: typeof pct === 'number' ? pct : parsePercentString(pct),
    });
  }
  if (series.length === 0) return null;
  const latest = series[series.length - 1];
  const fiveBack = series.length >= 6 ? series[series.length - 6] : undefined;
  const fiveYearGrowthPct =
    latest && fiveBack && fiveBack.averagePricePence > 0
      ? Math.round(
          (latest.averagePricePence / fiveBack.averagePricePence - 1) * 1000
        ) / 10
      : null;
  return {
    annualGrowthPct: latest?.growthPct ?? null,
    fiveYearGrowthPct,
    forecastGrowthPct: null,
    forecastPeriodMonths: null,
    series,
  };
}

// ---------------------------------------------------------------------------
// Preflight checks — combine EPC + tenure + market temperature
// Used by the quote API path for every new submission. Cached endpoints so
// repeat hits on the same postcode are cheap. ~7 credits net per first-time
// postcode, 0 thereafter for the cache window.
// ---------------------------------------------------------------------------

/**
 * 'ok'          — the lookup ran; whatever it says is what the register holds.
 * 'unavailable' — the lookup FAILED. Every field beside it is a default, not a
 *                 finding, and no adjustment derived from it can be trusted.
 */
export type PreflightSourceStatus = 'ok' | 'unavailable';

export type PreflightChecks = {
  postcode: string;
  address?: string;
  epc: {
    rating: string | null;
    isLowEpc: boolean; // E/F/G — meaningful renovation discount
    matchedAddress: string | null;
    status: PreflightSourceStatus;
  };
  tenure: {
    tenure: 'freehold' | 'leasehold' | 'unknown';
    remainingLeaseYears: number | null;
    isShortLease: boolean; // <80 years — surveyor-level concern
    matchedAddress: string | null;
    status: PreflightSourceStatus;
  };
  marketTemperature: {
    /** Always null — /demand has no numeric score. See `demandRating`. */
    demandScore: number | null;
    /** PropertyData's text rating for the postcode, e.g. "Balanced market". */
    demandRating: string | null;
    daysOnMarketAvg: number | null;
    annualGrowthPct: number | null;
    forecastGrowthPct: number | null;
    /** Single-number heat index combining demand + growth, range -1..+1 */
    temperatureIndex: number | null;
    /** 'hot' | 'warm' | 'neutral' | 'cool' | 'cold' */
    band: 'hot' | 'warm' | 'neutral' | 'cool' | 'cold' | null;
    status: PreflightSourceStatus;
  };
  /** Lines suitable to append to a reasoning array */
  reasoning: string[];
  /** Suggested offer multiplier adjustment (-0.05 to +0.03) on AVM% */
  offerAdjustment: number;
  /**
   * True when at least one lookup FAILED (as opposed to finding nothing). The
   * factors it would have contributed are omitted from `offerAdjustment`, which
   * means the number is an incomplete answer, not a neutral one — the offer must
   * route to human review rather than be auto-committed. A 429 on /freeholds is
   * exactly the case where we previously cleared the short-lease flag and made a
   * HIGHER offer.
   */
  degraded: boolean;
  /** Which lookups failed: 'epc' | 'tenure' | 'demand' | 'growth'. */
  failedSources: string[];
};

function fuzzyMatchAddress<T extends { address: string }>(
  rows: T[],
  needle?: string
): T | null {
  if (!needle || rows.length === 0) return null;
  const n = needle.toLowerCase().replace(/[^a-z0-9]/g, '');
  let best: { row: T; score: number } | null = null;
  for (const row of rows) {
    const h = row.address.toLowerCase().replace(/[^a-z0-9]/g, '');
    let score = 0;
    if (h === n) score = 100;
    else if (h.startsWith(n) || n.startsWith(h)) score = 80;
    else if (h.includes(n) || n.includes(h)) score = 60;
    else continue;
    if (!best || score > best.score) best = { row, score };
  }
  return best?.row ?? null;
}

function temperatureBand(
  index: number | null
): PreflightChecks['marketTemperature']['band'] {
  if (index === null) return null;
  if (index >= 0.5) return 'hot';
  if (index >= 0.2) return 'warm';
  if (index >= -0.2) return 'neutral';
  if (index >= -0.5) return 'cool';
  return 'cold';
}

export async function runPreflightChecks(input: {
  postcode: string;
  address?: string;
}): Promise<PreflightChecks> {
  const { postcode, address } = input;
  // The result-returning variants so a FAILED lookup stays distinguishable from
  // an empty register all the way down to the reasoning string. `.catch` only
  // guards against a genuinely unexpected throw — the fetch layer itself no
  // longer signals failure by rejecting.
  const [epcRes, tenureRes, demandRes, growthRes] = await Promise.all([
    getEpcByPostcodeResult(postcode).catch(toFailedResult),
    getTenureByPostcodeResult(postcode).catch(toFailedResult),
    getMarketDemandResult(postcode).catch(toFailedResult),
    getGrowthResult(postcode).catch(toFailedResult),
  ]);

  const failedSources: string[] = [];
  const failureDetail: Record<string, string> = {};
  const record = (key: string, res: PropertyDataResult<unknown>) => {
    if (res.outcome === 'failed') {
      failedSources.push(key);
      failureDetail[key] = res.error;
    }
    return res.outcome === 'failed';
  };

  const epcFailed = record('epc', epcRes);
  const tenureFailed = record('tenure', tenureRes);
  const demandFailed = record('demand', demandRes);
  const growthFailed = record('growth', growthRes);

  const epcs = epcRes.outcome === 'ok' ? epcRes.value : [];
  const tenures = tenureRes.outcome === 'ok' ? tenureRes.value : [];
  const demand = demandRes.outcome === 'ok' ? demandRes.value : null;
  const growth = growthRes.outcome === 'ok' ? growthRes.value : null;

  const matchedEpc = fuzzyMatchAddress(epcs, address);
  const matchedTenure = fuzzyMatchAddress(tenures, address);

  const epcRating = matchedEpc?.rating ?? null;
  const isLowEpc =
    !!epcRating && ['E', 'F', 'G'].includes(epcRating.toUpperCase());

  const tenure = matchedTenure?.tenure ?? 'unknown';
  const remainingLeaseYears = matchedTenure?.remainingLeaseYears ?? null;
  const isShortLease =
    tenure === 'leasehold' &&
    typeof remainingLeaseYears === 'number' &&
    remainingLeaseYears < 80;

  // /demand publishes a text rating ("Balanced market") and days on market,
  // not a 0-100 score (verified against a real response, Sep 2026). We do not
  // map the rating to a number — the observed vocabulary is one value wide, and
  // an invented scale would be exactly the kind of guess this module bans.
  const demandScore: number | null = null;
  const demandRating = demand?.demandRating ?? null;
  const daysOnMarketAvg = demand?.daysOnMarket ?? null;

  const annualGrowthPct = growth?.annualGrowthPct ?? null;
  const forecastGrowthPct = growth?.forecastGrowthPct ?? null;

  // Temperature index. With no numeric demand score the only component is
  // growth: the latest 12-month price change (the endpoint publishes no
  // forecast either — `forecastGrowthPct` is kept for the day it does).
  //   +10% or better → +1 (hot) … −10% or worse → −1 (cold)
  let temperatureIndex: number | null = null;
  const components: number[] = [];
  if (typeof forecastGrowthPct === 'number') {
    // forecastGrowthPct typical range -10..+10 — normalise
    components.push(Math.max(-1, Math.min(1, forecastGrowthPct / 10)));
  } else if (typeof annualGrowthPct === 'number') {
    components.push(Math.max(-1, Math.min(1, annualGrowthPct / 10)));
  }
  if (components.length > 0) {
    temperatureIndex =
      Math.round(
        (components.reduce((s, x) => s + x, 0) / components.length) * 100
      ) / 100;
  }

  const band = temperatureBand(temperatureIndex);

  // Offer adjustment:
  //   Hot market →  +0.02 (we can pay closer to AVM and still win)
  //   Warm       →  +0.01
  //   Neutral    →   0
  //   Cool       →  -0.02
  //   Cold       →  -0.04
  const tempAdj =
    band === 'hot'
      ? 0.02
      : band === 'warm'
        ? 0.01
        : band === 'cool'
          ? -0.02
          : band === 'cold'
            ? -0.04
            : 0;

  // Either market source failing makes the temperature reading incomplete. When
  // BOTH failed there is no band at all — and a null band silently produces the
  // same 0 adjustment as a genuinely neutral market, which is the collapse this
  // whole change exists to stop.
  const marketFailed = demandFailed || growthFailed;

  // Low EPC: -0.01 (Appraiser already discounts in AVM but we surface it
  // again at the offer% layer for transparency).
  //
  // A FAILED EPC lookup contributes NOTHING rather than a confident zero: we
  // have no idea whether this property is an F. The missing factor is why the
  // preflight reports `degraded`.
  const epcAdj = epcFailed ? 0 : isLowEpc ? -0.01 : 0;

  // Short lease: surface only — actual discount handled by lease curve in
  // the offer-calc layer. We don't double-count.
  const offerAdjustment = Math.round((tempAdj + epcAdj) * 1000) / 1000;

  const reasoning: string[] = [];
  if (epcFailed) {
    reasoning.push(
      `EPC: lookup UNAVAILABLE (${failureDetail.epc}) — no EPC adjustment applied and no certificate was ruled out; sent for review`
    );
  } else if (matchedEpc) {
    reasoning.push(
      `EPC ${epcRating ?? '?'} from register (${matchedEpc.address})${isLowEpc ? ' — meaningful renovation cost expected' : ''}`
    );
  } else {
    reasoning.push('EPC: no certificate matched on this address');
  }
  if (tenureFailed) {
    reasoning.push(
      `Tenure: lookup UNAVAILABLE (${failureDetail.tenure}) — short-lease screen NOT performed; sent for review`
    );
  } else if (matchedTenure) {
    if (tenure === 'leasehold') {
      reasoning.push(
        `Tenure: leasehold${remainingLeaseYears ? `, ${remainingLeaseYears} years remaining` : ''}${isShortLease ? ' — SHORT LEASE FLAG' : ''}`
      );
    } else if (tenure === 'freehold') {
      reasoning.push('Tenure: freehold');
    }
  }
  if (band) {
    reasoning.push(
      `Market: ${band}${demandRating ? ` (${demandRating.toLowerCase()}${typeof daysOnMarketAvg === 'number' ? `, ${Math.round(daysOnMarketAvg)} days on market` : ''})` : ''}${typeof forecastGrowthPct === 'number' ? `, forecast ${forecastGrowthPct > 0 ? '+' : ''}${forecastGrowthPct.toFixed(1)}%` : typeof annualGrowthPct === 'number' ? `, 12-month change ${annualGrowthPct > 0 ? '+' : ''}${annualGrowthPct.toFixed(1)}%` : ''} — offer adjusted ${tempAdj > 0 ? '+' : ''}${(tempAdj * 100).toFixed(1)}%${marketFailed ? ' (PARTIAL — one market source unavailable)' : ''}`
    );
  } else if (marketFailed) {
    reasoning.push(
      `Market temperature: lookup UNAVAILABLE (${failureDetail.demand ?? failureDetail.growth}) — no market adjustment applied; sent for review`
    );
  }

  if (failedSources.length > 0) {
    console.warn(
      `[propertydata] preflight ${postcode} degraded — ${failedSources.join(', ')} unavailable`
    );
  }

  return {
    postcode,
    address,
    epc: {
      rating: epcRating,
      isLowEpc,
      matchedAddress: matchedEpc?.address ?? null,
      status: epcFailed ? 'unavailable' : 'ok',
    },
    tenure: {
      tenure,
      remainingLeaseYears,
      isShortLease,
      matchedAddress: matchedTenure?.address ?? null,
      status: tenureFailed ? 'unavailable' : 'ok',
    },
    marketTemperature: {
      demandScore,
      demandRating,
      daysOnMarketAvg,
      annualGrowthPct,
      forecastGrowthPct,
      temperatureIndex,
      band,
      status: marketFailed ? 'unavailable' : 'ok',
    },
    reasoning,
    offerAdjustment,
    degraded: failedSources.length > 0,
    failedSources,
  };
}

// ---------------------------------------------------------------------------
// Endpoint: /account/credits — budget visibility
// ---------------------------------------------------------------------------

const CreditsSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      credits_used: z.number().optional(),
      credits_remaining: z.number().optional(),
      credits_total: z.number().optional(),
      plan: z.string().optional(),
      reset_date: z.string().optional(),
    })
    .partial()
    .optional(),
});

/**
 * Account credit balance. Free to call (PropertyData doesn't bill for this).
 * Refreshed every 60s in the dashboard so the credit panel stays accurate
 * without thrashing the endpoint.
 */
export async function getAccountCredits() {
  return unwrap(
    '/account/credits',
    await fetchPropertyData(
      '/account/credits',
      {},
      {
        ttlMs: 60 * 1000, // 1 minute
        estimatedCredits: 0,
        schema: CreditsSchema,
        hasContent: (d) => d.result !== undefined,
      }
    )
  );
}

// ---------------------------------------------------------------------------
// Endpoint: /planning-applications — local planning activity
// Properties with active planning applications are often in transition
// (owner did refurb, ready to sell, or stuck waiting for permission).
// ---------------------------------------------------------------------------

const PlanningApplicationsSchema = z.object({
  status: z.string().optional(),
  postcode: z.string().optional(),
  result_count: z.number().optional(),
  data: z
    .object({
      planning_applications: z
        .array(
          z
            .object({
              url: z.string().optional(),
              address: z.string().optional(),
              authority: z.string().optional(),
              reference: z.string().optional(),
              category: z.string().optional(),
              proposal: z.string().optional(),
              type: z.string().optional(),
              status: z.string().optional(),
              decision: z
                .object({
                  text: z.string().optional(),
                  rating: z.string().optional(),
                })
                .partial()
                .optional(),
              dates: z
                .object({
                  received_at: z.string().optional(),
                  decided_at: z.string().optional(),
                })
                .partial()
                .optional(),
              lat: z.number().optional(),
              lng: z.number().optional(),
              distance: z.string().optional(),
            })
            .partial()
        )
        .optional(),
    })
    .partial()
    .optional(),
});

export type PlanningApplication = {
  address: string;
  postcode: string | null;
  authority: string | null;
  reference: string;
  category: string | null;
  proposal: string | null;
  status: string | null;
  decision: string | null;
  decisionRating: 'positive' | 'negative' | 'neutral' | null;
  receivedAt: string | null;
  decidedAt: string | null;
  url: string | null;
  distanceMiles: number | null;
  /** Heuristic motivated-seller score (0-100) for this application. */
  sellerSignalScore: number;
};

/**
 * Local planning applications. Returns properties with recent planning
 * activity in the postcode + radius. Filters to residential-relevant
 * categories and scores by recency + decision type.
 *
 * ~2 credits per call. 7-day cache (planning data updates slowly).
 */
export async function getPlanningApplications(
  postcode: string,
  opts?: { radiusMiles?: number }
): Promise<PlanningApplication[]> {
  const params: Record<string, string | number> = { postcode };
  if (typeof opts?.radiusMiles === 'number') {
    params.radius = opts.radiusMiles;
  }
  const data = unwrap(
    '/planning-applications',
    await fetchPropertyData('/planning-applications', params, {
      ttlMs: 7 * 24 * 60 * 60 * 1000,
      estimatedCredits: 2,
      schema: PlanningApplicationsSchema,
      hasContent: (d) => Array.isArray(d.data?.planning_applications),
    })
  );
  const apps = (data as { data?: { planning_applications?: unknown[] } } | null)
    ?.data?.planning_applications;
  if (!Array.isArray(apps)) return [];

  const now = Date.now();
  const out: PlanningApplication[] = [];
  for (const raw of apps) {
    const a = raw as Record<string, unknown>;
    const address = typeof a.address === 'string' ? a.address.trim() : null;
    const reference = typeof a.reference === 'string' ? a.reference : null;
    if (!address || !reference) continue;

    const category = typeof a.category === 'string' ? a.category : null;
    // Skip pure council/commercial — not motivated-seller territory
    if (category === 'commercial' || category === 'council') continue;

    const decision = a.decision as Record<string, unknown> | undefined;
    const decisionText =
      typeof decision?.text === 'string' ? decision.text : null;
    const decisionRating = (
      typeof decision?.rating === 'string' ? decision.rating : null
    ) as PlanningApplication['decisionRating'];

    const dates = a.dates as Record<string, unknown> | undefined;
    const receivedAt =
      typeof dates?.received_at === 'string' ? dates.received_at : null;
    const decidedAt =
      typeof dates?.decided_at === 'string' ? dates.decided_at : null;

    // Heuristic score: recent applications with decisions = motivated owner.
    // Recently DENIED = stuck owner (high signal). Recently APPROVED + listed
    // = ready to sell. Pending = wait-and-see.
    let sellerSignalScore = 40;
    if (decidedAt) {
      const ageDays =
        (now - new Date(decidedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays < 90) sellerSignalScore += 20;
      else if (ageDays < 365) sellerSignalScore += 10;
    }
    if (decisionRating === 'negative') sellerSignalScore += 25;
    if (decisionRating === 'positive') sellerSignalScore += 10;
    sellerSignalScore = Math.max(0, Math.min(100, sellerSignalScore));

    // Extract postcode from address if possible
    const pcMatch = address.match(/[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}/);
    const distanceStr = typeof a.distance === 'string' ? a.distance : null;
    const distanceMiles = distanceStr ? Number(distanceStr) : null;

    out.push({
      address,
      postcode: pcMatch ? pcMatch[0] : null,
      authority: typeof a.authority === 'string' ? a.authority : null,
      reference,
      category,
      proposal: typeof a.proposal === 'string' ? a.proposal : null,
      status: typeof a.status === 'string' ? a.status : null,
      decision: decisionText,
      decisionRating,
      receivedAt,
      decidedAt,
      url: typeof a.url === 'string' ? a.url : null,
      distanceMiles: Number.isFinite(distanceMiles) ? distanceMiles : null,
      sellerSignalScore,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Endpoint: /national-hmo-register — HMO licence register
// ---------------------------------------------------------------------------

const HmoRegisterSchema = z.object({
  status: z.string().optional(),
  data: z
    .object({
      hmos: z
        .array(
          z
            .object({
              council: z.string().optional(),
              reference: z.string().optional(),
              address: z.string().optional(),
              occupancy: z.string().nullable().optional(),
              licence_expiry: z.string().optional(),
              licence_type: z.string().optional(),
              distance_miles: z.string().optional(),
            })
            .partial()
        )
        .optional(),
    })
    .partial()
    .optional(),
});

export type HmoRecord = {
  address: string;
  council: string | null;
  reference: string;
  licenceType: string | null;
  licenceExpiry: string | null;
  distanceMiles: number | null;
  /** True if the licence expires within the next 12 months (often triggers sale). */
  licenceExpiringSoon: boolean;
};

/**
 * Licensed HMOs in the postcode area. HMO investor portfolios often sell
 * around licence expiry (12-18 months out is a strong signal). ~2 credits.
 */
export async function getHmoRegister(
  postcode: string,
  opts?: { radiusMiles?: number }
): Promise<HmoRecord[]> {
  const params: Record<string, string | number> = { postcode };
  if (typeof opts?.radiusMiles === 'number') {
    params.radius = opts.radiusMiles;
  }
  const data = unwrap(
    '/national-hmo-register',
    await fetchPropertyData('/national-hmo-register', params, {
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      estimatedCredits: 2,
      schema: HmoRegisterSchema,
      hasContent: (d) => Array.isArray(d.data?.hmos),
    })
  );
  const hmos = (data as { data?: { hmos?: unknown[] } } | null)?.data?.hmos;
  if (!Array.isArray(hmos)) return [];

  const now = Date.now();
  const out: HmoRecord[] = [];
  for (const raw of hmos) {
    const h = raw as Record<string, unknown>;
    const address = typeof h.address === 'string' ? h.address.trim() : null;
    const reference = typeof h.reference === 'string' ? h.reference : null;
    if (!address || !reference) continue;

    const expiry =
      typeof h.licence_expiry === 'string' ? h.licence_expiry : null;
    let licenceExpiringSoon = false;
    if (expiry) {
      // Parse formats like "7th November 2028" or "2028-11-07"
      const parsed = Date.parse(expiry.replace(/(\d+)(st|nd|rd|th)/, '$1'));
      if (!isNaN(parsed)) {
        const monthsUntil = (parsed - now) / (1000 * 60 * 60 * 24 * 30);
        licenceExpiringSoon = monthsUntil > 0 && monthsUntil <= 12;
      }
    }

    const distStr =
      typeof h.distance_miles === 'string' ? h.distance_miles : null;
    const distanceMiles = distStr ? Number(distStr) : null;

    out.push({
      address,
      council: typeof h.council === 'string' ? h.council : null,
      reference,
      licenceType: typeof h.licence_type === 'string' ? h.licence_type : null,
      licenceExpiry: expiry,
      distanceMiles: Number.isFinite(distanceMiles) ? distanceMiles : null,
      licenceExpiringSoon,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Endpoint: /demographics — local age + household composition
// Used for pre-probate signal: postcodes with high >65 population are
// where probate grants will land in the coming years.
// ---------------------------------------------------------------------------

const DemographicsSchema = z.object({
  status: z.string().optional(),
  // Permissive — different plans return different keys
  data: z.record(z.string(), z.unknown()).optional(),
  result: z.record(z.string(), z.unknown()).optional(),
  age_bands: z.record(z.string(), z.unknown()).optional(),
});

export type DemographicsReading = {
  /** Estimated % of population aged 65+. Null when unavailable. */
  percentOver65: number | null;
  /** Estimated % aged 75+. Null when unavailable. */
  percentOver75: number | null;
  raw: Record<string, unknown> | null;
};

/**
 * Demographics for a postcode area. ~2 credits, 90-day cache (census
 * data updates rarely).
 *
 * We're permissive about response shape since PropertyData has been
 * known to vary the keys by plan. We walk the response looking for
 * any "age" / "65" / "75" markers.
 */
export async function getDemographics(
  postcode: string
): Promise<DemographicsReading | null> {
  const data = unwrap(
    '/demographics',
    await fetchPropertyData(
      '/demographics',
      { postcode },
      {
        ttlMs: 90 * 24 * 60 * 60 * 1000,
        estimatedCredits: 2,
        schema: DemographicsSchema,
        // Deliberately loose — the response keys vary by plan, so all we can
        // assert is that ONE of the three known containers came back.
        hasContent: (d) =>
          d.data !== undefined ||
          d.result !== undefined ||
          d.age_bands !== undefined,
      }
    )
  );
  if (!data) return null;
  const raw = (data as Record<string, unknown>) ?? null;

  // Walk the tree looking for numeric percentages under age-65/75 keys.
  // We store in single-element arrays so closure-mutation doesn't confuse
  // TypeScript's narrowing (it would otherwise infer `never` after assignment).
  const over65: number[] = [];
  const over75: number[] = [];
  const walk = (v: unknown, path: string): void => {
    if (v === null || v === undefined) return;
    if (typeof v === 'number') {
      const k = path.toLowerCase();
      if (
        over65.length === 0 &&
        /(65|over_?65|ages?_65|65\+|sixty_?five)/.test(k)
      ) {
        over65.push(v);
      }
      if (
        over75.length === 0 &&
        /(75|over_?75|ages?_75|75\+|seventy_?five)/.test(k)
      ) {
        over75.push(v);
      }
      return;
    }
    if (typeof v === 'object') {
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        walk(child, `${path}.${k}`);
      }
    }
  };
  walk(raw, '');

  // Heuristic: many endpoints return age share as fractions (0-1). Normalise
  // to percentages.
  const normalise = (v: number): number => (v <= 1 ? v * 100 : v);
  const percentOver65 = over65.length > 0 ? normalise(over65[0]!) : null;
  const percentOver75 = over75.length > 0 ? normalise(over75[0]!) : null;

  return { percentOver65, percentOver75, raw };
}

// ---------------------------------------------------------------------------
// Endpoint: /sold-prices — recent comparable sales
// ---------------------------------------------------------------------------

/**
 * Real shape (captured 2026-09-13): `data.average` (pounds) and
 * `data.raw_data[]` of sales — `date`, `address` (ends with the full
 * postcode), `price` (pounds), `lat`/`lng`, `bedrooms` (may be null),
 * `type` ("terraced_house"…), `tenure`, `class`, `distance` (miles, string),
 * `url`. Also `points_analysed`, `radius`, `date_earliest`, `date_latest`.
 * There is no `result`, no `median` and no per-sale `postcode` field.
 */
const SoldPricesSchema = z
  .object({
    status: z.string().optional(),
    postcode: z.string().optional(),
    url: z.string().optional(),
    max_age: z.number().optional(),
    data: z
      .object({
        points_analysed: z.number().optional(),
        radius: z.union([z.string(), z.number()]).optional(),
        date_earliest: z.string().optional(),
        date_latest: z.string().optional(),
        average: z.number().optional(),
        raw_data: z
          .array(
            z
              .object({
                date: z.string().optional(),
                address: z.string().optional(),
                price: z.number().optional(),
                lat: z.union([z.number(), z.string()]).optional(),
                lng: z.union([z.number(), z.string()]).optional(),
                bedrooms: z.number().nullable().optional(),
                type: z.string().optional(),
                tenure: z.string().optional(),
                class: z.string().optional(),
                distance: z.union([z.string(), z.number()]).optional(),
                url: z.string().optional(),
              })
              .partial()
              .passthrough()
          )
          .optional(),
      })
      .partial()
      .passthrough()
      .optional(),
  })
  .passthrough();

export type SoldTransaction = {
  address: string;
  /** Parsed from the tail of `address` — the endpoint has no postcode field. */
  postcode: string | null;
  pricePence: number;
  date: string;
  /** PropertyData's own type value, e.g. "terraced_house". */
  propertyType: string | null;
  tenure: string | null;
  /** Coordinates the endpoint supplies for the sale. */
  lat: number | null;
  lng: number | null;
  bedrooms: number | null;
  /** Distance from the queried postcode, miles. */
  distanceMiles: number | null;
};

export type SoldPrices = {
  averagePricePence: number | null;
  /** Always null — the endpoint publishes an average only. */
  medianPricePence: number | null;
  transactions: SoldTransaction[];
};

/**
 * Full UK postcode at the end of an address string ("…, DL2 3LD"). Strict on
 * purpose: a partial match would invent a postcode, and postcodes here feed
 * geocoding in the distance-weighted comps.
 */
const TRAILING_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\s*$/i;

function postcodeFromAddress(address: string): string | null {
  const m = address.trim().match(TRAILING_POSTCODE);
  if (!m?.[1]) return null;
  const compact = m[1].replace(/\s+/g, '').toUpperCase();
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export type SoldPricesOptions = {
  /** Sale-age window in months. PropertyData allows 3-84; default 18. */
  maxAgeMonths?: number;
  /** Restrict to a single AVM property type. */
  type?: 'detached' | 'semi-detached' | 'terraced' | 'flat';
  /** Restrict to a bedroom count (0-5). */
  bedrooms?: number;
  /** How many comparable data points to pull (15-100). Higher = wider net. */
  points?: number;
};

export async function getSoldPrices(
  postcode: string,
  opts: SoldPricesOptions = {}
): Promise<SoldPrices | null> {
  // Clamp to PropertyData's documented ranges so a bad caller value can't 4xx.
  const maxAge =
    opts.maxAgeMonths != null
      ? Math.min(84, Math.max(3, Math.round(opts.maxAgeMonths)))
      : undefined;
  const points =
    opts.points != null
      ? Math.min(100, Math.max(15, Math.round(opts.points)))
      : undefined;
  const bedrooms =
    opts.bedrooms != null
      ? Math.min(5, Math.max(0, Math.round(opts.bedrooms)))
      : undefined;

  const data = unwrap(
    '/sold-prices',
    await fetchPropertyData(
      '/sold-prices',
      {
        postcode,
        max_age: maxAge,
        // NB: /sold-prices takes `type`, NOT `property_type` (which /valuation-sale
        // uses) — the param names genuinely differ between endpoints. The prod
        // errors confirm it: /valuation-sale threw "Missing input: property_type"
        // (a param-name fix), while /sold-prices threw "Invalid filter: type" (a
        // value fix, done via toPropertyDataType). Do not "align" these to match —
        // verify against a real captured response first (docs/LEARNINGS.md).
        type: toPropertyDataType(opts.type),
        bedrooms,
        points,
      },
      {
        ttlMs: 7 * 24 * 60 * 60 * 1000,
        estimatedCredits: 2,
        schema: SoldPricesSchema,
        hasContent: (d) =>
          Array.isArray(d.data?.raw_data) ||
          typeof d.data?.average === 'number',
      }
    )
  );
  const r = data?.data;
  if (!r) return null;
  const transactions: SoldTransaction[] = [];
  for (const t of r.raw_data ?? []) {
    const address = typeof t.address === 'string' ? t.address : null;
    const price = typeof t.price === 'number' ? t.price : null;
    const date = typeof t.date === 'string' ? t.date : null;
    if (!address || !price || !date) continue;
    transactions.push({
      address,
      postcode: postcodeFromAddress(address),
      pricePence: Math.round(price * 100),
      date,
      propertyType: typeof t.type === 'string' ? t.type : null,
      tenure: typeof t.tenure === 'string' ? t.tenure : null,
      lat: toNumber(t.lat),
      lng: toNumber(t.lng),
      bedrooms: typeof t.bedrooms === 'number' ? t.bedrooms : null,
      distanceMiles: toNumber(t.distance),
    });
  }
  return {
    averagePricePence:
      typeof r.average === 'number' ? Math.round(r.average * 100) : null,
    medianPricePence: null,
    transactions,
  };
}

// ---------------------------------------------------------------------------
// Endpoint: /yields — rental yield for area
// ---------------------------------------------------------------------------

/**
 * Real shape (captured 2026-09-13): `data.long_let.gross_yield` is a percent
 * STRING ("2.8%"), with `points_analysed` and `radius` beside it. No low/high
 * band, no `result` object.
 */
const YieldsSchema = z
  .object({
    status: z.string().optional(),
    postcode: z.string().optional(),
    url: z.string().optional(),
    data: z
      .object({
        long_let: z
          .object({
            points_analysed: z.number().optional(),
            radius: z.union([z.string(), z.number()]).optional(),
            gross_yield: z.union([z.string(), z.number()]).optional(),
          })
          .partial()
          .passthrough()
          .optional(),
      })
      .partial()
      .passthrough()
      .optional(),
  })
  .passthrough();

export type YieldsReading = {
  averageYieldPct: number | null;
  /** Always null — the endpoint publishes a single long-let gross yield. */
  lowYieldPct: number | null;
  /** Always null — see above. */
  highYieldPct: number | null;
};

export async function getYields(
  postcode: string
): Promise<YieldsReading | null> {
  const data = unwrap(
    '/yields',
    await fetchPropertyData(
      '/yields',
      { postcode },
      {
        ttlMs: 30 * 24 * 60 * 60 * 1000,
        estimatedCredits: 2,
        schema: YieldsSchema,
        hasContent: (d) => d.data?.long_let?.gross_yield !== undefined,
        // ~9s upstream (live rental scrape); 10s default timed out every call.
        timeoutMs: 30_000,
      }
    )
  );
  const longLet = data?.data?.long_let;
  if (!longLet) return null;
  const gross = longLet.gross_yield;
  return {
    averageYieldPct:
      typeof gross === 'number' ? gross : parsePercentString(gross),
    lowYieldPct: null,
    highYieldPct: null,
  };
}

// ---------------------------------------------------------------------------
// Endpoint: /prices-per-sqf — local £/sqft benchmarks
// ---------------------------------------------------------------------------

/**
 * Real shape (captured 2026-09-13): everything lives under `data` —
 * `average` (£ per sq ft, e.g. 210), `points_analysed`, `radius` (miles, as
 * a string), the `70pc_range`…`100pc_range` pairs and `raw_data[]` of the
 * asking-price listings analysed (`sqf`, `price_per_sqf`, `price`, `type`…).
 * The unit is confirmed by the field names (`sqf`, `price_per_sqf`). There is
 * no `median`.
 */
const PricesPerSqfSchema = z
  .object({
    status: z.string().optional(),
    postcode: z.string().optional(),
    url: z.string().optional(),
    data: z
      .object({
        points_analysed: z.number().optional(),
        radius: z.union([z.string(), z.number()]).optional(),
        average: z.number().optional(),
        raw_data: z
          .array(
            z
              .object({
                address: z.string().optional(),
                price: z.number().optional(),
                bedrooms: z.number().nullable().optional(),
                type: z.string().optional(),
                sqf: z.number().optional(),
                price_per_sqf: z.number().optional(),
                distance: z.union([z.string(), z.number()]).optional(),
                days_on_market: z.number().optional(),
                portal: z.string().optional(),
              })
              .partial()
              .passthrough()
          )
          .optional(),
      })
      .partial()
      .passthrough()
      .optional(),
  })
  .passthrough();

export type PricesPerSqf = {
  averagePerSqft: number | null;
  /** Always null — the endpoint publishes an average only. */
  medianPerSqft: number | null;
  /** How many asking-price listings the average was drawn from. */
  pointsAnalysed: number | null;
};

export async function getPricesPerSqf(
  postcode: string
): Promise<PricesPerSqf | null> {
  const data = unwrap(
    '/prices-per-sqf',
    await fetchPropertyData(
      '/prices-per-sqf',
      { postcode },
      {
        ttlMs: 30 * 24 * 60 * 60 * 1000,
        estimatedCredits: 2,
        schema: PricesPerSqfSchema,
        hasContent: (d) =>
          typeof d.data?.average === 'number' ||
          Array.isArray(d.data?.raw_data),
      }
    )
  );
  const r = data?.data;
  if (!r) return null;
  return {
    averagePerSqft: typeof r.average === 'number' ? r.average : null,
    medianPerSqft: null,
    pointsAnalysed:
      typeof r.points_analysed === 'number' ? r.points_analysed : null,
  };
}

// ---------------------------------------------------------------------------
// Endpoint: /council-tax — average council tax bills
// ---------------------------------------------------------------------------

/**
 * Real shape (captured 2026-09-13, scripts/propertydata-probe.mts): the
 * council's band table sits at the top level under `council_tax` as
 * `band_a`…`band_h` → "1,748.10" (pounds, comma-grouped strings), plus a
 * `properties[]` list of `{ address, band }` for the postcode. There is no
 * `result` object, no postcode-level `band` and no `average_annual_bill`.
 */
const CouncilTaxSchema = z
  .object({
    status: z.string().optional(),
    postcode: z.string().optional(),
    council: z.string().optional(),
    council_rating: z.string().optional(),
    year: z.string().optional(),
    council_tax: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .optional(),
    note: z.string().optional(),
    properties: z
      .array(
        z
          .object({
            address: z.string().optional(),
            band: z.string().optional(),
          })
          .partial()
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

export type CouncilTaxReading = {
  /**
   * Always null: the endpoint publishes the band table and per-address bands,
   * not an average bill. Kept for persisted snapshots and their readers.
   */
  averageAnnualBill: number | null;
  /** Always null at postcode level — see `propertyBands` for per-address bands. */
  band: string | null;
  /** Map of band letter (A–H) → annual £ for the council's current year. */
  bandsByLetter: Record<string, number>;
  /** Billing authority, e.g. "Durham". */
  council: string | null;
  /** Tax year the band table applies to, e.g. "2026/27". */
  year: string | null;
  /** Per-address bands the endpoint lists for the postcode. */
  propertyBands: Array<{ address: string; band: string }>;
};

export async function getCouncilTax(
  postcode: string
): Promise<CouncilTaxReading | null> {
  const data = unwrap(
    '/council-tax',
    await fetchPropertyData(
      '/council-tax',
      { postcode },
      {
        ttlMs: 90 * 24 * 60 * 60 * 1000,
        estimatedCredits: 2,
        schema: CouncilTaxSchema,
        hasContent: (d) =>
          d.council_tax !== undefined || Array.isArray(d.properties),
      }
    )
  );
  if (!data) return null;
  const bands: Record<string, number> = {};
  for (const [key, val] of Object.entries(data.council_tax ?? {})) {
    // Keys arrive as `band_a` … `band_h`; values as "1,748.10" (pounds).
    const letter = key.replace(/^band_/i, '').toUpperCase();
    const amount = typeof val === 'number' ? val : parsePoundsString(val);
    if (letter.length === 1 && amount !== null) bands[letter] = amount;
  }
  const propertyBands: CouncilTaxReading['propertyBands'] = [];
  for (const p of data.properties ?? []) {
    if (typeof p.address === 'string' && typeof p.band === 'string') {
      propertyBands.push({ address: p.address, band: p.band.toUpperCase() });
    }
  }
  return {
    averageAnnualBill: null,
    band: null,
    bandsByLetter: bands,
    council: typeof data.council === 'string' ? data.council : null,
    year: typeof data.year === 'string' ? data.year : null,
    propertyBands,
  };
}

// ---------------------------------------------------------------------------
// getPropertySnapshot — Tier 1 + Tier 2 enrichment for a single property
//
// Calls 8 endpoints in serial (throttled to PropertyData's 4-calls/10s
// limit). Designed to be invoked at scout time per UNIQUE POSTCODE, and
// the result attached to every lead in that postcode. Aggressive caching
// in fetchPropertyData means repeated calls on the same postcode are free.
// ---------------------------------------------------------------------------

export type PropertySnapshot = {
  /** AVM result */
  avm: {
    estimatePence: number | null;
    lowPence: number | null;
    highPence: number | null;
    confidence: string | null;
  } | null;
  /** Sold-price comparables for the postcode */
  sold: SoldPrices | null;
  /** Yields */
  yields: YieldsReading | null;
  /** Asking price per sqft benchmark */
  pricesPerSqf: PricesPerSqf | null;
  /**
   * Always null: /demand returns no numeric score (verified Sep 2026). Kept so
   * persisted snapshots and their readers keep their shape; use `demandRating`.
   */
  demandScore: number | null;
  /** PropertyData's text demand rating, e.g. "Balanced market". */
  demandRating: string | null;
  /** Days-on-market average */
  daysOnMarketAvg: number | null;
  /** Price growth series + derived annual / 5-year change */
  growth: GrowthReading | null;
  /** Council tax band info */
  councilTax: CouncilTaxReading | null;
  /** Flood-risk band for the postcode, e.g. "Very Low" */
  flood: { floodRisk: string } | null;
  /** EPC matched to the address (if address provided) — same wrapper we use in preflight */
  epc: { rating: string | null; matchedAddress: string | null } | null;
  /** Tenure matched to address */
  tenure: {
    tenure: 'freehold' | 'leasehold' | 'unknown';
    remainingLeaseYears: number | null;
    matchedAddress: string | null;
  } | null;
  /** Top local agents */
  agents: Array<{
    name: string;
    phone: string | null;
    listings: number | null;
    url: string | null;
  }>;
  /**
   * Failure per source key — informational, NOT thrown. Now actually populated:
   * the helpers throw `PropertyDataUnavailableError` on a failed lookup instead
   * of returning null/[], so `safe()` catches it. Previously a snapshot where
   * every endpoint 429'd was persisted with `errors: {}` and every field null,
   * then treated as fresh-and-valid for 7 days.
   */
  errors: Record<string, string>;
  /** True when at least one source failed — the snapshot is incomplete. */
  degraded: boolean;
  fetchedAt: string;
};

export async function getPropertySnapshot(input: {
  postcode: string;
  address?: string;
  propertyType?:
    | 'detached'
    | 'semi-detached'
    | 'terraced'
    | 'flat'
    | 'bungalow';
  bedrooms?: number;
  /**
   * Internal floor area in SQUARE METRES — the unit every floor area in this
   * monorepo carries. Was declared `internalAreaSqft` while the other caller
   * (base-valuation) passed m² into the same /valuation-sale `internal_area`
   * field. See the unit caveat on getPropertyDataValuation.
   */
  internalAreaSqm?: number;
}): Promise<PropertySnapshot> {
  const errors: Record<string, string> = {};
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // Pacing is now enforced globally by the rate limiter inside fetchPropertyData
  // (4 calls / 10s). The old fixed 2.7s inter-call sleep here was additive on top
  // of that — 10× ≈ 27s of dead wall-clock per snapshot — and was the main reason
  // lead-appraise (8 leads × snapshot) blew the 300s function limit. Zeroed so the
  // limiter alone spaces the calls (bursting up to 4 immediately). See
  // docs/LEARNINGS.md.
  const DELAY = 0;

  // Helper to wrap each call so we never throw — collect into errors[].
  const safe = async <T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      errors[key] = (err as Error)?.message?.slice(0, 150) ?? 'failed';
      console.warn(
        `[propertydata] snapshot ${input.postcode} — ${key} unavailable: ${errors[key]}`
      );
      return null;
    }
  };

  // ── Phase A — calls that need property-level params (AVM) ─────────────
  // /valuation-sale accepts detached|semi-detached|terraced|flat. Map
  // bungalow → detached as the closest valuation proxy.
  const avmType: 'detached' | 'semi-detached' | 'terraced' | 'flat' | null =
    input.propertyType === 'bungalow'
      ? 'detached'
      : (input.propertyType ?? null);
  const avmInput = avmType
    ? {
        postcode: input.postcode,
        propertyType: avmType,
        bedrooms: input.bedrooms,
        internalAreaSqm: input.internalAreaSqm,
      }
    : null;
  const avmRaw = avmInput
    ? await safe('avm', () => getPropertyDataValuation(avmInput))
    : null;
  const avm = avmRaw
    ? {
        estimatePence: Math.round(avmRaw.estimate * 100),
        lowPence: Math.round(avmRaw.low * 100),
        highPence: Math.round(avmRaw.high * 100),
        confidence: avmRaw.confidence,
      }
    : null;
  await sleep(DELAY);

  // ── Phase B — postcode-level lookups (sequential, throttled) ─────────
  const sold = await safe('sold', () => getSoldPrices(input.postcode));
  await sleep(DELAY);
  const yieldsRes = await safe('yields', () => getYields(input.postcode));
  await sleep(DELAY);
  const pricesPerSqf = await safe('pricesPerSqf', () =>
    getPricesPerSqf(input.postcode)
  );
  await sleep(DELAY);
  const demand = await safe('demand', () => getMarketDemand(input.postcode));
  // /demand carries no 0-100 score (verified against a real response, Sep
  // 2026) — only a text rating and days on market. `demandScore` stays on the
  // snapshot for old readers and is always null now; the rating is the signal.
  const demandScore: number | null = null;
  const demandRating = demand?.demandRating ?? null;
  const daysOnMarketAvg = demand?.daysOnMarket ?? null;
  await sleep(DELAY);
  const growthRes = await safe('growth', () => getGrowth(input.postcode));
  await sleep(DELAY);
  const councilTax = await safe('councilTax', () =>
    getCouncilTax(input.postcode)
  );
  await sleep(DELAY);
  const floodReading = await safe('flood', () => getFloodRisk(input.postcode));
  const flood = floodReading ? { floodRisk: floodReading.floodRisk } : null;
  await sleep(DELAY);
  // EPC + tenure already pulled in preflight per postcode. Re-pull cheaply
  // (cached at 90d/30d respectively).
  const epcRows = await safe('epc', () => getEpcByPostcode(input.postcode));
  let epc: PropertySnapshot['epc'] = null;
  if (epcRows && epcRows.length > 0) {
    const targetAddr = input.address?.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = targetAddr
      ? epcRows.find((r) => {
          const a = r.address.toLowerCase().replace(/[^a-z0-9]/g, '');
          return a.startsWith(targetAddr) || targetAddr.startsWith(a);
        })
      : null;
    const pick = match ?? epcRows[0];
    if (pick) {
      epc = {
        rating: pick.rating,
        matchedAddress: pick.address,
      };
    }
  }
  await sleep(DELAY);
  const tenureRows = await safe('tenure', () =>
    getTenureByPostcode(input.postcode)
  );
  let tenure: PropertySnapshot['tenure'] = null;
  if (tenureRows && tenureRows.length > 0) {
    const targetAddr = input.address?.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = targetAddr
      ? tenureRows.find((r) => {
          const a = r.address.toLowerCase().replace(/[^a-z0-9]/g, '');
          return a.startsWith(targetAddr) || targetAddr.startsWith(a);
        })
      : null;
    const pick = match ?? tenureRows[0];
    if (pick) {
      tenure = {
        tenure: pick.tenure,
        remainingLeaseYears: pick.remainingLeaseYears,
        matchedAddress: pick.address,
      };
    }
  }
  await sleep(DELAY);
  const agentRows = await safe('agents', () =>
    getAgentsByPostcode(input.postcode)
  );
  // Top sale agents by listing volume. /agents carries no phone or website
  // (verified Sep 2026) — those fields stay on the snapshot for old readers.
  const agents: PropertySnapshot['agents'] = topSaleAgents(
    agentRows ?? [],
    5
  ).map((a) => ({
    name: a.name,
    phone: null,
    listings: a.unitsOffered,
    url: null,
  }));

  return {
    avm,
    sold,
    yields: yieldsRes ?? null,
    pricesPerSqf,
    demandScore,
    demandRating,
    daysOnMarketAvg,
    growth: growthRes ?? null,
    councilTax,
    flood,
    epc,
    tenure,
    agents,
    errors,
    degraded: Object.keys(errors).length > 0,
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Endpoint: /george — PropertyData's AI research assistant (POST)
// ---------------------------------------------------------------------------

export type GeorgeMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Pull a string answer out of whatever shape PropertyData /george returns.
 * Their docs don't pin it down so we try the most likely paths in order.
 * Falls back to JSON-stringifying the whole response if nothing matches —
 * the user gets *something* useful while we discover the real shape.
 */
function extractGeorgeAnswer(json: unknown): {
  answer: string | null;
  conversationId?: string;
} {
  if (!json || typeof json !== 'object') {
    return { answer: typeof json === 'string' ? json : null };
  }
  const j = json as Record<string, unknown>;
  // Try the most likely paths.
  const candidates: Array<unknown> = [
    j.answer,
    j.response,
    j.message,
    j.text,
    j.content,
    (j.result as Record<string, unknown> | undefined)?.answer,
    (j.result as Record<string, unknown> | undefined)?.response,
    (j.result as Record<string, unknown> | undefined)?.text,
    (j.data as Record<string, unknown> | undefined)?.answer,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      const conversationId =
        (j.conversation_id as string | undefined) ??
        ((j.result as Record<string, unknown> | undefined)?.conversation_id as
          | string
          | undefined);
      return { answer: c, conversationId };
    }
  }
  // Last resort — return the whole thing so we can see what came back.
  return {
    answer: `(unexpected response shape — raw payload below)\n\n\`\`\`json\n${JSON.stringify(json, null, 2).slice(0, 1500)}\n\`\`\``,
  };
}

/**
 * Ask George — PropertyData's hosted AI. Wraps the /george POST endpoint.
 * Used by the Bellwoods Concierge in the co-founder dashboard. Conversation
 * is preserved by the caller (we pass history with each call).
 *
 * NOT cached — every question is unique and questions can be follow-ups
 * that need fresh state.
 *
 * Permissive parsing — PropertyData's response shape isn't documented, so
 * we try multiple field paths and fall back to surfacing the raw response
 * if we can't find a clean answer string.
 */
export async function askGeorge(input: {
  question: string;
  conversation?: GeorgeMessage[];
  context?: string;
}) {
  const apiKey = env.PROPERTYDATA_API_KEY;
  if (!apiKey) {
    return { answer: null, error: 'no_api_key' as const };
  }

  const url = `${API_BASE}/george`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    // /george is a raw POST outside fetchPropertyData — gate it on the limiter.
    await acquireRateSlot();
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        question: input.question,
        conversation: input.conversation ?? [],
        context: input.context ?? undefined,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      console.warn(
        `[propertydata] /george ${res.status}: ${text.slice(0, 500)}`
      );
      // Surface the upstream error message to the caller so the UI can show
      // something useful rather than a generic "try again later".
      return {
        answer: null,
        error: 'request_failed' as const,
        upstreamStatus: res.status,
        upstreamMessage: text.slice(0, 500),
      };
    }
    const json = await res.json().catch(() => null);
    if (!json) {
      console.warn('[propertydata] /george returned non-JSON body');
      return { answer: null, error: 'invalid_response' as const };
    }
    creditsThisProcess += 5; // /george is roughly 5 credits per call
    console.info(
      `[propertydata] /george +5 credits (process total: ${creditsThisProcess})`
    );
    const { answer, conversationId } = extractGeorgeAnswer(json);
    if (!answer) {
      // Something came back but we couldn't extract a meaningful answer.
      // Log the keys at the top level so we can debug without printing
      // potentially sensitive content.
      console.warn(
        '[propertydata] /george response had no extractable answer. Top-level keys:',
        Object.keys(json as Record<string, unknown>)
      );
      return { answer: null, error: 'no_answer_extracted' as const };
    }
    return { answer, conversationId, error: null as null };
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      console.warn('[propertydata] /george timed out after 30s');
      return { answer: null, error: 'timeout' as const };
    }
    console.warn('[propertydata] /george failed', error);
    return { answer: null, error: 'unexpected' as const };
  } finally {
    clearTimeout(timer);
  }
}

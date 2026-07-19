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
import { acquireRateSlot } from './rate-limiter';
import { type PropertyDataType, toPropertyDataType } from './property-type';

export { toPropertyDataType };
export type { PropertyDataType };

import { z } from 'zod';
import { keys } from '../keys';

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
    `[propertydata] ${endpoint} +${credits} credits (process total: ${creditsThisProcess})`,
  );
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

class PropertyDataError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly status: number,
    message: string,
  ) {
    super(`[propertydata ${endpoint}] ${status}: ${message}`);
  }
}

async function fetchPropertyData<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  options: { ttlMs: number; estimatedCredits: number; schema: z.ZodType<T> },
): Promise<T | null> {
  const apiKey = env.PROPERTYDATA_API_KEY;
  if (!apiKey) {
    console.warn(
      `[propertydata] ${endpoint} skipped — no PROPERTYDATA_API_KEY configured`,
    );
    return null;
  }

  // Build the URL. PropertyData accepts the key as a query param (`key=`).
  // We never log the URL because the key is in it.
  const url = new URL(`${API_BASE}${endpoint}`);
  url.searchParams.set('key', apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }

  // Cache key excludes the API key (don't bake it into stored cache keys).
  const cacheKey = `${endpoint}:${JSON.stringify(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ),
  )}`;
  const cached = cacheGet<T>(cacheKey);
  if (cached !== null) {
    logCreditUsage(endpoint, 0, true);
    return cached;
  }

  // Respect PropertyData's 4-calls/10s limit before every live fetch.
  await acquireRateSlot();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new PropertyDataError(
        endpoint,
        res.status,
        await res.text().catch(() => res.statusText),
      );
    }
    const json = await res.json();
    const parsed = options.schema.safeParse(json);
    if (!parsed.success) {
      console.warn(
        `[propertydata] ${endpoint} response failed schema validation`,
        parsed.error.flatten(),
      );
      return null;
    }
    cacheSet(cacheKey, parsed.data, options.ttlMs);
    logCreditUsage(endpoint, options.estimatedCredits, false);
    return parsed.data;
  } catch (error) {
    if (error instanceof PropertyDataError) {
      console.warn(error.message);
    } else if ((error as { name?: string })?.name === 'AbortError') {
      console.warn(`[propertydata] ${endpoint} timed out after ${REQUEST_TIMEOUT_MS}ms`);
    } else {
      console.warn(`[propertydata] ${endpoint} failed`, error);
    }
    return null;
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
 */
export async function getPropertyDataValuation(input: {
  postcode: string;
  propertyType: 'detached' | 'semi-detached' | 'terraced' | 'flat';
  bedrooms?: number;
  internalArea?: number;
}): Promise<ValuationSaleResult> {
  const data = await fetchPropertyData('/valuation-sale', {
    postcode: input.postcode.replace(/\s/g, ''),
    property_type: toPropertyDataType(input.propertyType),
    bedrooms: input.bedrooms,
    internal_area: input.internalArea,
  }, {
    ttlMs: 7 * 24 * 60 * 60 * 1000,
    estimatedCredits: 3,
    schema: ValuationSaleSchema,
  });
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

const FloorAreasSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      properties: z
        .array(
          z.object({
            address: z.string().optional(),
            total_floor_area: z.number().optional(),
            bedrooms: z.number().optional(),
            property_type: z.string().optional(),
          }),
        )
        .optional(),
      average_floor_area: z.number().optional(),
    })
    .partial()
    .optional(),
});

/**
 * EPC-derived floor area + bedrooms by postcode. ~2 credits per call.
 * Critical for the agent quick-form path where we don't ask for sqft.
 * 90-day cache.
 */
export async function getFloorAreas(postcode: string) {
  return fetchPropertyData('/floor-areas', {
    postcode: postcode.replace(/\s/g, ''),
  }, {
    ttlMs: 90 * 24 * 60 * 60 * 1000,
    estimatedCredits: 2,
    schema: FloorAreasSchema,
  });
}

// ---------------------------------------------------------------------------
// Resolve ONE property's real floor area (EPC-derived) from /floor-areas
// ---------------------------------------------------------------------------

export interface PropertyFloorArea {
  /** Real EPC-derived internal floor area, m². Never a guess/average. */
  floorAreaSqm: number;
  /** The matched EPC address (includes the house number). */
  matchedAddress: string;
  /** How the row was matched — surfaced in the UI for transparency. */
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
 * (EPC register) for the postcode. Matching, in priority order:
 *
 *   1. Exact house-number match against the supplied address.
 *   2. If the address has no number, a UNIQUE match on property type +
 *      bedrooms (only when exactly one such row exists — still a real record,
 *      not an average).
 *
 * Returns null when no unambiguous real row matches. We deliberately never
 * fall back to `average_floor_area` — a postcode average is a guess, and the
 * house-of-record could be half or double it (the M14 doubling bug).
 */
export async function getPropertyFloorArea(input: {
  postcode: string;
  address?: string;
  propertyType?: string;
  bedrooms?: number;
}): Promise<PropertyFloorArea | null> {
  const data = await getFloorAreas(input.postcode);
  const properties = (data?.result?.properties ?? []).filter(
    (p): p is { address?: string; total_floor_area: number; bedrooms?: number; property_type?: string } =>
      typeof p.total_floor_area === 'number' && p.total_floor_area > 0,
  );
  if (properties.length === 0) return null;

  // 1. House-number match (the precise path).
  const wanted = input.address ? houseIdentifier(input.address) : null;
  if (wanted) {
    const hit = properties.find(
      (p) => p.address && houseIdentifier(p.address) === wanted,
    );
    if (hit) {
      return {
        floorAreaSqm: Math.round(hit.total_floor_area),
        matchedAddress: hit.address ?? input.address ?? '',
        matchSource: 'house_number',
      };
    }
    // Had a number but it isn't in the register → don't guess.
    return null;
  }

  // 2. Street-only address: only accept a UNIQUE type+bedroom match.
  const wantType = input.propertyType?.toLowerCase();
  const wantBeds = input.bedrooms;
  if (wantType && typeof wantBeds === 'number') {
    const matches = properties.filter((p) => {
      const t = p.property_type?.toLowerCase();
      return (
        t !== undefined &&
        t.includes(wantType.split('-')[0] ?? wantType) &&
        p.bedrooms === wantBeds
      );
    });
    if (matches.length === 1 && matches[0]) {
      return {
        floorAreaSqm: Math.round(matches[0].total_floor_area),
        matchedAddress: matches[0].address ?? '',
        matchSource: 'unique_type_match',
      };
    }
  }

  // Ambiguous or unmatched → no size (real data or nothing).
  return null;
}

// ---------------------------------------------------------------------------
// Endpoint: /flood-risk
// ---------------------------------------------------------------------------

const FloodRiskSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      rivers_and_sea: z.string().optional(),
      surface_water: z.string().optional(),
    })
    .partial()
    .optional(),
});

/**
 * Flood risk by postcode (England only). ~2 credits.
 * 90-day cache — postcode-level risk barely changes.
 */
export async function getFloodRisk(postcode: string) {
  return fetchPropertyData('/flood-risk', {
    postcode: postcode.replace(/\s/g, ''),
  }, {
    ttlMs: 90 * 24 * 60 * 60 * 1000,
    estimatedCredits: 2,
    schema: FloodRiskSchema,
  });
}

// ---------------------------------------------------------------------------
// Endpoint: /demand
// ---------------------------------------------------------------------------

const DemandSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      sales_demand_score: z.number().optional(),
      days_on_market_average: z.number().optional(),
    })
    .partial()
    .optional(),
});

/**
 * How fast does this postcode sell? Drives our either-outcome
 * conversation: in low-demand postcodes our offer is more compelling.
 * ~2 credits, 7-day cache.
 */
export async function getMarketDemand(postcode: string) {
  return fetchPropertyData('/demand', {
    postcode: postcode.replace(/\s/g, ''),
  }, {
    ttlMs: 7 * 24 * 60 * 60 * 1000,
    estimatedCredits: 2,
    schema: DemandSchema,
  });
}

// ---------------------------------------------------------------------------
// Endpoint: /agents (PROSPECTING)
// ---------------------------------------------------------------------------

const AgentsSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      agents: z
        .array(
          z.object({
            name: z.string().optional(),
            phone: z.string().optional(),
            address: z.string().optional(),
            number_of_listings: z.number().optional(),
            url: z.string().optional(),
          }),
        )
        .optional(),
    })
    .partial()
    .optional(),
});

/**
 * Live agent rankings by postcode, ranked by listing volume.
 * This is the killer prospecting endpoint — feeds the weekly outreach
 * cron. ~3 credits, 7-day cache.
 */
export async function getAgentsByPostcode(postcode: string) {
  return fetchPropertyData('/agents', {
    postcode: postcode.replace(/\s/g, ''),
  }, {
    ttlMs: 7 * 24 * 60 * 60 * 1000,
    estimatedCredits: 3,
    schema: AgentsSchema,
  });
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
        .partial(),
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
 * Default — the six strongest distress signals. PropertyData accepts
 * comma-separated list values, returning properties matching ANY.
 */
const DEFAULT_LIST = SOURCED_LIST_TYPES.slice(0, 6).join(',');

/**
 * Per-list-type probe — call /sourced-properties once per list type,
 * record what works, return a breakdown. Resilient to any single type
 * being invalid for the account. ~3 credits per list type per call,
 * but cached.
 */
export type ListTypeBreakdown = Record<
  SourcedListType,
  { count: number; error: string | null }
>;

export async function probeSourcedByType(
  postcode: string,
  opts?: { radiusMiles?: number; types?: readonly SourcedListType[] },
): Promise<ListTypeBreakdown> {
  const types = opts?.types ?? SOURCED_LIST_TYPES;
  const out: Partial<ListTypeBreakdown> = {};

  await Promise.all(
    types.map(async (t) => {
      // Use the raw endpoint so we see PropertyData's actual response —
      // getSourcedProperties() swallows errors and returns [], which
      // makes a 422 indistinguishable from "no listings".
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

      const body = raw.body as { result?: { properties?: unknown[] } } | null;
      const properties = body?.result?.properties;
      out[t] = {
        count: Array.isArray(properties) ? properties.length : 0,
        error: null,
      };
    }),
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
  },
): Promise<{
  ok: boolean;
  status?: number;
  body?: unknown;
  error?: string;
}> {
  const apiKey = env.PROPERTYDATA_API_KEY;
  if (!apiKey) return { ok: false, error: 'PROPERTYDATA_API_KEY not configured' };
  const url = new URL(`${API_BASE}/sourced-properties`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('postcode', postcode.replace(/\s/g, ''));
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
  try {
    // This raw helper bypasses fetchPropertyData, so gate it on the same limiter.
    await acquireRateSlot();
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
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
  },
): Promise<SourcedProperty[]> {
  const params: Record<string, string | number> = {
    postcode: postcode.replace(/\s/g, ''),
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
  const data = await fetchPropertyData(
    '/sourced-properties',
    params,
    {
      ttlMs: 24 * 60 * 60 * 1000,
      estimatedCredits: 1,
      schema: SourcedPropertiesSchema,
    },
  );
  // PropertyData puts properties[] at the ROOT of the body, not under `result`.
  // The `list` field at root is an object {id, name}; use id as the listing type.
  const body = data as
    | {
        properties?: unknown[];
        list?: { id?: string; name?: string };
      }
    | null;
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
        ((maxHistPrice - currentPrice) / maxHistPrice) * 100,
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
  opts?: { radiusMiles?: number; lists?: readonly string[] },
): Promise<SourcedProperty[]> {
  const lists = opts?.lists ?? SOURCED_LIST_TYPES.slice(0, 6);
  const seen = new Map<string, SourcedProperty>();

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
        if (!seen.has(key)) {
          seen.set(key, p);
        } else {
          // Stronger signal wins (earlier in SOURCED_LIST_TYPES = higher signal)
          const existing = seen.get(key)!;
          const existingRank = SOURCED_LIST_TYPES.indexOf(
            existing.listingType as (typeof SOURCED_LIST_TYPES)[number],
          );
          const newRank = SOURCED_LIST_TYPES.indexOf(
            p.listingType as (typeof SOURCED_LIST_TYPES)[number],
          );
          if (newRank >= 0 && (existingRank < 0 || newRank < existingRank)) {
            seen.set(key, p);
          }
        }
      }
    } catch (err) {
      console.warn(`[propertydata multi] ${list} failed`, err);
    }
    // Throttle except after the last
    if (i < lists.length - 1) {
      await new Promise((r) => setTimeout(r, 2700));
    }
  }

  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// Endpoint: /energy-efficiency (EPC ratings) — RICE B
// ---------------------------------------------------------------------------

const EpcSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      properties: z
        .array(
          z
            .object({
              address: z.string().optional(),
              current_energy_rating: z.string().optional(),
              current_energy_efficiency: z.number().optional(),
              potential_energy_rating: z.string().optional(),
              property_type: z.string().optional(),
              total_floor_area: z.number().optional(),
              inspection_date: z.string().optional(),
            })
            .partial(),
        )
        .optional(),
      average_rating: z.string().optional(),
    })
    .partial()
    .optional(),
});

export type EpcReading = {
  address: string;
  rating: string | null; // A-G
  efficiency: number | null; // 0-100
  potentialRating: string | null;
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
export async function getEpcByPostcode(postcode: string): Promise<EpcReading[]> {
  const data = await fetchPropertyData(
    '/energy-efficiency',
    { postcode: postcode.replace(/\s/g, '') },
    {
      ttlMs: 90 * 24 * 60 * 60 * 1000,
      estimatedCredits: 2,
      schema: EpcSchema,
    },
  );
  const rows = (data as { result?: { properties?: unknown[] } } | null)?.result
    ?.properties;
  if (!Array.isArray(rows)) return [];
  const out: EpcReading[] = [];
  for (const raw of rows) {
    const p = raw as Record<string, unknown>;
    const address = typeof p.address === 'string' ? p.address : null;
    if (!address) continue;
    out.push({
      address,
      rating:
        typeof p.current_energy_rating === 'string'
          ? p.current_energy_rating.toUpperCase()
          : null,
      efficiency:
        typeof p.current_energy_efficiency === 'number'
          ? p.current_energy_efficiency
          : null,
      potentialRating:
        typeof p.potential_energy_rating === 'string'
          ? p.potential_energy_rating.toUpperCase()
          : null,
      propertyType:
        typeof p.property_type === 'string' ? p.property_type : null,
      inspectionDate:
        typeof p.inspection_date === 'string' ? p.inspection_date : null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Endpoint: /freeholds (tenure detection) — RICE B
// ---------------------------------------------------------------------------

const FreeholdsSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      properties: z
        .array(
          z
            .object({
              address: z.string().optional(),
              tenure: z.string().optional(),
              lease_remaining_years: z.number().optional(),
              ground_rent: z.number().optional(),
              service_charge: z.number().optional(),
            })
            .partial(),
        )
        .optional(),
    })
    .partial()
    .optional(),
});

export type TenureReading = {
  address: string;
  tenure: 'freehold' | 'leasehold' | 'unknown';
  remainingLeaseYears: number | null;
  groundRentPerYear: number | null;
  serviceChargePerYear: number | null;
};

/**
 * Tenure data per address in a postcode. Identifies leaseholds and surfaces
 * remaining lease years — critical for offer accuracy and avoiding nasty
 * post-survey surprises. ~3 credits, 30-day cache.
 */
export async function getTenureByPostcode(
  postcode: string,
): Promise<TenureReading[]> {
  const data = await fetchPropertyData(
    '/freeholds',
    { postcode: postcode.replace(/\s/g, '') },
    {
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      estimatedCredits: 3,
      schema: FreeholdsSchema,
    },
  );
  const rows = (data as { result?: { properties?: unknown[] } } | null)?.result
    ?.properties;
  if (!Array.isArray(rows)) return [];
  const out: TenureReading[] = [];
  for (const raw of rows) {
    const p = raw as Record<string, unknown>;
    const address = typeof p.address === 'string' ? p.address : null;
    if (!address) continue;
    const rawTenure =
      typeof p.tenure === 'string' ? p.tenure.toLowerCase() : 'unknown';
    const tenure: TenureReading['tenure'] =
      rawTenure.includes('lease') ? 'leasehold'
      : rawTenure.includes('free') ? 'freehold'
      : 'unknown';
    out.push({
      address,
      tenure,
      remainingLeaseYears:
        typeof p.lease_remaining_years === 'number'
          ? p.lease_remaining_years
          : null,
      groundRentPerYear:
        typeof p.ground_rent === 'number' ? p.ground_rent : null,
      serviceChargePerYear:
        typeof p.service_charge === 'number' ? p.service_charge : null,
    });
  }
  return out;
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
            .partial(),
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
  opts?: { radiusMiles?: number; minDaysOnMarket?: number },
): Promise<ActiveListing[]> {
  const params: Record<string, string | number> = {
    postcode: postcode.replace(/\s/g, ''),
  };
  if (typeof opts?.radiusMiles === 'number') params.radius = opts.radiusMiles;

  const data = await fetchPropertyData(
    '/listings',
    params,
    {
      ttlMs: 24 * 60 * 60 * 1000,
      estimatedCredits: 3,
      schema: ListingsSchema,
    },
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

const GrowthSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      annual_growth: z.number().optional(),
      five_year_growth: z.number().optional(),
      ten_year_growth: z.number().optional(),
      forecast_growth: z.number().optional(),
      forecast_period_months: z.number().optional(),
    })
    .partial()
    .optional(),
});

export type GrowthReading = {
  annualGrowthPct: number | null;
  fiveYearGrowthPct: number | null;
  forecastGrowthPct: number | null;
  forecastPeriodMonths: number | null;
};

/**
 * Local price growth + forward forecast. Used by Appraiser to adjust
 * offer % of AVM based on market trajectory. ~2 credits, 30-day cache.
 */
export async function getGrowth(postcode: string): Promise<GrowthReading | null> {
  const data = await fetchPropertyData(
    '/growth',
    { postcode: postcode.replace(/\s/g, '') },
    {
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      estimatedCredits: 2,
      schema: GrowthSchema,
    },
  );
  const r = (data as { result?: Record<string, unknown> } | null)?.result;
  if (!r) return null;
  return {
    annualGrowthPct: typeof r.annual_growth === 'number' ? r.annual_growth : null,
    fiveYearGrowthPct: typeof r.five_year_growth === 'number' ? r.five_year_growth : null,
    forecastGrowthPct: typeof r.forecast_growth === 'number' ? r.forecast_growth : null,
    forecastPeriodMonths:
      typeof r.forecast_period_months === 'number' ? r.forecast_period_months : null,
  };
}

// ---------------------------------------------------------------------------
// Preflight checks — combine EPC + tenure + market temperature
// Used by the quote API path for every new submission. Cached endpoints so
// repeat hits on the same postcode are cheap. ~7 credits net per first-time
// postcode, 0 thereafter for the cache window.
// ---------------------------------------------------------------------------

export type PreflightChecks = {
  postcode: string;
  address?: string;
  epc: {
    rating: string | null;
    isLowEpc: boolean; // E/F/G — meaningful renovation discount
    matchedAddress: string | null;
  };
  tenure: {
    tenure: 'freehold' | 'leasehold' | 'unknown';
    remainingLeaseYears: number | null;
    isShortLease: boolean; // <80 years — surveyor-level concern
    matchedAddress: string | null;
  };
  marketTemperature: {
    demandScore: number | null; // 0-100 from /demand
    daysOnMarketAvg: number | null;
    annualGrowthPct: number | null;
    forecastGrowthPct: number | null;
    /** Single-number heat index combining demand + growth, range -1..+1 */
    temperatureIndex: number | null;
    /** 'hot' | 'warm' | 'neutral' | 'cool' | 'cold' */
    band: 'hot' | 'warm' | 'neutral' | 'cool' | 'cold' | null;
  };
  /** Lines suitable to append to a reasoning array */
  reasoning: string[];
  /** Suggested offer multiplier adjustment (-0.05 to +0.03) on AVM% */
  offerAdjustment: number;
};

function fuzzyMatchAddress<T extends { address: string }>(
  rows: T[],
  needle?: string,
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
  index: number | null,
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
  const [epcs, tenures, demand, growth] = await Promise.all([
    getEpcByPostcode(postcode).catch(() => [] as EpcReading[]),
    getTenureByPostcode(postcode).catch(() => [] as TenureReading[]),
    getMarketDemand(postcode).catch(() => null),
    getGrowth(postcode).catch(() => null),
  ]);

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

  const demandResult = (demand as { result?: Record<string, unknown> } | null)
    ?.result;
  const demandScore =
    typeof demandResult?.sales_demand_score === 'number'
      ? demandResult.sales_demand_score
      : null;
  const daysOnMarketAvg =
    typeof demandResult?.days_on_market_average === 'number'
      ? demandResult.days_on_market_average
      : null;

  const annualGrowthPct = growth?.annualGrowthPct ?? null;
  const forecastGrowthPct = growth?.forecastGrowthPct ?? null;

  // Combined temperature index. Weights chosen so that:
  //   strong demand (score 80+) + positive forecast → +0.5+ (hot)
  //   neutral both → 0
  //   weak demand + falling forecast → -0.5+ (cold)
  let temperatureIndex: number | null = null;
  const components: number[] = [];
  if (typeof demandScore === 'number') {
    // demandScore is 0-100; normalise to -1..+1 around midpoint 50
    components.push((demandScore - 50) / 50);
  }
  if (typeof forecastGrowthPct === 'number') {
    // forecastGrowthPct typical range -10..+10 — normalise
    components.push(Math.max(-1, Math.min(1, forecastGrowthPct / 10)));
  } else if (typeof annualGrowthPct === 'number') {
    components.push(Math.max(-1, Math.min(1, annualGrowthPct / 10)));
  }
  if (components.length > 0) {
    temperatureIndex =
      Math.round(
        (components.reduce((s, x) => s + x, 0) / components.length) * 100,
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
    band === 'hot' ? 0.02
    : band === 'warm' ? 0.01
    : band === 'cool' ? -0.02
    : band === 'cold' ? -0.04
    : 0;

  // Low EPC: -0.01 (Appraiser already discounts in AVM but we surface it
  // again at the offer% layer for transparency).
  const epcAdj = isLowEpc ? -0.01 : 0;

  // Short lease: surface only — actual discount handled by lease curve in
  // the offer-calc layer. We don't double-count.
  const offerAdjustment = Math.round((tempAdj + epcAdj) * 1000) / 1000;

  const reasoning: string[] = [];
  if (matchedEpc) {
    reasoning.push(
      `EPC ${epcRating ?? '?'} from register (${matchedEpc.address})${isLowEpc ? ' — meaningful renovation cost expected' : ''}`,
    );
  } else {
    reasoning.push('EPC: no certificate matched on this address');
  }
  if (matchedTenure) {
    if (tenure === 'leasehold') {
      reasoning.push(
        `Tenure: leasehold${remainingLeaseYears ? `, ${remainingLeaseYears} years remaining` : ''}${isShortLease ? ' — SHORT LEASE FLAG' : ''}`,
      );
    } else if (tenure === 'freehold') {
      reasoning.push('Tenure: freehold');
    }
  }
  if (band) {
    reasoning.push(
      `Market: ${band}${typeof demandScore === 'number' ? ` (demand ${demandScore}/100)` : ''}${typeof forecastGrowthPct === 'number' ? `, forecast ${forecastGrowthPct > 0 ? '+' : ''}${forecastGrowthPct.toFixed(1)}%` : ''} — offer adjusted ${tempAdj > 0 ? '+' : ''}${(tempAdj * 100).toFixed(1)}%`,
    );
  }

  return {
    postcode,
    address,
    epc: {
      rating: epcRating,
      isLowEpc,
      matchedAddress: matchedEpc?.address ?? null,
    },
    tenure: {
      tenure,
      remainingLeaseYears,
      isShortLease,
      matchedAddress: matchedTenure?.address ?? null,
    },
    marketTemperature: {
      demandScore,
      daysOnMarketAvg,
      annualGrowthPct,
      forecastGrowthPct,
      temperatureIndex,
      band,
    },
    reasoning,
    offerAdjustment,
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
  return fetchPropertyData('/account/credits', {}, {
    ttlMs: 60 * 1000, // 1 minute
    estimatedCredits: 0,
    schema: CreditsSchema,
  });
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
                .object({ text: z.string().optional(), rating: z.string().optional() })
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
            .partial(),
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
  opts?: { radiusMiles?: number },
): Promise<PlanningApplication[]> {
  const params: Record<string, string | number> = {
    postcode: postcode.replace(/\s/g, ''),
  };
  if (typeof opts?.radiusMiles === 'number') {
    params.radius = opts.radiusMiles;
  }
  const data = await fetchPropertyData(
    '/planning-applications',
    params,
    {
      ttlMs: 7 * 24 * 60 * 60 * 1000,
      estimatedCredits: 2,
      schema: PlanningApplicationsSchema,
    },
  );
  const apps =
    (data as { data?: { planning_applications?: unknown[] } } | null)?.data
      ?.planning_applications;
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
    const decisionRating = (typeof decision?.rating === 'string'
      ? decision.rating
      : null) as PlanningApplication['decisionRating'];

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
            .partial(),
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
  opts?: { radiusMiles?: number },
): Promise<HmoRecord[]> {
  const params: Record<string, string | number> = {
    postcode: postcode.replace(/\s/g, ''),
  };
  if (typeof opts?.radiusMiles === 'number') {
    params.radius = opts.radiusMiles;
  }
  const data = await fetchPropertyData(
    '/national-hmo-register',
    params,
    {
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      estimatedCredits: 2,
      schema: HmoRegisterSchema,
    },
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

    const distStr = typeof h.distance_miles === 'string' ? h.distance_miles : null;
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
  postcode: string,
): Promise<DemographicsReading | null> {
  const data = await fetchPropertyData(
    '/demographics',
    { postcode: postcode.replace(/\s/g, '') },
    {
      ttlMs: 90 * 24 * 60 * 60 * 1000,
      estimatedCredits: 2,
      schema: DemographicsSchema,
    },
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
  const percentOver65 =
    over65.length > 0 ? normalise(over65[0]!) : null;
  const percentOver75 =
    over75.length > 0 ? normalise(over75[0]!) : null;

  return { percentOver65, percentOver75, raw };
}

// ---------------------------------------------------------------------------
// Endpoint: /sold-prices — recent comparable sales
// ---------------------------------------------------------------------------

const SoldPricesSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      average_price: z.number().optional(),
      median_price: z.number().optional(),
      transactions: z
        .array(
          z
            .object({
              address: z.string().optional(),
              postcode: z.string().optional(),
              price: z.number().optional(),
              date: z.string().optional(),
              property_type: z.string().optional(),
              new_build: z.boolean().optional(),
              tenure: z.string().optional(),
            })
            .partial(),
        )
        .optional(),
    })
    .partial()
    .optional(),
});

export type SoldTransaction = {
  address: string;
  postcode: string | null;
  pricePence: number;
  date: string;
  propertyType: string | null;
  tenure: string | null;
};

export type SoldPrices = {
  averagePricePence: number | null;
  medianPricePence: number | null;
  transactions: SoldTransaction[];
};

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
  opts: SoldPricesOptions = {},
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

  const data = await fetchPropertyData(
    '/sold-prices',
    {
      postcode: postcode.replace(/\s/g, ''),
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
    },
  );
  const r = (data as { result?: Record<string, unknown> } | null)?.result;
  if (!r) return null;
  const transactions: SoldTransaction[] = [];
  for (const raw of (r.transactions as unknown[] | undefined) ?? []) {
    const t = raw as Record<string, unknown>;
    const address = typeof t.address === 'string' ? t.address : null;
    const price = typeof t.price === 'number' ? t.price : null;
    const date = typeof t.date === 'string' ? t.date : null;
    if (!address || !price || !date) continue;
    transactions.push({
      address,
      postcode: typeof t.postcode === 'string' ? t.postcode : null,
      pricePence: Math.round(price * 100),
      date,
      propertyType:
        typeof t.property_type === 'string' ? t.property_type : null,
      tenure: typeof t.tenure === 'string' ? t.tenure : null,
    });
  }
  return {
    averagePricePence:
      typeof r.average_price === 'number'
        ? Math.round(r.average_price * 100)
        : null,
    medianPricePence:
      typeof r.median_price === 'number'
        ? Math.round(r.median_price * 100)
        : null,
    transactions,
  };
}

// ---------------------------------------------------------------------------
// Endpoint: /yields — rental yield for area
// ---------------------------------------------------------------------------

const YieldsSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      yield_average: z.number().optional(),
      gross_yield: z.number().optional(),
      yield_low: z.number().optional(),
      yield_high: z.number().optional(),
    })
    .partial()
    .optional(),
});

export type YieldsReading = {
  averageYieldPct: number | null;
  lowYieldPct: number | null;
  highYieldPct: number | null;
};

export async function getYields(
  postcode: string,
): Promise<YieldsReading | null> {
  const data = await fetchPropertyData(
    '/yields',
    { postcode: postcode.replace(/\s/g, '') },
    {
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      estimatedCredits: 2,
      schema: YieldsSchema,
    },
  );
  const r = (data as { result?: Record<string, unknown> } | null)?.result;
  if (!r) return null;
  const avg =
    typeof r.yield_average === 'number'
      ? r.yield_average
      : typeof r.gross_yield === 'number'
        ? r.gross_yield
        : null;
  return {
    averageYieldPct: avg,
    lowYieldPct:
      typeof r.yield_low === 'number' ? r.yield_low : null,
    highYieldPct:
      typeof r.yield_high === 'number' ? r.yield_high : null,
  };
}

// ---------------------------------------------------------------------------
// Endpoint: /prices-per-sqf — local £/sqft benchmarks
// ---------------------------------------------------------------------------

const PricesPerSqfSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      average: z.number().optional(),
      median: z.number().optional(),
      low: z.number().optional(),
      high: z.number().optional(),
    })
    .partial()
    .optional(),
});

export type PricesPerSqf = {
  averagePerSqft: number | null;
  medianPerSqft: number | null;
};

export async function getPricesPerSqf(
  postcode: string,
): Promise<PricesPerSqf | null> {
  const data = await fetchPropertyData(
    '/prices-per-sqf',
    { postcode: postcode.replace(/\s/g, '') },
    {
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      estimatedCredits: 2,
      schema: PricesPerSqfSchema,
    },
  );
  const r = (data as { result?: Record<string, unknown> } | null)?.result;
  if (!r) return null;
  return {
    averagePerSqft:
      typeof r.average === 'number' ? r.average : null,
    medianPerSqft: typeof r.median === 'number' ? r.median : null,
  };
}

// ---------------------------------------------------------------------------
// Endpoint: /council-tax — average council tax bills
// ---------------------------------------------------------------------------

const CouncilTaxSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      band: z.string().optional(),
      bands: z.record(z.string(), z.unknown()).optional(),
      average_annual_bill: z.number().optional(),
    })
    .partial()
    .optional(),
});

export type CouncilTaxReading = {
  averageAnnualBill: number | null;
  band: string | null;
  /** Map of band letter → annual £ */
  bandsByLetter: Record<string, number>;
};

export async function getCouncilTax(
  postcode: string,
): Promise<CouncilTaxReading | null> {
  const data = await fetchPropertyData(
    '/council-tax',
    { postcode: postcode.replace(/\s/g, '') },
    {
      ttlMs: 90 * 24 * 60 * 60 * 1000,
      estimatedCredits: 2,
      schema: CouncilTaxSchema,
    },
  );
  const r = (data as { result?: Record<string, unknown> } | null)?.result;
  if (!r) return null;
  const bands: Record<string, number> = {};
  const bandsRaw = r.bands as Record<string, unknown> | undefined;
  if (bandsRaw) {
    for (const [letter, val] of Object.entries(bandsRaw)) {
      if (typeof val === 'number') bands[letter.toUpperCase()] = val;
      else if (val && typeof val === 'object') {
        const v = val as Record<string, unknown>;
        const amount =
          (typeof v.amount === 'number' && v.amount) ||
          (typeof v.annual === 'number' && v.annual) ||
          (typeof v.value === 'number' && v.value);
        if (typeof amount === 'number')
          bands[letter.toUpperCase()] = amount;
      }
    }
  }
  return {
    averageAnnualBill:
      typeof r.average_annual_bill === 'number'
        ? r.average_annual_bill
        : null,
    band: typeof r.band === 'string' ? r.band : null,
    bandsByLetter: bands,
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
  /** Sales demand 0-100 */
  demandScore: number | null;
  /** Days-on-market average */
  daysOnMarketAvg: number | null;
  /** 5yr forecast growth */
  growth: GrowthReading | null;
  /** Council tax band info */
  councilTax: CouncilTaxReading | null;
  /** Flood-risk band */
  flood: { riversAndSea: string | null; surfaceWater: string | null } | null;
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
  /** Errors per source — informational, NOT thrown */
  errors: Record<string, string>;
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
  internalAreaSqft?: number;
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
    fn: () => Promise<T>,
  ): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      errors[key] = (err as Error)?.message?.slice(0, 150) ?? 'failed';
      return null;
    }
  };

  // ── Phase A — calls that need property-level params (AVM) ─────────────
  // /valuation-sale accepts detached|semi-detached|terraced|flat. Map
  // bungalow → detached as the closest valuation proxy.
  const avmType: 'detached' | 'semi-detached' | 'terraced' | 'flat' | null =
    input.propertyType === 'bungalow'
      ? 'detached'
      : input.propertyType ?? null;
  const avmInput = avmType
    ? {
        postcode: input.postcode,
        propertyType: avmType,
        bedrooms: input.bedrooms,
        internalArea: input.internalAreaSqft,
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
    getPricesPerSqf(input.postcode),
  );
  await sleep(DELAY);
  const demandRaw = await safe('demand', () =>
    getMarketDemand(input.postcode),
  );
  const demandScore =
    typeof (demandRaw as { result?: { sales_demand_score?: number } } | null)
      ?.result?.sales_demand_score === 'number'
      ? (demandRaw as { result: { sales_demand_score: number } }).result
          .sales_demand_score
      : null;
  const daysOnMarketAvg =
    typeof (demandRaw as { result?: { days_on_market_average?: number } } | null)
      ?.result?.days_on_market_average === 'number'
      ? (demandRaw as { result: { days_on_market_average: number } }).result
          .days_on_market_average
      : null;
  await sleep(DELAY);
  const growthRes = await safe('growth', () => getGrowth(input.postcode));
  await sleep(DELAY);
  const councilTax = await safe('councilTax', () =>
    getCouncilTax(input.postcode),
  );
  await sleep(DELAY);
  const floodRaw = await safe('flood', () => getFloodRisk(input.postcode));
  const flood = floodRaw
    ? {
        riversAndSea:
          ((floodRaw as { result?: { rivers_and_sea?: string } } | null)
            ?.result?.rivers_and_sea as string | undefined) ?? null,
        surfaceWater:
          ((floodRaw as { result?: { surface_water?: string } } | null)
            ?.result?.surface_water as string | undefined) ?? null,
      }
    : null;
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
    getTenureByPostcode(input.postcode),
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
  const agentsRaw = await safe('agents', () =>
    getAgentsByPostcode(input.postcode),
  );
  const agents: PropertySnapshot['agents'] = [];
  const agentsList = (agentsRaw as { result?: { agents?: unknown[] } } | null)
    ?.result?.agents;
  if (Array.isArray(agentsList)) {
    for (const raw of agentsList.slice(0, 5)) {
      const a = raw as Record<string, unknown>;
      if (typeof a.name !== 'string') continue;
      agents.push({
        name: a.name,
        phone: typeof a.phone === 'string' ? a.phone : null,
        listings:
          typeof a.number_of_listings === 'number'
            ? a.number_of_listings
            : null,
        url: typeof a.url === 'string' ? a.url : null,
      });
    }
  }

  return {
    avm,
    sold,
    yields: yieldsRes ?? null,
    pricesPerSqf,
    demandScore,
    daysOnMarketAvg,
    growth: growthRes ?? null,
    councilTax,
    flood,
    epc,
    tenure,
    agents,
    errors,
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
function extractGeorgeAnswer(json: unknown): { answer: string | null; conversationId?: string } {
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
        ((j.result as Record<string, unknown> | undefined)?.conversation_id as string | undefined);
      return { answer: c, conversationId };
    }
  }
  // Last resort — return the whole thing so we can see what came back.
  return { answer: `(unexpected response shape — raw payload below)\n\n\`\`\`json\n${JSON.stringify(json, null, 2).slice(0, 1500)}\n\`\`\`` };
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
      console.warn(`[propertydata] /george ${res.status}: ${text.slice(0, 500)}`);
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
    console.info(`[propertydata] /george +5 credits (process total: ${creditsThisProcess})`);
    const { answer, conversationId } = extractGeorgeAnswer(json);
    if (!answer) {
      // Something came back but we couldn't extract a meaningful answer.
      // Log the keys at the top level so we can debug without printing
      // potentially sensitive content.
      console.warn(
        '[propertydata] /george response had no extractable answer. Top-level keys:',
        Object.keys(json as Record<string, unknown>),
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

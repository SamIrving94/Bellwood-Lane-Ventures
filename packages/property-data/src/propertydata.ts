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
    type: input.propertyType,
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

const SourcedPropertiesSchema = z.object({
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
              listing_type: z.string().optional(), // probate / repossession / bmv / etc
              listing_url: z.string().optional(),
              days_on_market: z.number().optional(),
              estimated_value: z.number().optional(),
              discount_percentage: z.number().optional(),
              source: z.string().optional(),
            })
            .partial(),
        )
        .optional(),
    })
    .partial()
    .optional(),
});

export type SourcedProperty = {
  address: string;
  postcode: string;
  pricePence: number | null;
  bedrooms: number | null;
  propertyType: string | null;
  listingType: string;
  listingUrl: string | null;
  daysOnMarket: number | null;
  estimatedValuePence: number | null;
  discountPercent: number | null;
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
  opts?: { radiusMiles?: number; list?: string },
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
  try {
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Distressed property listings — probate, repossession, below-market-value.
 * Postcode-scoped. ~3 credits per call. 1-day cache (listings churn fast).
 *
 * Used by the daily scouting cron as a real-time lead source alongside
 * The Gazette's probate notices.
 */
export async function getSourcedProperties(
  postcode: string,
  opts?: { radiusMiles?: number; list?: string },
): Promise<SourcedProperty[]> {
  const params: Record<string, string | number> = {
    postcode: postcode.replace(/\s/g, ''),
    list: opts?.list ?? DEFAULT_LIST,
  };
  if (typeof opts?.radiusMiles === 'number') {
    params.radius = opts.radiusMiles;
  }
  const data = await fetchPropertyData(
    '/sourced-properties',
    params,
    {
      ttlMs: 24 * 60 * 60 * 1000,
      estimatedCredits: 3,
      schema: SourcedPropertiesSchema,
    },
  );
  const properties = (data as { result?: { properties?: unknown[] } } | null)
    ?.result?.properties;
  if (!Array.isArray(properties)) return [];

  const normalised: SourcedProperty[] = [];
  for (const raw of properties) {
    const p = raw as Record<string, unknown>;
    const address = typeof p.address === 'string' ? p.address.trim() : null;
    const postcodeOut =
      typeof p.postcode === 'string' ? p.postcode.toUpperCase().trim() : null;
    if (!address || !postcodeOut) continue;
    normalised.push({
      address,
      postcode: postcodeOut,
      pricePence: typeof p.price === 'number' ? Math.round(p.price * 100) : null,
      bedrooms: typeof p.bedrooms === 'number' ? p.bedrooms : null,
      propertyType:
        typeof p.property_type === 'string' ? p.property_type : null,
      listingType:
        typeof p.listing_type === 'string' ? p.listing_type : 'distressed',
      listingUrl: typeof p.listing_url === 'string' ? p.listing_url : null,
      daysOnMarket:
        typeof p.days_on_market === 'number' ? p.days_on_market : null,
      estimatedValuePence:
        typeof p.estimated_value === 'number'
          ? Math.round(p.estimated_value * 100)
          : null,
      discountPercent:
        typeof p.discount_percentage === 'number'
          ? p.discount_percentage
          : null,
      source: typeof p.source === 'string' ? p.source : 'propertydata',
    });
  }
  return normalised;
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

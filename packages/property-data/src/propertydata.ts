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

const GeorgeSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      answer: z.string().optional(),
      conversation_id: z.string().optional(),
      sources: z.array(z.unknown()).optional(),
    })
    .partial()
    .optional(),
});

export type GeorgeMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Ask George — PropertyData's hosted AI. Wraps the /george POST endpoint.
 * Used by the Bellwoods Concierge in the co-founder dashboard. Conversation
 * is preserved by the caller (we pass history with each call).
 *
 * NOT cached — every question is unique and questions can be follow-ups
 * that need fresh state.
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
      console.warn(`[propertydata] /george ${res.status}: ${text}`);
      return { answer: null, error: 'request_failed' as const };
    }
    const json = await res.json();
    const parsed = GeorgeSchema.safeParse(json);
    if (!parsed.success) {
      console.warn('[propertydata] /george response schema invalid');
      return { answer: null, error: 'invalid_response' as const };
    }
    creditsThisProcess += 5; // /george is roughly 5 credits per call
    console.info(`[propertydata] /george +5 credits (process total: ${creditsThisProcess})`);
    return {
      answer: parsed.data.result?.answer ?? null,
      conversationId: parsed.data.result?.conversation_id,
      error: null as null,
    };
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      console.warn('[propertydata] /george timed out');
      return { answer: null, error: 'timeout' as const };
    }
    console.warn('[propertydata] /george failed', error);
    return { answer: null, error: 'unexpected' as const };
  } finally {
    clearTimeout(timer);
  }
}

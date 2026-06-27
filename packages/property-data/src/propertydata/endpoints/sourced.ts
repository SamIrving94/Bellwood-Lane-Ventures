import { z } from 'zod';
import { API_BASE, env, fetchPropertyData } from '../client';

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
 * Distressed property listings for ONE list type. Each call costs ~1
 * PropertyData credit and is cached 24h. Postcode-scoped.
 *
 * The PropertyData /sourced-properties endpoint accepts ONE list slug
 * per call (e.g. 'auction-properties'). For aggregating across multiple
 * distress signals, use {@link getSourcedPropertiesMulti}.
 */
export async function getSourcedProperties(
  postcode: string,
  opts?: { radiusMiles?: number; list?: string },
): Promise<SourcedProperty[]> {
  const params: Record<string, string | number> = {
    postcode: postcode.replace(/\s/g, ''),
    list: opts?.list ?? SOURCED_LIST_TYPES[0],
  };
  if (typeof opts?.radiusMiles === 'number') {
    params.radius = opts.radiusMiles;
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


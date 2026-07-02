import { z } from 'zod';
import { fetchPropertyData } from '../client';

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


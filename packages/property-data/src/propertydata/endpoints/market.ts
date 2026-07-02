import { z } from 'zod';
import { fetchPropertyData } from '../client';

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


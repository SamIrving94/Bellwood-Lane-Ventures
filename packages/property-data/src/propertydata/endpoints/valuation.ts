import { z } from 'zod';
import { fetchPropertyData } from '../client';

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


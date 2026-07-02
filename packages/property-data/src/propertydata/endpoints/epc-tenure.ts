import { z } from 'zod';
import { fetchPropertyData } from '../client';

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


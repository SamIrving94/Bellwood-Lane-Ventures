/**
 * HM Land Registry UK House Price Index (HPI) client
 *
 * Fetches monthly regional price trend data from the HMLR linked-data API.
 * No API key required. Falls back to synthetic data when the live call fails.
 *
 * Endpoint: https://landregistry.data.gov.uk/linked-data/house-price-index.json
 */

import { z } from 'zod';

const HPI_BASE =
  'https://landregistry.data.gov.uk/linked-data/house-price-index.json';

const REQUEST_TIMEOUT_MS = 8_000;

// ---------------------------------------------------------------------------
// Region slug mappings
// ---------------------------------------------------------------------------

const REGION_SLUGS: Record<string, string> = {
  london:
    'http://landregistry.data.gov.uk/id/region/london',
  'south-east':
    'http://landregistry.data.gov.uk/id/region/south-east',
  'south-west':
    'http://landregistry.data.gov.uk/id/region/south-west',
  east: 'http://landregistry.data.gov.uk/id/region/east-of-england',
  midlands:
    'http://landregistry.data.gov.uk/id/region/west-midlands',
  yorkshire:
    'http://landregistry.data.gov.uk/id/region/yorkshire-and-the-humber',
  'north-west':
    'http://landregistry.data.gov.uk/id/region/north-west',
  'north-east':
    'http://landregistry.data.gov.uk/id/region/north-east',
  england: 'http://landregistry.data.gov.uk/id/country/england',
};

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const HpiSchema = z.object({
  region: z.string(),
  averagePrice: z.number().nullable(),
  annualChange: z.number(),
  monthlyChange: z.number(),
  period: z.string(),
  trend: z.enum(['rising', 'stable', 'declining']),
  source: z.string(),
});

export type Hpi = z.infer<typeof HpiSchema>;

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

function parseHpiTrend(annualChange: number): 'rising' | 'stable' | 'declining' {
  if (annualChange > 3) return 'rising';
  if (annualChange < -1) return 'declining';
  return 'stable';
}

function mapPostcodeAreaToRegion(area: string): string {
  const londonAreas = [
    'E', 'EC', 'N', 'NW', 'SE', 'SW', 'W', 'WC',
    'BR', 'CR', 'DA', 'EN', 'HA', 'IG', 'KT', 'RM', 'SM', 'TN', 'TW', 'UB', 'WD',
  ];
  if (londonAreas.includes(area)) return REGION_SLUGS['london']!;

  const southEastAreas = ['BN', 'GU', 'ME', 'MK', 'OX', 'PO', 'RG', 'RH', 'SL', 'SO', 'SP'];
  if (southEastAreas.includes(area)) return REGION_SLUGS['south-east']!;

  const northWestAreas = ['BB', 'BL', 'CW', 'FY', 'L', 'LA', 'M', 'OL', 'PR', 'SK', 'WA', 'WN'];
  if (northWestAreas.includes(area)) return REGION_SLUGS['north-west']!;

  const yorkshireAreas = ['BD', 'DN', 'HD', 'HG', 'HU', 'HX', 'LS', 'S', 'WF', 'YO'];
  if (yorkshireAreas.includes(area)) return REGION_SLUGS['yorkshire']!;

  const midlandsAreas = ['B', 'CV', 'DE', 'DY', 'LE', 'NG', 'NN', 'ST', 'WS', 'WV'];
  if (midlandsAreas.includes(area)) return REGION_SLUGS['midlands']!;

  const northEastAreas = ['DH', 'DL', 'NE', 'SR', 'TS'];
  if (northEastAreas.includes(area)) return REGION_SLUGS['north-east']!;

  return REGION_SLUGS['england']!;
}

// ---------------------------------------------------------------------------
// Synthetic fallback
// ---------------------------------------------------------------------------

function syntheticHpi(): Hpi {
  const annualChange = parseFloat(
    ((Math.random() * 14) - 4).toFixed(2)
  );
  return {
    region: 'england',
    averagePrice: 250_000 + Math.floor(Math.random() * 150_000),
    annualChange,
    monthlyChange: parseFloat(((Math.random() * 2) - 0.5).toFixed(2)),
    period: new Date().toISOString().slice(0, 7),
    trend: parseHpiTrend(annualChange),
    source: 'synthetic',
  };
}

// ---------------------------------------------------------------------------
// Live fetch
// ---------------------------------------------------------------------------

async function fetchHpiLive(postcode: string): Promise<Hpi> {
  const area = postcode.replace(/\d.*/, '').toUpperCase().trim();
  const regionSlug = mapPostcodeAreaToRegion(area);

  const url = new URL(HPI_BASE);
  url.searchParams.set('region', regionSlug);
  url.searchParams.set('_sort', '-refPeriod');
  url.searchParams.set('_limit', '3');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let data: unknown;
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HMLR HPI API ${res.status}`);
    }
    data = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const raw = data as Record<string, unknown>;
  const items = (
    (raw.result as Record<string, unknown> | undefined)?.items ??
    raw.items ??
    []
  ) as Record<string, unknown>[];

  const latest = (items[0] ?? {}) as Record<string, unknown>;

  const annualChange =
    parseFloat(
      String(
        (latest.annualChange as string | undefined) ??
          (latest.percentageChange12m as string | undefined) ??
          '0'
      )
    ) || 0;

  const monthlyChange =
    parseFloat(
      String(
        (latest.monthlyChange as string | undefined) ??
          (latest.percentageChange1m as string | undefined) ??
          '0'
      )
    ) || 0;

  return {
    region: regionSlug,
    averagePrice:
      (latest.averagePrice as number | undefined) ??
      (latest.housePrice as number | undefined) ??
      null,
    annualChange,
    monthlyChange,
    period:
      (latest.refPeriod as string | undefined) ??
      new Date().toISOString().slice(0, 7),
    trend: parseHpiTrend(annualChange),
    source: 'hmlr_hpi',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch UK House Price Index data for the region containing this postcode.
 * Falls back to synthetic data if the live call fails.
 */
export async function getHousepriceIndex(postcode: string): Promise<Hpi> {
  try {
    return await fetchHpiLive(postcode);
  } catch (err) {
    console.warn(
      `[property-data/hmlr-hpi] live fetch failed (${(err as Error).message}), using synthetic`
    );
    return syntheticHpi();
  }
}

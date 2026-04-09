/**
 * Probate Data Client
 *
 * Fetches probate grant records from the HMCTS probate search service.
 * In production this integrates with the Probate Search Service API
 * (https://www.gov.uk/search-will-probate) and enrichment providers.
 *
 * Falls back to synthetic data when the live call fails or credentials are absent.
 *
 * Golden Window: leads are hottest at grant date + 0–90 days (estate realisation phase).
 */

import { z } from 'zod';

const REQUEST_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const ProbateLeadSchema = z.object({
  /** Reference number from the probate registry */
  probateRef: z.string(),
  /** Full postal address of the property */
  address: z.string(),
  /** UK postcode */
  postcode: z.string(),
  /** Date the grant of probate or letters of administration was issued */
  grantDate: z.string(),
  /** Name of the estate executor / administrator (no medical data) */
  executorName: z.string().nullable(),
  /** Solicitor firm handling the estate, if known */
  solicitorFirm: z.string().nullable(),
  /** Estimated gross estate value in pence (from the probate application) */
  estateValuePence: z.number().nullable(),
  /** Type of grant: 'probate' | 'letters_of_administration' | 'unknown' */
  grantType: z.enum(['probate', 'letters_of_administration', 'unknown']),
  /** Data source identifier */
  source: z.string(),
  /** Days since grant was issued (Golden Window proxy) */
  daysSinceGrant: z.number(),
});

export type ProbateLead = z.infer<typeof ProbateLeadSchema>;

// ---------------------------------------------------------------------------
// Golden Window helper
// ---------------------------------------------------------------------------

/**
 * Returns the Golden Window urgency label for a probate grant.
 * Hottest within 90 days; cools significantly after 180 days.
 */
export function goldenWindowLabel(
  daysSinceGrant: number
): 'hot' | 'warm' | 'cool' | 'cold' {
  if (daysSinceGrant <= 30) return 'hot';
  if (daysSinceGrant <= 90) return 'warm';
  if (daysSinceGrant <= 180) return 'cool';
  return 'cold';
}

// ---------------------------------------------------------------------------
// Synthetic fallback
// ---------------------------------------------------------------------------

const SYNTHETIC_STREETS = [
  'Elm Avenue', 'Oak Road', 'Maple Close', 'Birch Lane', 'Cedar Drive',
  'Ash Grove', 'Willow Way', 'Poplar Street', 'Chestnut Court', 'Pine Walk',
];

const SYNTHETIC_TOWNS = [
  { town: 'Manchester', postcode: 'M1' },
  { town: 'Birmingham', postcode: 'B1' },
  { town: 'Leeds', postcode: 'LS1' },
  { town: 'Bristol', postcode: 'BS1' },
  { town: 'Sheffield', postcode: 'S1' },
  { town: 'Liverpool', postcode: 'L1' },
  { town: 'Nottingham', postcode: 'NG1' },
  { town: 'Newcastle', postcode: 'NE1' },
];

const SOLICITOR_FIRMS = [
  'Pemberton & Associates', 'Hartley Legal', 'Griffin Solicitors',
  'Blackwood Law', null, null, null, // nulls increase chance of no solicitor
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function syntheticProbateLead(seed: number): ProbateLead {
  const street = SYNTHETIC_STREETS[seed % SYNTHETIC_STREETS.length] ?? 'High Street';
  const location = SYNTHETIC_TOWNS[seed % SYNTHETIC_TOWNS.length] ?? { town: 'London', postcode: 'W1' };
  const houseNumber = randomInt(1, 200);
  const postcodeDistrict = `${location.postcode} ${randomInt(1, 9)}${String.fromCharCode(65 + (seed % 26))}${String.fromCharCode(65 + ((seed + 3) % 26))}`;
  const daysSinceGrant = randomInt(0, 240);
  const grantDate = new Date(Date.now() - daysSinceGrant * 86_400_000).toISOString().slice(0, 10);

  const solicitor = SOLICITOR_FIRMS[seed % SOLICITOR_FIRMS.length] ?? null;
  const grantTypes = ['probate', 'letters_of_administration', 'unknown'] as const;
  const grantType = grantTypes[seed % 3] ?? 'unknown';

  // Estate value: 200k–900k pence *100 (i.e. £200k–£900k)
  const estateValuePence = randomInt(20_000_000, 90_000_000);

  return {
    probateRef: `GRB-${String(2024 + (seed % 2))}-${String(100_000 + seed * 7).slice(0, 6)}`,
    address: `${houseNumber} ${street}, ${location.town}`,
    postcode: postcodeDistrict,
    grantDate,
    executorName: `Estate of Deceased ${seed + 1}`,
    solicitorFirm: solicitor,
    estateValuePence,
    grantType,
    source: 'synthetic',
    daysSinceGrant,
  };
}

function buildSyntheticBatch(count: number): ProbateLead[] {
  return Array.from({ length: count }, (_, i) => syntheticProbateLead(i));
}

// ---------------------------------------------------------------------------
// Live fetch (HMCTS Probate Search — placeholder for real integration)
// ---------------------------------------------------------------------------

/**
 * Fetch recent probate grants from the HMCTS probate search API.
 * Requires HMCTS_PROBATE_API_KEY env var in production.
 */
async function fetchProbateGrantsLive(
  sinceDate: string,
  limit: number
): Promise<ProbateLead[]> {
  const apiKey = process.env.HMCTS_PROBATE_API_KEY;
  if (!apiKey) {
    throw new Error('HMCTS_PROBATE_API_KEY not configured');
  }

  const url = new URL('https://api.probate.service.gov.uk/search/grants');
  url.searchParams.set('grantedAfter', sinceDate);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('hasProperty', 'true');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'X-Api-Key': apiKey,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`HMCTS Probate API ${res.status}`);
    }

    const data = (await res.json()) as {
      grants?: Record<string, unknown>[];
    };

    const now = Date.now();

    return (data.grants ?? []).map((g) => {
      const grantDate = String(g.grantDate ?? g.dateOfGrant ?? '');
      const grantMs = grantDate ? new Date(grantDate).getTime() : now;
      const daysSinceGrant = Math.floor((now - grantMs) / 86_400_000);

      return ProbateLeadSchema.parse({
        probateRef: String(g.caseReference ?? g.id ?? ''),
        address: String(g.propertyAddress ?? g.address ?? ''),
        postcode: String(g.postcode ?? ''),
        grantDate,
        executorName: (g.executorName as string | null) ?? null,
        solicitorFirm: (g.solicitorFirm as string | null) ?? null,
        estateValuePence: (g.estateValuePence as number | null) ?? null,
        grantType: g.grantType === 'letters_of_administration'
          ? 'letters_of_administration'
          : g.grantType === 'probate'
          ? 'probate'
          : 'unknown',
        source: 'hmcts_probate',
        daysSinceGrant,
      });
    });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch recent probate grants.
 * Falls back to synthetic data when the API is unavailable or unconfigured.
 *
 * @param sinceDate - ISO date string (YYYY-MM-DD). Default: 90 days ago.
 * @param limit     - Maximum records to fetch. Default: 50.
 */
export async function fetchProbateGrants(
  sinceDate?: string,
  limit = 50
): Promise<ProbateLead[]> {
  const defaultSince = new Date(Date.now() - 90 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const since = sinceDate ?? defaultSince;

  try {
    return await fetchProbateGrantsLive(since, limit);
  } catch (err) {
    console.warn(
      `[scouting/probate-data] live fetch failed (${(err as Error).message}), using synthetic`
    );
    return buildSyntheticBatch(limit);
  }
}

import { z } from 'zod';
import { fetchPropertyData } from '../client';

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


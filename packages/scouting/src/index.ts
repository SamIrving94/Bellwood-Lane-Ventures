/**
 * @repo/scouting — Lead Acquisition Pipeline
 *
 * Entry point for the Bellwood Ventures scouting package.
 * Orchestrates probate data fetching, GDPR sanitisation,
 * enrichment (tier 1/2/3 cascade), scoring, and DB-ready output.
 *
 * Usage:
 *   import { runScoutingPipeline } from '@repo/scouting';
 *   const result = await runScoutingPipeline({ limit: 50 });
 */

import 'server-only';

import { getPricePaid } from '@repo/property-data/src/hmlr';
import { getHousepriceIndex } from '@repo/property-data/src/hmlr-hpi';
import { getSourcedProperties } from '@repo/property-data/src/propertydata';

import { fetchProbateGrants } from './probate-data';
import { fetchGazetteProbateNotices } from './gazette';
import { enrichLeads } from './enrichment';
import { scoreLead } from './scorer';
import { sanitisePayload, auditProtectedFields } from './rbac';

// ---------------------------------------------------------------------------
// Re-exports (public API surface)
// ---------------------------------------------------------------------------

export { fetchProbateGrants } from './probate-data';
export { fetchGazetteProbateNotices } from './gazette';
export { enrichLeads } from './enrichment';
export { scoreLead } from './scorer';
export { sanitisePayload, auditProtectedFields } from './rbac';

export type { ProbateLead } from './probate-data';
export type { EnrichedLead } from './enrichment';
export type { ScoreBreakdown, Verdict } from './scorer';

// ---------------------------------------------------------------------------
// ScoutLead — matches packages/database/prisma/schema.prisma ScoutLead model
// ---------------------------------------------------------------------------

export interface ScoutLead {
  runDate: Date;
  source: string;
  address: string;
  postcode: string;
  leadType: string;
  estimatedEquityPence: number | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  leadScore: number;
  verdict: 'STRONG' | 'VIABLE' | 'THIN' | 'PASS' | 'INSUFFICIENT_DATA';
  marketTrend: string | null;
  sourceTrail: string | null;
  rawPayload: Record<string, unknown> | null;
  status: 'new';
}

// ---------------------------------------------------------------------------
// Pipeline options
// ---------------------------------------------------------------------------

export interface ScoutingPipelineOptions {
  /** ISO date string; fetch grants issued after this date. Default: 90 days ago. */
  sinceDate?: string;
  /** Max leads to fetch per run. Default: 50. */
  limit?: number;
  /** Minimum score to include in output. Default: 30 (THIN+). */
  minScore?: number;
  /** Whether to include raw payload in output. Default: true. */
  includeRawPayload?: boolean;
  /** Postcodes to scan for PropertyData /sourced-properties. Optional. */
  sourcedPropertyPostcodes?: string[];
}

export interface ScoutingPipelineResult {
  runDate: Date;
  fetched: number;
  enriched: number;
  scored: number;
  leads: ScoutLead[];
  /** Counts by verdict */
  summary: {
    STRONG: number;
    VIABLE: number;
    THIN: number;
    PASS: number;
    INSUFFICIENT_DATA: number;
  };
  /** GDPR audit: list of protected fields stripped from any payload */
  gdprStripped: string[];
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Run the full scouting pipeline for one execution window.
 *
 * Steps:
 *   1. Fetch probate grants
 *   2. Sanitise raw payloads (GDPR)
 *   3. Enrich via tier 1/2/3 cascade
 *   4. Score each lead (motivation × equity × market × contact)
 *   5. Return ScoutLead-shaped objects ready for DB upsert
 */
export async function runScoutingPipeline(
  options: ScoutingPipelineOptions = {}
): Promise<ScoutingPipelineResult> {
  const {
    sinceDate,
    limit = 50,
    minScore = 30,
    includeRawPayload = true,
    sourcedPropertyPostcodes = [],
  } = options;

  const runDate = new Date();
  const allGdprStripped: string[] = [];

  // Step 1 — Fetch from all sources in parallel.
  //
  //   a) HMCTS probate-data placeholder (returns [] in production until wired
  //      to a real provider — see docs/scouting-roadmap.md)
  //   b) The Gazette probate notices (free, public, real-time)
  //   c) PropertyData /sourced-properties for each target postcode (paid,
  //      already-listed distressed properties)
  const [hmctsGrants, gazetteGrants, sourcedFromPostcodes] = await Promise.all([
    fetchProbateGrants(sinceDate, limit).catch((err) => {
      console.warn('[scouting] HMCTS source failed', err);
      return [];
    }),
    fetchGazetteProbateNotices(30, limit).catch((err) => {
      console.warn('[scouting] Gazette source failed', err);
      return [];
    }),
    Promise.all(
      sourcedPropertyPostcodes.map(async (postcode) => {
        try {
          const properties = await getSourcedProperties(postcode);
          // Map SourcedProperty → ProbateLead-shape so the pipeline can
          // score them uniformly. Listing type informs leadType.
          return properties.map((p) => ({
            probateRef: `pd-${postcode}-${p.address.slice(0, 16).replace(/\s+/g, '_')}`,
            address: p.address,
            postcode: p.postcode,
            grantDate: new Date().toISOString().slice(0, 10),
            executorName: null,
            solicitorFirm: null,
            estateValuePence: p.estimatedValuePence ?? p.pricePence,
            grantType: 'unknown' as const,
            source: `propertydata_${p.listingType}`,
            daysSinceGrant: p.daysOnMarket ?? 0,
          }));
        } catch (err) {
          console.warn(`[scouting] /sourced-properties failed for ${postcode}`, err);
          return [];
        }
      }),
    ).then((arrays) => arrays.flat()),
  ]);

  // De-duplicate by address+postcode (case-insensitive).
  const seen = new Set<string>();
  const rawGrants = [...hmctsGrants, ...gazetteGrants, ...sourcedFromPostcodes].filter((g) => {
    const key = `${g.address.toLowerCase()}|${g.postcode.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);

  console.info(
    `[scouting] sources: hmcts=${hmctsGrants.length} gazette=${gazetteGrants.length} propertydata=${sourcedFromPostcodes.length} (after dedupe: ${rawGrants.length})`,
  );

  // Step 2 — GDPR sanitise raw payloads
  const sanitisedGrants = rawGrants.map((grant) => {
    const raw = grant as unknown as Record<string, unknown>;
    const stripped = auditProtectedFields(raw);
    if (stripped.length) {
      allGdprStripped.push(...stripped.map((f) => `${grant.probateRef}:${f}`));
    }
    return sanitisePayload(raw);
  });

  // Step 3 — Enrich via tier cascade
  const enriched = await enrichLeads(rawGrants);

  // Step 4 — Score leads (fan-out postcode lookups)
  const scored = await Promise.all(
    enriched.map(async (lead, i) => {
      const [pricePaid, hpi] = await Promise.all([
        getPricePaid(lead.postcode).catch(() => null),
        getHousepriceIndex(lead.postcode).catch(() => null),
      ]);

      const breakdown = scoreLead(lead, pricePaid, hpi);

      const scoutLead: ScoutLead = {
        runDate,
        source: lead.sourceTrail.split(' → ')[0] ?? 'unknown',
        address: lead.address,
        postcode: lead.postcode,
        leadType: lead.leadType,
        estimatedEquityPence: lead.estateValuePence,
        contactName: lead.contactName,
        contactPhone: lead.contactPhone,
        contactEmail: lead.contactEmail,
        leadScore: breakdown.total,
        verdict: breakdown.verdict,
        marketTrend: breakdown.marketTrendLabel,
        sourceTrail: lead.sourceTrail,
        rawPayload: includeRawPayload ? (sanitisedGrants[i] ?? null) : null,
        status: 'new',
      };

      return scoutLead;
    })
  );

  // Step 5 — Filter by minScore, sort strongest first
  const qualified = scored
    .filter((l) => l.verdict !== 'INSUFFICIENT_DATA' && l.leadScore >= minScore)
    .sort((a, b) => b.leadScore - a.leadScore);

  const summary = {
    STRONG: 0,
    VIABLE: 0,
    THIN: 0,
    PASS: 0,
    INSUFFICIENT_DATA: 0,
  };

  for (const lead of qualified) {
    summary[lead.verdict]++;
  }

  return {
    runDate,
    fetched: rawGrants.length,
    enriched: enriched.length,
    scored: scored.length,
    leads: qualified,
    summary,
    gdprStripped: allGdprStripped,
  };
}

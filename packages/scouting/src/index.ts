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
import {
  getSourcedPropertiesMulti,
  getAccountCredits,
  getPlanningApplications,
  getHmoRegister,
  getDemographics,
  getFloodRisk,
  getEpcByPostcode,
  getTenureByPostcode,
} from '@repo/property-data/src/propertydata';
import {
  searchDissolvedPropertyCompanies,
  filterCompaniesByDistrict,
} from '@repo/property-data/src/companies-house';

import { fetchProbateGrants } from './probate-data';
import { fetchGazetteProbateNotices } from './gazette';
import {
  checkEnrichmentHealth,
  type EnrichmentSummary,
  enrichLeads,
  summariseEnrichment,
} from './enrichment';
import { scoreLead } from './scorer';
import { DEFAULT_SCORER_CONFIG, type ScorerConfig } from './scorer-config';
import { sanitisePayload, auditProtectedFields } from './rbac';
import { enrichRationaleWithLlm } from './rationale-llm';

/** Return the most-frequent value in an array (first wins on tie). */
function mostCommon<T extends string>(items: T[]): T | null {
  if (items.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of items) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Re-exports (public API surface)
// ---------------------------------------------------------------------------

export { fetchProbateGrants } from './probate-data';
export { fetchGazetteProbateNotices } from './gazette';
export {
  checkEnrichmentHealth,
  enrichLeads,
  summariseEnrichment,
} from './enrichment';
export { scoreLead } from './scorer';
export {
  DEFAULT_SCORER_CONFIG,
  mergeScorerConfig,
  type ScorerConfig,
} from './scorer-config';
export { sanitisePayload, auditProtectedFields } from './rbac';
export { enrichRationaleWithLlm } from './rationale-llm';

export type { ProbateLead } from './probate-data';
export type {
  EnrichedLead,
  EnrichmentHealth,
  EnrichmentSummary,
} from './enrichment';
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
  /** Version of the EvalConfig that produced this score (null = hard-coded defaults). */
  evalConfigVersion: number | null;
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
  /**
   * Legacy: postcode districts. PropertyData rejects districts on
   * /sourced-properties, so prefer `scanSeeds` instead. Kept for
   * backward compat with older callers.
   */
  sourcedPropertyPostcodes?: string[];
  /**
   * Scan seeds for PropertyData /sourced-properties. Each seed is a
   * full UK postcode (e.g. "M14 5LL") plus a radius in miles. The cron
   * fires one /sourced-properties call per seed.
   */
  scanSeeds?: Array<{ label?: string; postcode: string; radiusMiles: number }>;
  /**
   * Active scorer config (weights/thresholds) loaded from the EvalConfig table.
   * When omitted, the scorer uses its hard-coded DEFAULT_SCORER_CONFIG.
   */
  scorerConfig?: ScorerConfig;
  /**
   * Version number of the EvalConfig used. Stamped onto every persisted lead
   * so calibration can attribute a score to the config that produced it.
   * Null when scoring with hard-coded defaults.
   */
  evalConfigVersion?: number | null;
  /**
   * When true, the pipeline runs an extra Claude call for STRONG-verdict
   * leads and stamps a plain-English rationale onto `rawPayload.rationaleLlm`.
   * Defaults false — caller (the scouting cron) opts in.
   *
   * Cost-safe: STRONG-only means typically <20 calls per cron run.
   */
  enrichRationaleLlm?: boolean;
  /**
   * Skip the slow, low-yield PropertyData sources (planning-applications +
   * national-HMO-register) and the Companies-House dissolved-company scan.
   * Each planning/HMO loop carries ~11s + 2.7s/seed of MANDATORY rate-limit
   * sleeps plus serial API calls, for sources that in practice produce almost
   * no qualified leads (sourced-properties is the productive feed). The daily
   * cron sets this true so the pipeline reliably finishes — and persists +
   * surfaces leads — inside the function's time budget. HMCTS + Gazette +
   * sourced-properties still run.
   */
  skipSlowSources?: boolean;
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
  /** Per-source breakdown so we can debug which source produced what. */
  sources: {
    hmcts: number;
    gazette: number;
    propertydata: number;
    planning: number;
    hmo: number;
    dissolved: number;
    staleListings: number;
    afterDedupe: number;
    postcodesScanned: number;
  };
  /** Per-source errors (truncated) for diagnostic surfacing. */
  sourceErrors: {
    hmcts?: string;
    gazette?: string;
    propertydata?: string;
    planning?: string;
    hmo?: string;
    dissolved?: string;
    staleListings?: string;
    enrichment?: string;
  };
  /** Contact-enrichment tier distribution + hit-rate for this run. */
  enrichment: EnrichmentSummary;
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
    scanSeeds = [],
    scorerConfig = DEFAULT_SCORER_CONFIG,
    evalConfigVersion = null,
    enrichRationaleLlm = false,
    skipSlowSources = false,
  } = options;

  const runDate = new Date();
  const allGdprStripped: string[] = [];

  // Step 1 — Fetch from all sources in parallel. Capture errors per source.
  const sourceErrors: {
    hmcts?: string;
    gazette?: string;
    propertydata?: string;
    planning?: string;
    hmo?: string;
    dissolved?: string;
    staleListings?: string;
    enrichment?: string;
  } = {};

  // Pre-flight: if we have postcodes to scan, verify PropertyData is reachable
  // by hitting the (free) /account/credits endpoint. This catches the most
  // common silent failure: PROPERTYDATA_API_KEY missing on the API project.
  if (sourcedPropertyPostcodes.length > 0 || scanSeeds.length > 0) {
    const credits = await getAccountCredits().catch((err) => {
      sourceErrors.propertydata = `account-credits check failed: ${(err as Error)?.message ?? String(err)}`;
      return null;
    });
    if (!credits) {
      sourceErrors.propertydata = sourceErrors.propertydata ?? 'PROPERTYDATA_API_KEY missing or invalid on bellwood-api (account-credits returned null)';
    } else if (credits.result) {
      const remaining = (credits.result as { credits_remaining?: number }).credits_remaining;
      if (typeof remaining === 'number' && remaining <= 0) {
        sourceErrors.propertydata = `PropertyData credits exhausted (${remaining} remaining)`;
      }
    }
  }

  // Combine legacy districts (best-effort) + new scan seeds (proper).
  type SeedCall = { label: string; postcode: string; radiusMiles?: number };
  const allSeeds: SeedCall[] = [
    ...sourcedPropertyPostcodes.map((pc) => ({ label: pc, postcode: pc })),
    ...scanSeeds.map((s) => ({
      label: s.label ?? s.postcode,
      postcode: s.postcode,
      radiusMiles: s.radiusMiles,
    })),
  ];

  // We split sources by rate-limit dependency:
  //  - HMCTS + Gazette are external (no PropertyData rate limit) → parallel
  //  - PropertyData sources (sourced/planning/HMO) → serial to stay under
  //    the "4 calls / 10s" rate limit
  const [hmctsGrants, gazetteGrants] = await Promise.all([
    fetchProbateGrants(sinceDate, limit).catch((err) => {
      const msg = (err as Error)?.message ?? String(err);
      sourceErrors.hmcts = msg.slice(0, 200);
      console.warn('[scouting] HMCTS source failed', err);
      return [];
    }),
    fetchGazetteProbateNotices(30, limit).catch((err) => {
      const msg = (err as Error)?.message ?? String(err);
      sourceErrors.gazette = msg.slice(0, 200);
      console.warn('[scouting] Gazette source failed', err);
      return [];
    }),
  ]);

  // ── PropertyData sources — serial (rate-limit constrained) ─────────
  const sourcedFromPostcodes = await (async () => {
      const all: Array<{
        probateRef: string;
        address: string;
        postcode: string;
        grantDate: string;
        executorName: null;
        solicitorFirm: string | null;
        estateValuePence: number | null;
        grantType: 'unknown';
        source: string;
        daysSinceGrant: number;
        /** Rich PropertyData fields — flow through rawPayload to the UI. */
        propertyData?: {
          id: string | null;
          listingType: string;
          listingUrl: string | null;
          imageUrl: string | null;
          summary: string | null;
          pricePence: number | null;
          originalPricePence: number | null;
          discountPercent: number | null;
          reductionCount: number;
          velocityScore: number;
          bedrooms: number | null;
          propertyType: string | null;
          daysOnMarket: number | null;
          daysSincePriceChange: number | null;
          preciseAddress: string | null;
        };
      }> = [];
      for (const seed of allSeeds) {
        try {
          const properties = await getSourcedPropertiesMulti(seed.postcode, {
            radiusMiles: seed.radiusMiles,
          });
          for (const p of properties) {
            all.push({
              probateRef: `pd-${seed.label}-${p.id ?? p.address.slice(0, 16).replace(/\s+/g, '_')}`,
              address: p.address,
              postcode: p.postcode,
              grantDate: new Date().toISOString().slice(0, 10),
              executorName: null,
              solicitorFirm: null,
              estateValuePence: p.originalPricePence ?? p.pricePence,
              grantType: 'unknown' as const,
              source: `propertydata_${p.listingType}`,
              daysSinceGrant: p.daysOnMarket ?? 0,
              propertyData: {
                id: p.id,
                listingType: p.listingType,
                listingUrl: p.listingUrl,
                imageUrl: p.imageUrl,
                summary: p.summary,
                pricePence: p.pricePence,
                originalPricePence: p.originalPricePence,
                discountPercent: p.discountPercent,
                reductionCount: p.reductionCount,
                velocityScore: p.velocityScore,
                bedrooms: p.bedrooms,
                propertyType: p.propertyType,
                daysOnMarket: p.daysOnMarket,
                daysSincePriceChange: p.daysSincePriceChange,
                preciseAddress: p.preciseAddress,
              },
            });
          }
        } catch (err) {
          const msg = (err as Error)?.message ?? String(err);
          if (!sourceErrors.propertydata) {
            sourceErrors.propertydata = `${seed.label}: ${msg.slice(0, 150)}`;
          }
          console.warn(`[scouting] /sourced-properties failed for ${seed.label}`, err);
        }
      }
      return all;
  })();

  // Helper for the planning + HMO source shape (matches probateRef contract)
  type RawGrant = {
    probateRef: string;
    address: string;
    postcode: string;
    grantDate: string;
    executorName: null;
    solicitorFirm: string | null;
    estateValuePence: number | null;
    grantType: 'unknown';
    source: string;
    daysSinceGrant: number;
    /** Rich planning fields when source = planning_* */
    planning?: {
      reference: string;
      authority: string | null;
      proposal: string | null;
      category: string | null;
      status: string | null;
      decision: string | null;
      decisionRating: string | null;
      receivedAt: string | null;
      decidedAt: string | null;
      url: string | null;
      sellerSignalScore: number;
    };
    /** Rich HMO fields when source = hmo_* */
    hmo?: {
      reference: string;
      council: string | null;
      licenceType: string | null;
      licenceExpiry: string | null;
      licenceExpiringSoon: boolean;
    };
    /** Rich dissolved-company fields when source = dissolved_company */
    dissolvedCompany?: {
      companyNumber: string;
      companyName: string;
      dissolvedAt: string | null;
      sicCodes: string[];
      registeredAddress: string | null;
    };
  };

  // Throttle between PropertyData calls to stay within rate limit.
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // ── /planning-applications — serial after sourced ───────────────────
  const planningGrants: RawGrant[] = [];
  for (let i = 0; !skipSlowSources && i < allSeeds.length; i++) {
    const seed = allSeeds[i]!;
    // First iteration: wait long enough for the sourced phase's rate-limit
    // window to clear (PropertyData allows 4 calls / 10s).
    await sleep(i === 0 ? 11000 : 2700);
    try {
      const apps = await getPlanningApplications(seed.postcode, {
        radiusMiles: seed.radiusMiles,
      });
      for (const app of apps) {
        if (app.sellerSignalScore < 45) continue;
        const pc = app.postcode ?? seed.postcode.split(' ')[0]!;
        planningGrants.push({
          probateRef: `pln-${seed.label}-${app.reference.slice(0, 24).replace(/\s+/g, '_')}`,
          address: app.address,
          postcode: pc,
          grantDate: app.decidedAt ?? new Date().toISOString().slice(0, 10),
          executorName: null,
          solicitorFirm: null,
          estateValuePence: null,
          grantType: 'unknown' as const,
          source: `planning_${app.decisionRating ?? 'pending'}`,
          daysSinceGrant: 0,
          planning: {
            reference: app.reference,
            authority: app.authority,
            proposal: app.proposal,
            category: app.category,
            status: app.status,
            decision: app.decision,
            decisionRating: app.decisionRating,
            receivedAt: app.receivedAt,
            decidedAt: app.decidedAt,
            url: app.url,
            sellerSignalScore: app.sellerSignalScore,
          },
        });
      }
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      if (!sourceErrors.planning) {
        sourceErrors.planning = `${seed.label}: ${msg.slice(0, 150)}`;
      }
    }
  }

  // ── /national-hmo-register — serial after planning ──────────────────
  const hmoGrants: RawGrant[] = [];
  for (let i = 0; !skipSlowSources && i < allSeeds.length; i++) {
    const seed = allSeeds[i]!;
    await sleep(i === 0 ? 11000 : 2700);
    try {
      const hmos = await getHmoRegister(seed.postcode, {
        radiusMiles: seed.radiusMiles,
      });
      for (const hmo of hmos) {
        const pcMatch = hmo.address.match(
          /[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}/,
        );
        const pc = pcMatch ? pcMatch[0] : seed.postcode.split(' ')[0]!;
        hmoGrants.push({
          probateRef: `hmo-${seed.label}-${hmo.reference.slice(0, 24).replace(/\s+/g, '_')}`,
          address: hmo.address,
          postcode: pc,
          grantDate: new Date().toISOString().slice(0, 10),
          executorName: null,
          solicitorFirm: null,
          estateValuePence: null,
          grantType: 'unknown' as const,
          source: hmo.licenceExpiringSoon
            ? 'hmo_licence_expiring'
            : 'hmo_register',
          daysSinceGrant: 0,
          hmo: {
            reference: hmo.reference,
            council: hmo.council,
            licenceType: hmo.licenceType,
            licenceExpiry: hmo.licenceExpiry,
            licenceExpiringSoon: hmo.licenceExpiringSoon,
          },
        });
      }
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      if (!sourceErrors.hmo) {
        sourceErrors.hmo = `${seed.label}: ${msg.slice(0, 150)}`;
      }
    }
  }

  // ── Companies House — dissolved property companies in our districts ─
  // Distinct rate-limit pool from PropertyData (different API), runs in
  // parallel with HMO loop safely. No-ops if COMPANIES_HOUSE_API_KEY unset.
  const dissolvedGrants: RawGrant[] = [];
  if (!skipSlowSources) try {
    const targetDistricts = Array.from(
      new Set(
        allSeeds.map((s) => {
          const norm = s.postcode.toUpperCase().replace(/\s+/g, '');
          const m = norm.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
          return m?.[1] ?? norm;
        }),
      ),
    );
    const all = await searchDissolvedPropertyCompanies({ limit: 100 });
    const inArea = filterCompaniesByDistrict(all, targetDistricts);
    for (const c of inArea) {
      if (!c.registeredAddress || !c.registeredPostcode) continue;
      dissolvedGrants.push({
        probateRef: `dis-${c.companyNumber}`,
        address: c.registeredAddress,
        postcode: c.registeredPostcode,
        grantDate: c.dissolvedAt ?? new Date().toISOString().slice(0, 10),
        executorName: null,
        solicitorFirm: c.companyName,
        estateValuePence: null,
        grantType: 'unknown' as const,
        source: 'companies_house_dissolved',
        daysSinceGrant: c.dissolvedAt
          ? Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(c.dissolvedAt).getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
            )
          : 0,
        dissolvedCompany: {
          companyNumber: c.companyNumber,
          companyName: c.companyName,
          dissolvedAt: c.dissolvedAt,
          sicCodes: c.sicCodes,
          registeredAddress: c.registeredAddress,
        },
      });
    }
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    sourceErrors.dissolved = msg.slice(0, 200);
  }

  // If we have no seeds at all, flag it as a config issue.
  if (allSeeds.length === 0 && !sourceErrors.propertydata) {
    sourceErrors.propertydata = 'no scan seeds configured — add full-postcode seeds in /settings/scouting';
  }

  // De-duplicate by address+postcode (case-insensitive).
  const seen = new Set<string>();
  const rawGrants = [
    ...hmctsGrants,
    ...gazetteGrants,
    ...sourcedFromPostcodes,
    ...planningGrants,
    ...hmoGrants,
    ...dissolvedGrants,
  ].filter((g) => {
    const key = `${g.address.toLowerCase()}|${g.postcode.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);

  console.info(
    `[scouting] sources: hmcts=${hmctsGrants.length} gazette=${gazetteGrants.length} propertydata=${sourcedFromPostcodes.length} planning=${planningGrants.length} hmo=${hmoGrants.length} (after dedupe: ${rawGrants.length})`,
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

  // Build signals lookup BEFORE enrichment (we lose rawGrant after enrich).
  // Keyed by probateRef so we can rejoin even when enrichLeads drops rows.
  const signalsByRef = new Map<
    string,
    {
      reductionCount?: number;
      velocityScore?: number;
      daysOnMarket?: number | null;
      discountPercent?: number | null;
      listingType?: string;
    }
  >();
  for (const g of rawGrants) {
    const pd = (g as { propertyData?: Record<string, unknown> }).propertyData;
    if (pd) {
      signalsByRef.set(g.probateRef, {
        reductionCount:
          typeof pd.reductionCount === 'number'
            ? (pd.reductionCount as number)
            : undefined,
        velocityScore:
          typeof pd.velocityScore === 'number'
            ? (pd.velocityScore as number)
            : undefined,
        daysOnMarket:
          typeof pd.daysOnMarket === 'number'
            ? (pd.daysOnMarket as number)
            : null,
        discountPercent:
          typeof pd.discountPercent === 'number'
            ? (pd.discountPercent as number)
            : null,
        listingType:
          typeof pd.listingType === 'string'
            ? (pd.listingType as string)
            : undefined,
      });
    }
  }

  // Step 3 — Enrich via tier cascade.
  // Pre-flight: if no automated enrichment tier is configured, every probate
  // lead falls to the manual queue with no contact. Surface that as a source
  // error so the scouting cron raises a founder alert rather than silently
  // shipping contact-less leads (a lead with no reachable contact is dead).
  const enrichmentHealth = checkEnrichmentHealth();
  if (enrichmentHealth.degraded && rawGrants.length > 0) {
    sourceErrors.enrichment =
      'no automated enrichment tier configured (PROBATE_DATA_API_KEY / BATCH_DATA_API_KEY missing) — probate leads will have no contact details';
  }

  const enriched = await enrichLeads(rawGrants);

  // Post-flight: a zero contact hit-rate across a non-trivial batch is the
  // classic signature of a silently-broken enrichment API (everything falling
  // straight to Tier 3 manual).
  const enrichmentSummary = summariseEnrichment(enriched);
  if (
    !sourceErrors.enrichment &&
    enrichmentSummary.total >= 3 &&
    enrichmentSummary.contactHitRate === 0
  ) {
    sourceErrors.enrichment = `enrichment returned no contacts for any of ${enrichmentSummary.total} leads — Tier 1/2 APIs may be down`;
  }

  // Pre-fetch per-postcode enrichment ONCE per unique postcode to save
  // credits (each call cached). These drive the demographic boost
  // (pre-probate) and the risk dimension (flood/EPC/lease).
  const uniquePostcodes = Array.from(
    new Set(enriched.map((l) => l.postcode).filter(Boolean)),
  );
  const enrichmentByPostcode = new Map<
    string,
    {
      percentOver65: number | null;
      percentOver75: number | null;
      floodRisk: string | null;
      epcRating: string | null;
      tenure: 'freehold' | 'leasehold' | 'unknown';
      remainingLeaseYears: number | null;
    }
  >();
  for (const pc of uniquePostcodes) {
    try {
      const [demo, flood, epcs, tenures] = await Promise.all([
        getDemographics(pc).catch(() => null),
        getFloodRisk(pc).catch(() => null),
        getEpcByPostcode(pc).catch(() => []),
        getTenureByPostcode(pc).catch(() => []),
      ]);

      const floodResult = (flood as { result?: Record<string, string> } | null)
        ?.result;
      const floodBand =
        floodResult?.rivers_and_sea ?? floodResult?.surface_water ?? null;

      // Average EPC rating across known records in this postcode.
      const epcRatings = epcs
        .map((e) => e.rating)
        .filter((r): r is string => !!r);
      const dominantEpc = epcRatings.length
        ? mostCommon(epcRatings)
        : null;

      // Most common tenure + min remaining lease years.
      const tenureCounts = { freehold: 0, leasehold: 0 };
      let minLeaseYears: number | null = null;
      for (const t of tenures) {
        if (t.tenure === 'freehold') tenureCounts.freehold++;
        else if (t.tenure === 'leasehold') tenureCounts.leasehold++;
        if (
          t.remainingLeaseYears !== null &&
          (minLeaseYears === null || t.remainingLeaseYears < minLeaseYears)
        ) {
          minLeaseYears = t.remainingLeaseYears;
        }
      }
      const tenure: 'freehold' | 'leasehold' | 'unknown' =
        tenureCounts.freehold > tenureCounts.leasehold
          ? 'freehold'
          : tenureCounts.leasehold > 0
            ? 'leasehold'
            : 'unknown';

      enrichmentByPostcode.set(pc, {
        percentOver65: demo?.percentOver65 ?? null,
        percentOver75: demo?.percentOver75 ?? null,
        floodRisk: floodBand,
        epcRating: dominantEpc,
        tenure,
        remainingLeaseYears: minLeaseYears,
      });
    } catch {
      // Silent — risk enrichment is additive, not required
    }
  }

  // Step 4 — Score leads (fan-out postcode lookups)
  const scored = await Promise.all(
    enriched.map(async (lead, i) => {
      const [pricePaid, hpi] = await Promise.all([
        getPricePaid(lead.postcode).catch(() => null),
        getHousepriceIndex(lead.postcode).catch(() => null),
      ]);

      const baseSignals = signalsByRef.get(lead.probateRef) ?? {};
      const pc = enrichmentByPostcode.get(lead.postcode);
      const signals = {
        ...baseSignals,
        percentOver65: pc?.percentOver65 ?? null,
        percentOver75: pc?.percentOver75 ?? null,
        floodRisk: pc?.floodRisk ?? null,
        epcRating: pc?.epcRating ?? null,
        tenure: pc?.tenure ?? null,
        remainingLeaseYears: pc?.remainingLeaseYears ?? null,
      };
      const breakdown = scoreLead(lead, pricePaid, hpi, signals, scorerConfig);

      // Stamp the full "why this score" payload onto rawPayload so the UI
      // can render it verbatim — no inference, no guesswork.
      let enrichedRaw = sanitisedGrants[i] ?? null;
      if (includeRawPayload && enrichedRaw) {
        enrichedRaw = {
          ...enrichedRaw,
          riskFlags: breakdown.riskFlags,
          rationale: breakdown.rationale,
          scoreFactors: breakdown.factors,
          scoreBreakdown: {
            motivation: breakdown.motivation,
            equity: breakdown.equity,
            marketTrend: breakdown.marketTrend,
            contactQuality: breakdown.contactQuality,
            risk: breakdown.risk,
            total: breakdown.total,
          },
        };
      }

      // Opt-in LLM rationale on STRONG leads only. Side-effect-safe: returns
      // null on missing key / call failure, in which case the deterministic
      // `rationale` field above is the surface the UI renders.
      if (
        enrichRationaleLlm &&
        breakdown.verdict === 'STRONG' &&
        enrichedRaw
      ) {
        const llmRationale = await enrichRationaleWithLlm(breakdown, {
          address: lead.address,
          postcode: lead.postcode,
          estateValuePence: lead.estateValuePence,
        });
        if (llmRationale) {
          enrichedRaw = { ...enrichedRaw, rationaleLlm: llmRationale };
        }
      }

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
        rawPayload: enrichedRaw,
        status: 'new',
        evalConfigVersion,
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
    sources: {
      hmcts: hmctsGrants.length,
      gazette: gazetteGrants.length,
      propertydata: sourcedFromPostcodes.length,
      planning: planningGrants.length,
      hmo: hmoGrants.length,
      dissolved: dissolvedGrants.length,
      staleListings: 0,
      afterDedupe: rawGrants.length,
      postcodesScanned: allSeeds.length,
    },
    sourceErrors,
    enrichment: enrichmentSummary,
  };
}

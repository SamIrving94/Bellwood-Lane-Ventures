import { env } from '@/env';
import { Prisma, database } from '@repo/database';
import { getPropertySnapshot } from '@repo/property-data/src/propertydata';
import {
  dedupeDealbreakerRules,
  mergeScorerConfig,
  runScoutingPipeline,
  screenDealbreakers,
  summariseSourceHealth,
} from '@repo/scouting';
import { NextResponse, after } from 'next/server';
import { recordChargeObservation } from '../_lib/entity-graph';
import { recordCronHeartbeat } from '../_lib/heartbeat';
import { mergeAreaProbes } from '../_lib/merge-area-probes';
import {
  type ScoutRunStats,
  buildDryStreakActionCopy,
  buildReviewActionCopy,
  countDryStreak,
  dryStreakThreshold,
  shouldAlertDryStreak,
} from '../_lib/scout-freshness';
import { selfOrigin } from '../_lib/self-origin';

// Snapshot enrichment is slow (~27s per unique postcode). Allow more time
// than the default 60s — bumps to Vercel Pro plan cap.
export const maxDuration = 800;

/**
 * The scouting pipeline — FOUNDER-TRIGGERED (was daily at 7am).
 *
 * The daily schedule was removed on 27 Aug 2026 at the founder's direction:
 * each run spends real PropertyData credits, and running on demand from
 * Settings → Scouting ("Run scout now") lets the founder control spend and
 * review each run properly. The route itself is unchanged — the Vercel cron
 * entry is gone, the trigger is `triggerScoutingCron` in the dashboard
 * (Bearer CRON_SECRET, same auth as before).
 *
 * Mirrors the FounderAction creation in /agents/leads so the founder
 * dashboard's Today page surfaces high-scoring leads regardless of how the
 * run was triggered.
 */

// The pipeline gets this much wall-clock for its paid phases; the ~3 min
// left inside maxDuration (800s) covers scoring tails, persistence, probe
// write-backs and founder-surfacing. From 24–27 Aug 2026 the run outgrew
// the budget (prime seeds → 935 listings → 60-lead shortlist → rate-limited
// enrichment), the platform killed it at 800s BEFORE persistence, and four
// days of leads evaporated as 504s. The deadline makes that impossible:
// past it the pipeline stops paid enrichment and returns what it has.
const PIPELINE_BUDGET_MS = 620_000;

export const POST = async (request: Request) => {
  const startedAtMs = Date.now();
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Read scouting.areas (the new single source) ─────────────────────
  // Each Area = { id, label, seedPostcode, district, radiusMiles, lastProbe }
  //
  // We scan a BOUNDED batch of areas per run and rotate. The PropertyData
  // planning + HMO loops inside the pipeline are serial and rate-limited
  // (mandatory ~11s + 2.7s/seed sleeps EACH loop), and the whole pipeline
  // must finish inside maxDuration (300s) BEFORE the first lead is persisted.
  // With the full 16-area list that produced ~32 seed-calls and ~200s of pure
  // sleep — the function was killed mid-run, persisting nothing. That is why
  // zero leads landed and no completion event was logged for weeks.
  //
  // Fix: pick the MAX_SEEDS_PER_RUN oldest-probed (never-probed first) areas,
  // stamp lastProbe after the run so tomorrow picks the next batch, and rotate
  // through the whole list over a few days. `track: 'prime'` areas sit outside
  // this rotation and are scanned every run instead — see below.
  const MAX_SEEDS_PER_RUN = 6;

  type ScanSeed = {
    label?: string;
    postcode: string;
    radiusMiles: number;
    isPrime?: boolean;
  };
  let scanSeeds: ScanSeed[] = [];
  let sourcedPropertyPostcodes: string[] = [];
  // Raw area objects + the ids we scanned this run — used to advance rotation.
  let areasRaw: Record<string, unknown>[] | null = null;
  let selectedAreaIds: string[] = [];
  let primeDistricts: string[] = [];
  // How many areas are actually IN the rotation queue (i.e. survived parsing —
  // an area with no seedPostcode is dropped and never scanned). Null on the
  // legacy path, which doesn't rotate at all. The dry-run alert below divides
  // this by MAX_SEEDS_PER_RUN to work out how many runs one full sweep takes,
  // so it must be the live count, never a hard-coded guess.
  let rotationAreaCount: number | null = null;

  try {
    const areasSetting = await database.setting.findUnique({
      where: { key: 'scouting.areas' },
    });
    if (areasSetting && Array.isArray(areasSetting.value)) {
      areasRaw = (areasSetting.value as unknown[]).filter(
        (r): r is Record<string, unknown> => !!r && typeof r === 'object'
      );
      const parsed = areasRaw.flatMap((a) => {
        const seedPostcode =
          typeof a.seedPostcode === 'string' ? a.seedPostcode : null;
        const radiusMiles =
          typeof a.radiusMiles === 'number' ? a.radiusMiles : 1.5;
        const label = typeof a.label === 'string' ? a.label : undefined;
        const id =
          typeof a.id === 'string' ? a.id : (seedPostcode ?? `${label}`);
        const isPrime = a.track === 'prime';
        // never-probed → 0 so it sorts to the FRONT of the rotation queue.
        const lp = a.lastProbe as { checkedAt?: unknown } | null | undefined;
        const lastProbeAt =
          lp && typeof lp.checkedAt === 'string'
            ? Number.isFinite(Date.parse(lp.checkedAt))
              ? Date.parse(lp.checkedAt)
              : 0
            : 0;
        if (!seedPostcode) return [];
        const district = typeof a.district === 'string' ? a.district : null;
        return [
          {
            id,
            seedPostcode,
            radiusMiles,
            label,
            lastProbeAt,
            isPrime,
            district,
          },
        ];
      });

      // Prime-focus areas are scanned on EVERY run — scarce, high-value stock
      // (see packages/scouting/src/track.ts) is worth a founder glance
      // whenever it appears, so a once-every-few-days rotation slot isn't a
      // real "focus". They sit outside the rotation entirely: not counted
      // against MAX_SEEDS_PER_RUN, not part of the sweep-length math below.
      const primeAreas = parsed.filter((a) => a.isPrime);
      const volumeAreas = parsed.filter((a) => !a.isPrime);

      rotationAreaCount = volumeAreas.length;
      // Oldest-probed (and never-probed) first; bounded batch per run.
      volumeAreas.sort((a, b) => a.lastProbeAt - b.lastProbeAt);
      const batch = volumeAreas.slice(0, MAX_SEEDS_PER_RUN);
      const selected = [...primeAreas, ...batch];
      scanSeeds = selected.map((a) => ({
        label: a.label,
        postcode: a.seedPostcode,
        radiusMiles: a.radiusMiles,
        // Prime seeds scan a wider distress-list set (chain-free, cash-only,
        // poor-EPC) — the executor/stuck-owner/needs-work signals the prime
        // book hunts. See runScoutingPipeline's PRIME_SEED_LISTS.
        isPrime: a.isPrime,
      }));
      selectedAreaIds = selected.map((a) => a.id);
      // The founder's prime geography, from ALL prime-marked areas (not just
      // this run's batch): the classifier honours it as an extension of the
      // built-in district list. An explicit founder choice never loses to a
      // hard-coded default.
      primeDistricts = primeAreas
        .map((a) => a.district)
        .filter((d): d is string => typeof d === 'string');
      // Deliberately DO NOT pass bare districts as sourcedPropertyPostcodes —
      // PropertyData rejects districts on /sourced-properties yet they still
      // incur the expensive serial sleep loops. Companies-House district
      // filtering is derived from the full-postcode seeds inside the pipeline.
      sourcedPropertyPostcodes = [];
    }
  } catch (err) {
    console.warn('[cron/scouting] failed to read scouting.areas', err);
  }

  // ── Legacy fallback ─────────────────────────────────────────────────
  // If scouting.areas is empty, fall back to the old keys so existing
  // configs keep working through the migration window.
  if (scanSeeds.length === 0 && sourcedPropertyPostcodes.length === 0) {
    try {
      const districtsRow = await database.setting.findUnique({
        where: { key: 'scouting.targetPostcodes' },
      });
      if (districtsRow && Array.isArray(districtsRow.value)) {
        sourcedPropertyPostcodes = (districtsRow.value as unknown[]).filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0
        );
      }
      const seedsRow = await database.setting.findUnique({
        where: { key: 'scouting.scanSeeds' },
      });
      if (seedsRow && Array.isArray(seedsRow.value)) {
        scanSeeds = (seedsRow.value as unknown[]).flatMap((raw) => {
          if (!raw || typeof raw !== 'object') return [];
          const s = raw as Record<string, unknown>;
          const postcode = typeof s.postcode === 'string' ? s.postcode : null;
          const radiusMiles =
            typeof s.radiusMiles === 'number' ? s.radiusMiles : 1;
          const label = typeof s.label === 'string' ? s.label : undefined;
          return postcode ? [{ postcode, radiusMiles, label }] : [];
        });
      }
    } catch (err) {
      console.warn('[cron/scouting] legacy fallback read failed', err);
    }
    if (sourcedPropertyPostcodes.length === 0) {
      sourcedPropertyPostcodes = (env.AGENT_PROSPECTING_POSTCODES ?? '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
    }
    // Bound legacy mode too, so it can never blow the maxDuration budget.
    scanSeeds = scanSeeds.slice(0, MAX_SEEDS_PER_RUN);
    sourcedPropertyPostcodes = sourcedPropertyPostcodes.slice(
      0,
      MAX_SEEDS_PER_RUN
    );
  }

  // ── Load the active lead-scoring config (closes the calibration loop) ──
  // The scorer's weights/thresholds live in the EvalConfig table so they can
  // be tuned without a deploy. We pick the highest active (activatedAt != null)
  // version for evalType 'lead_scoring', merge it over the hard-coded defaults,
  // and stamp the version onto every lead so calibration can attribute scores
  // to the config that produced them. No active config → hard-coded defaults.
  let scorerConfig = mergeScorerConfig(null); // = DEFAULT_SCORER_CONFIG
  let evalConfigVersion: number | null = null;
  try {
    const active = await database.evalConfig.findFirst({
      where: { evalType: 'lead_scoring', activatedAt: { not: null } },
      orderBy: { version: 'desc' },
      select: { version: true, config: true },
    });
    if (active) {
      scorerConfig = mergeScorerConfig(active.config);
      evalConfigVersion = active.version;
    }
  } catch (err) {
    console.warn('[cron/scouting] failed to load active scorer config', err);
  }

  // ── Short-lease scout toggle ─────────────────────────────────────────
  // Surfaces leasehold flats near/under the 80-year marriage-value line as
  // motivated-seller leads (the Milton Court pattern). One PropertyData
  // /freeholds call per scanned postcode (throttled), well inside the budget.
  // On by default; the founder can disable it via the `scouting.scanShortLeases`
  // setting (value: false) if credits get tight.
  let scanShortLeases = true;
  try {
    const row = await database.setting.findUnique({
      where: { key: 'scouting.scanShortLeases' },
    });
    if (row && typeof row.value === 'boolean') {
      scanShortLeases = row.value;
    }
  } catch (err) {
    console.warn('[cron/scouting] failed to read scanShortLeases setting', err);
  }

  const result = await runScoutingPipeline({
    limit: 30,
    primeDistricts,
    // `minScore: 30` removed: it compared a pre-appraisal total that can never
    // include the 40-point ROI pillar against a post-appraisal band, so it
    // gated on whether HMLR had price-paid data. The pipeline now uses
    // scorerConfig.sourcingThreshold (EvalConfig-tunable, no deploy).
    sourcedPropertyPostcodes,
    scanSeeds,
    scorerConfig,
    evalConfigVersion,
    // Reuse the scanned-area postcodes to look for short leases.
    scanShortLeases,
    // Skip the slow, low-yield planning / HMO / dissolved-company sources.
    // Their mandatory rate-limit sleeps (~80–120s) were pushing the run past
    // the function budget so persist + founder-surfacing never ran. Every
    // qualified lead to date came from sourced-properties anyway.
    skipSlowSources: true,
    // Hard stop for paid enrichment — the pipeline must RETURN in time to
    // persist. See PIPELINE_BUDGET_MS above.
    deadlineMs: startedAtMs + PIPELINE_BUDGET_MS,
  });

  if (result.truncatedByDeadline.length > 0) {
    console.warn(
      `[cron/scouting] run truncated by deadline (skipped: ${result.truncatedByDeadline.join(', ')}) — leads persisted below as normal`
    );
  }

  // ── Dealbreaker screen (founder's recorded hard NOs) ─────────────────
  // Rules mined from feedback notes/voice notes (overrides._insights
  // .dealbreakers) are enforced here, before persistence — the same pattern
  // as the land/garage/SSTC screens, but learned from the founder's own
  // judgement. Violators are parked as 'passed' with the rule + evidence
  // recorded (visible in the Passed tab, reversible), so they never draw
  // appraisal spend. Best-effort: any failure means no leads are flagged.
  const dealbreakerFlags = new Map<number, { rule: string; reason: string }>();
  try {
    const recentFeedback = await database.founderFeedback.findMany({
      where: {
        targetType: 'scout_lead',
        createdAt: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { overrides: true },
    });
    const rules = dedupeDealbreakerRules(
      recentFeedback.flatMap((f) => {
        const insights = (f.overrides as Record<string, unknown> | null)
          ?._insights as { dealbreakers?: unknown } | undefined;
        return Array.isArray(insights?.dealbreakers)
          ? insights.dealbreakers.filter(
              (d): d is string => typeof d === 'string'
            )
          : [];
      })
    );
    if (rules.length > 0) {
      // Only screen leads worth money downstream — the ones the appraisal
      // crons will pick up.
      const candidates = result.leads
        .map((lead, index) => ({ lead, index }))
        .filter(
          ({ lead }) => lead.verdict === 'STRONG' || lead.verdict === 'VIABLE'
        );
      const hits = await screenDealbreakers(
        rules,
        candidates.map(({ lead, index }) => {
          const pd = (lead.rawPayload?.propertyData ?? {}) as Record<
            string,
            unknown
          >;
          return {
            ref: String(index),
            address: lead.address,
            summary: typeof pd.summary === 'string' ? pd.summary : null,
            propertyType:
              typeof pd.propertyType === 'string' ? pd.propertyType : null,
            listingType:
              typeof pd.listingType === 'string' ? pd.listingType : null,
          };
        })
      );
      for (const [ref, hit] of hits) {
        dealbreakerFlags.set(Number(ref), {
          rule: hit.rule,
          reason: hit.reason,
        });
      }
    }
  } catch (err) {
    console.warn('[cron/scouting] dealbreaker screen failed', err);
  }

  // ── Persist leads FIRST (cheap, durable) ─────────────────────────────
  // Snapshot enrichment is slow (~27s/postcode) and previously ran BEFORE
  // the write — so a 300s timeout during enrichment lost the entire run.
  // We now persist immediately (a few ms), then enrich in a second pass
  // where each lead is updated individually. A timeout now only costs
  // un-enriched snapshots; the leads themselves are already safe.
  let createdCount = 0;
  if (result.leads.length > 0) {
    const written = await database.scoutLead.createMany({
      data: result.leads.map((lead, index) => {
        const flag = dealbreakerFlags.get(index);
        const rawPayload = flag
          ? { ...(lead.rawPayload ?? {}), dealbreaker: flag }
          : lead.rawPayload;
        return {
          ...lead,
          // Park dealbreaker violators on arrival — no appraisal spend.
          status: flag ? 'passed' : lead.status,
          rawPayload:
            rawPayload === null
              ? Prisma.JsonNull
              : (rawPayload as Prisma.InputJsonValue),
        };
      }),
      skipDuplicates: true,
    });
    createdCount = written.count;
  }

  // ── Feed the entity graph (best-effort, read-only overlay) ───────────
  // Company-flavoured sources (receiverships, CH charges/insolvency) carry
  // deterministic company numbers — record company↔property↔lender edges so
  // the lead detail page's Connections panel can surface cross-source links
  // the address-only dedup can't see. A failure here (including the graph
  // tables not yet existing) never affects the leads persisted above.
  let graphWrites = 0;
  for (const lead of result.leads) {
    const raw = (lead.rawPayload ?? {}) as Record<string, unknown>;
    const signal = (raw.receivershipSignal ??
      raw.chargeSignal ??
      raw.insolvencySignal) as
      | {
          companyNumber?: string | null;
          companyName?: string | null;
          lender?: string | null;
          noticeId?: string | null;
          chargeRef?: string | null;
        }
      | undefined;
    if (!signal?.companyNumber) continue;
    try {
      await recordChargeObservation({
        companyNumber: signal.companyNumber,
        companyName: signal.companyName ?? signal.companyNumber,
        address: lead.address,
        postcode: lead.postcode,
        lender: signal.lender ?? null,
        kind:
          raw.insolvencySignal || raw.receivershipSignal
            ? 'insolvency'
            : 'charge_over',
        sourceRef: `scout:${signal.noticeId ?? signal.chargeRef ?? lead.address}`,
        sourceTrail: lead.sourceTrail ?? lead.source,
        observedAt: result.runDate,
      });
      graphWrites++;
    } catch (err) {
      console.warn('[cron/scouting] graph write failed', err);
      break; // tables likely absent — don't warn once per lead
    }
  }

  // ── Advance area rotation + write back what the run learned ─────────
  // Because we select oldest-probed-first, stamping checkedAt pushes scanned
  // areas to the back of the queue — full coverage over
  // ~ceil(areaCount / MAX_SEEDS_PER_RUN) days. The merge also writes each
  // area's listing count and error truthfully (see merge-area-probes.ts).
  // Best-effort: a failure here never affects the leads persisted above.
  if (areasRaw && selectedAreaIds.length > 0) {
    try {
      const nowIso = result.runDate.toISOString();
      // Full truth, not just a timestamp: counts written, errors set on
      // failure and CLEARED on success. The old checkedAt-only merge let a
      // stale error survive forever under an ever-fresh timestamp.
      const updatedAreas = mergeAreaProbes(
        areasRaw,
        selectedAreaIds,
        result.seedOutcomes,
        nowIso
      );
      await database.setting.update({
        where: { key: 'scouting.areas' },
        data: { value: updatedAreas as Prisma.InputJsonValue },
      });
    } catch (err) {
      console.warn('[cron/scouting] failed to advance area rotation', err);
    }
  }

  // NOTE: the slow snapshot-enrichment second pass used to run HERE, before
  // the founder surfacing below. With ~27s/postcode it routinely blew the
  // function's time budget, so the run was killed BEFORE the AgentEvent +
  // review FounderAction were created — leads landed in the DB but the
  // founders never got a daily "review N leads" action. Enrichment is now
  // deferred to the very end of the handler (best-effort): founder surfacing
  // is cheap and load-bearing, so it must happen first.

  // Surface what was found so the Today page knows.
  const highScoreLeads = result.leads.filter((l) => l.leadScore >= 70);
  const strongLeads = result.leads.filter((l) => l.verdict === 'STRONG');
  // qualified = cleared the scorer; persisted = actually NEW rows. The gap is
  // listings we had already sourced, dropped by `skipDuplicates` above. Both
  // numbers go everywhere from here on — "30 qualified" means nothing to the
  // founder if all 30 were duplicates.
  const duplicatesSkipped = Math.max(0, result.leads.length - createdCount);
  const summaryText = `Daily scout cron found ${result.leads.length} leads (${strongLeads.length} STRONG, ${highScoreLeads.length} scored 70+) — ${createdCount} new, ${duplicatesSkipped} already known`;

  // AgentEvent for the run (informational; agent is the system cron itself).
  let eventId: string | undefined;
  try {
    const event = await database.agentEvent.create({
      data: {
        agent: 'system',
        eventType: 'leads_created',
        summary: summaryText,
        count: result.leads.length,
        payload: {
          source: 'cron_scouting',
          fetched: result.fetched,
          enriched: result.enriched,
          total: result.leads.length,
          strong: strongLeads.length,
          highScore: highScoreLeads.length,
          // New-lead flow for this run. `total` alone can't answer "when did
          // new stock dry up?" — a run that re-finds 30 known listings looks
          // identical to one that finds 30 fresh ones. Persisting both makes
          // the drought trendable, and lets the dry-streak check below read
          // its own history back off this log instead of new state.
          persisted: createdCount,
          duplicatesSkipped,
          gdprFieldsStripped: result.gdprStripped.length,
          // Contact-enrichment health for this run — tier split + hit-rate.
          // Persisted per run so a falling hit-rate (the early sign that an
          // enrichment API has silently broken) is trendable over time.
          enrichment: result.enrichment,
          // Discovery-source health, persisted per run for the same reason:
          // "when did this source go dark?" should be answerable from the
          // event log rather than from whoever still has the Vercel logs open.
          sourceHealth: (result.sourceHealth ?? []).map((h) => ({
            key: h.key,
            status: h.status,
            count: h.count,
            detail: h.detail ?? null,
          })),
          // How much of the pool the per-run cap discarded. A large number
          // here means the scan is finding far more than it can appraise.
          candidatePool: result.sources.candidatePool,
          droppedByCap: result.sources.droppedByCap,
          // Prime/block capture candidates shortlisted OUTSIDE the volume
          // limit — trendable evidence the capture door is actually firing.
          primeGuaranteed: result.sources.primeGuaranteed,
          // Entity-graph edges recorded this run (overlay trial telemetry).
          graphWrites,
        },
      },
    });
    eventId = event.id;
  } catch (err) {
    console.warn('[cron/scouting] agent-event create failed', err);
  }

  // High-scoring leads create TWO actions:
  //   1) review_leads for the board (founder triage)
  //   2) dispatch_campaign for Paperclip Marketer (draft outreach)
  //
  // The metadata.assignedToAgent field signals which Paperclip agent should
  // pick up the action on its next heartbeat. The board sees both in
  // /actions; Marketer's polling query filters to its own.
  // Founders must see EVERY qualified lead daily — not only the 70+ ones.
  // A lead that clears the pipeline's minScore (THIN+) is worth a founder
  // glance to decide invest / pass / refer. We therefore create the review
  // action whenever any qualified lead lands, and embed each lead's score +
  // verdict in the sample so triage is instant. The marketer-outreach draft
  // (costly, sensitive) stays gated to high-scoring leads only.
  if (result.leads.length > 0) {
    const reviewSample = result.leads
      .map(
        (l, i) =>
          `${i}:${l.address.slice(0, 40)}, ${l.postcode} — ${l.leadScore}/${l.verdict}`
      )
      .slice(0, 10);
    const highLeadIds = highScoreLeads
      .map((l, i) => `${i}:${l.address.slice(0, 40)}, ${l.postcode}`)
      .slice(0, 10);
    try {
      // Founder-facing review action — ONE persistent card, refreshed each
      // run. The card's lead list is rendered live, so yesterday's copy of
      // the same card is pure noise; a stack of eight of them was the
      // founder's top Action Centre complaint.
      // Nothing new to review is not a "high priority" card no matter how
      // strong the (already-triaged) leads are — the founder has seen them.
      const reviewPriority =
        createdCount === 0
          ? 'low'
          : highScoreLeads.length >= 5 || strongLeads.length > 0
            ? 'high'
            : highScoreLeads.length > 0
              ? 'medium'
              : 'low';
      // Copy leads with NEW, not with the qualified count — see
      // ../_lib/scout-freshness.ts for why the old wording was misleading.
      const reviewCopy = buildReviewActionCopy({
        qualified: result.leads.length,
        persisted: createdCount,
        strong: strongLeads.length,
        highScore: highScoreLeads.length,
      });
      const reviewData = {
        priority: reviewPriority,
        status: 'pending',
        title: reviewCopy.title,
        description: reviewCopy.description,
        metadata: {
          source: 'cron_scouting',
          assignedToAgent: 'board',
          leadCount: result.leads.length,
          newLeadCount: createdCount,
          // Non-empty when the run hit its time budget and skipped some paid
          // enrichment — the leads are real, some just carry fewer factors.
          truncatedByDeadline: result.truncatedByDeadline,
          duplicatesSkipped,
          highScoreCount: highScoreLeads.length,
          strongCount: strongLeads.length,
          runDate: result.runDate.toISOString(),
          link: '/pipeline?tab=leads',
          leadSample: reviewSample,
        },
        resolvedAt: null,
        resolvedBy: null,
        // Dies on its own if not acted on before the leads go stale.
        expiresAt: new Date(Date.now() + 48 * 3600_000),
      } as const;
      await database.founderAction.upsert({
        where: { dedupKey: 'scout-review-leads' },
        create: {
          type: 'review_leads',
          agent: 'system',
          agentEventId: eventId,
          dedupKey: 'scout-review-leads',
          ...reviewData,
        },
        update: { agentEventId: eventId, ...reviewData },
      });

      // Prime/block surfacing — the second business line. These leads bypass
      // the volume gate (a human decides, not the threshold), so they get
      // their own high-priority card rather than drowning in the daily
      // review pile. Deduped per calendar day: one card, refreshed per run.
      const primeLeads = result.leads.filter((l) => l.track !== 'volume');
      if (primeLeads.length > 0) {
        const blockCount = primeLeads.filter((l) => l.track === 'block').length;
        const primeCount = primeLeads.length - blockCount;
        const dayBucket = result.runDate.toISOString().slice(0, 10);
        const sample = primeLeads
          .slice(0, 3)
          .map((l) => `${l.address} (${l.track})`)
          .join(' | ');
        const primeData = {
          priority: 'high',
          status: 'pending',
          title: `${primeLeads.length} prime/block lead${primeLeads.length === 1 ? '' : 's'} found — own-book candidates`,
          description: `Scout surfaced ${primeCount} prime (£700k+ value, or priced-under-a-prime-street) and ${blockCount} block/portfolio lead${blockCount === 1 ? '' : 's'} today. These are principal-track candidates for the Kept book (architect refurb / multi-unit), not the investor feed — the volume scorer does not gate them, so read each one. ${sample}`,
          metadata: {
            source: 'cron_scouting',
            track: 'prime_block',
            primeCount,
            blockCount,
            runDate: result.runDate.toISOString(),
            link: '/pipeline?tab=leads',
          },
          resolvedAt: null,
          resolvedBy: null,
          expiresAt: new Date(Date.now() + 72 * 3600_000),
        } as const;
        await database.founderAction.upsert({
          where: { dedupKey: `scout-prime-leads:${dayBucket}` },
          create: {
            type: 'review_leads',
            agent: 'scout',
            agentEventId: eventId,
            dedupKey: `scout-prime-leads:${dayBucket}`,
            ...primeData,
          },
          update: { agentEventId: eventId, ...primeData },
        });
      }

      // Marketer-facing draft action — high-scoring leads only (outreach is
      // costly + sensitive; we don't draft for borderline leads).
      if (highScoreLeads.length > 0) {
        await database.founderAction.create({
          data: {
            type: 'dispatch_campaign',
            priority: 'medium',
            status: 'pending',
            agent: 'marketer',
            agentEventId: eventId,
            title: `Draft outreach for ${highScoreLeads.length} new high-scoring lead${highScoreLeads.length === 1 ? '' : 's'}`,
            description: `Scout cron found ${highScoreLeads.length} leads scored ≥ 70 (${strongLeads.length} STRONG). For each, draft a first-touch email to the executor/contact tailored to the lead type (probate / chain break / repos / problem property). Hold all drafts for board approval. Top examples: ${highLeadIds.slice(0, 3).join(' | ')}.`,
            metadata: {
              source: 'cron_scouting',
              assignedToAgent: 'marketer',
              workflow: 'draft_outreach_for_new_leads',
              leadCount: highScoreLeads.length,
              strongCount: strongLeads.length,
              runDate: result.runDate.toISOString(),
              link: '/pipeline?tab=leads',
            },
          },
        });
      }
    } catch (err) {
      console.warn('[cron/scouting] founder-action create failed', err);
    }
  }

  // ── Surface source failures so silent degradation can't hide ──────────
  // The pipeline gracefully returns partial results when a source errors, so a
  // dead feed is invisible unless someone reads the response JSON. One deduped
  // founder action carries the current state, refreshed by each run.
  //
  // The older version of this block only saw sources that THREW, which missed
  // the two failure modes that actually bit us:
  //
  //   1. A source whose fetcher swallows its own error and returns `[]`
  //      (HMCTS does exactly this when its API key is unset) never appears in
  //      `sourceErrors`, so it could never raise an alert.
  //   2. Volume hid the damage. Priority was only `high` when zero leads
  //      landed — but PropertyData alone kept filling the per-run cap, so four
  //      dark sources still produced a full batch and a merely-`medium` card.
  //      The leads were real listings carrying none of the distress signal the
  //      sourcing thesis depends on.
  //
  // We now alert off `sourceHealth`, which covers unset keys and skipped
  // sources too, and escalate on how much of the funnel is dark rather than on
  // whether the batch looked full.
  const health = result.sourceHealth ?? [];
  const healthSummary = summariseSourceHealth(health);
  const faulted = health.filter(
    (h) => h.status === 'error' || h.status === 'not_configured'
  );
  const coreFaulted = faulted.filter((h) => h.core);

  if (faulted.length > 0) {
    try {
      // ONE card, stable key: while sources keep failing, each run refreshes
      // the same card (reopening it if it was completed). No per-day stacking.
      const dedupKey = 'scouting-source-error';
      const title = `Scouting degraded — ${healthSummary.headline}`;

      // Lead with the consequence, not the stack trace. "4 sources failing" is
      // a fact; "today's leads carry no distress signal" is the decision.
      const consequence = healthSummary.allCoreDark
        ? 'No distressed-seller source is live. Any leads this run are ordinary listings, not motivated sellers.'
        : coreFaulted.length > 0
          ? `${coreFaulted.length} of ${healthSummary.coreTotal} core distress sources are down, so lead quality is degraded even when volume looks normal.`
          : 'Optional sources only — core distress sources are still live.';

      const fixLine = healthSummary.missingKeys.length
        ? `\n\nTo fix, set on the bellwood-api Vercel project: ${healthSummary.missingKeys.join(', ')}`
        : '';

      const description = `${consequence}\n\nLeads this run: ${result.leads.length}.\n\n${healthSummary.lines.join('\n')}${fixLine}`;

      // Escalate on how dark the funnel is — NOT on whether leads landed.
      const priority =
        healthSummary.allCoreDark ||
        result.leads.length === 0 ||
        coreFaulted.length > 0
          ? 'high'
          : 'medium';

      const metadata = {
        source: 'cron_scouting',
        headline: healthSummary.headline,
        coreLive: healthSummary.coreLive,
        coreTotal: healthSummary.coreTotal,
        missingKeys: healthSummary.missingKeys,
        sourceHealth: health.map((h) => ({
          key: h.key,
          status: h.status,
          count: h.count,
          detail: h.detail ?? null,
          core: h.core,
        })),
        leadsThisRun: result.leads.length,
      };

      await database.founderAction.upsert({
        where: { dedupKey },
        create: {
          type: 'general',
          priority,
          status: 'pending',
          agent: 'system',
          dedupKey,
          title,
          description,
          metadata,
        },
        update: {
          status: 'pending',
          priority,
          title,
          description,
          resolvedAt: null,
          resolvedBy: null,
          metadata,
        },
      });
    } catch {
      // Non-fatal for alerting.
    }
  } else {
    // All sources healthy — auto-complete any open source-failure cards
    // (stable key + legacy day-bucketed keys). Founders should only see
    // alerts that are CURRENTLY true.
    await database.founderAction
      .updateMany({
        where: {
          dedupKey: { startsWith: 'scouting-source-error' },
          status: { in: ['pending', 'in_progress'] },
        },
        data: { status: 'completed', resolvedAt: new Date() },
      })
      .catch(() => undefined);
  }

  // ── Surface the "scout is spinning" state ────────────────────────────
  // A run can qualify 30 leads and persist NONE of them: `skipDuplicates` drops
  // every listing we already sourced. Nothing about that run looks wrong — the
  // response says `qualified: 30`, the heartbeat is green, sources are healthy —
  // yet the founder gets nothing new. That is the state behind "how come the
  // scout isn't finding any properties?".
  //
  // One dry run is NORMAL (the rotation re-scans areas probed days ago), so we
  // alert on a STREAK instead: enough consecutive dry runs to cover a full
  // sweep of every scan area with zero new stock. That sweep length depends on
  // how many areas the founder currently has configured, so the threshold is
  // computed per run from the live count — see dryStreakThreshold(). The streak
  // itself is read back off the AgentEvent log written above rather than kept
  // in its own Setting row — one source of truth, and it stays correct if a run
  // is replayed or skipped. Same shape as the source-error card: ONE stable
  // dedupKey, upserted while true, auto-completed the moment it isn't.
  //
  // Placed here (with the other founder surfacing, before the heartbeat and
  // the slow enrichment pass) so a timeout in enrichment can never swallow it.
  try {
    const streakThreshold = dryStreakThreshold(
      rotationAreaCount,
      MAX_SEEDS_PER_RUN
    );
    const thisRun: ScoutRunStats = {
      qualified: result.leads.length,
      persisted: createdCount,
    };
    // Prior runs, newest first. Over-fetch a little and filter in JS so events
    // from any other writer of `leads_created` can't pollute the streak. Both
    // the fetch and the slice follow the threshold, so a longer sweep pulls
    // proportionally more history instead of silently under-fetching.
    const priorEvents = await database.agentEvent.findMany({
      where: {
        agent: 'system',
        eventType: 'leads_created',
        ...(eventId ? { id: { not: eventId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: streakThreshold * 2,
      select: { payload: true },
    });
    const priorRuns: ScoutRunStats[] = priorEvents
      .map((e) => (e.payload ?? {}) as Record<string, unknown>)
      .filter((p) => p.source === 'cron_scouting')
      .map((p) =>
        // Events written before `persisted` existed can't prove a dry run —
        // score them as a non-dry run so an old log can't fabricate a streak.
        typeof p.persisted === 'number' && typeof p.total === 'number'
          ? { qualified: p.total, persisted: p.persisted }
          : { qualified: 0, persisted: 0 }
      )
      .slice(0, streakThreshold - 1);

    const dryStreak = countDryStreak([thisRun, ...priorRuns]);
    const dedupKey = 'scout-no-new-leads';

    if (shouldAlertDryStreak(dryStreak, streakThreshold)) {
      const copy = buildDryStreakActionCopy({
        streak: dryStreak,
        qualified: result.leads.length,
      });
      const metadata = {
        source: 'cron_scouting',
        dryStreak,
        // Why it fired: the sweep maths that produced the threshold.
        streakThreshold,
        areaCount: rotationAreaCount,
        seedsPerRun: MAX_SEEDS_PER_RUN,
        qualified: result.leads.length,
        persisted: createdCount,
        duplicatesSkipped,
        runDate: result.runDate.toISOString(),
        link: '/settings/scouting',
      };
      await database.founderAction.upsert({
        where: { dedupKey },
        create: {
          type: 'general',
          priority: 'high',
          status: 'pending',
          agent: 'system',
          agentEventId: eventId,
          dedupKey,
          title: copy.title,
          description: copy.description,
          metadata,
        },
        // Refresh (and reopen) the SAME card each run — never stack one per day.
        update: {
          status: 'pending',
          priority: 'high',
          agentEventId: eventId,
          title: copy.title,
          description: copy.description,
          resolvedAt: null,
          resolvedBy: null,
          metadata,
        },
      });
    } else if (createdCount > 0) {
      // New stock is flowing again — close the card ourselves so the founder
      // only ever sees alerts that are currently true. A dry run that hasn't
      // yet reached the streak threshold deliberately does neither: it must
      // not raise the alarm, and it must not claim the drought is over.
      await database.founderAction.updateMany({
        where: { dedupKey, status: { in: ['pending', 'in_progress'] } },
        data: { status: 'completed', resolvedAt: new Date() },
      });
    }
  } catch (err) {
    console.warn('[cron/scouting] dry-run streak check failed', err);
  }

  // ── Heartbeat BEFORE the slow enrichment loop ───────────────────────
  // The cron's essential job — fetch → persist → surface leads — is complete
  // at this point. The snapshot-enrichment loop below can take ~27s/postcode
  // and sometimes exceeds the 300s function limit. If the heartbeat lived after
  // it (as it used to), a timeout there would suppress the heartbeat and the
  // watchdog would false-alarm "scouting has gone silent" even though leads
  // were created and surfaced. Record liveness against the CORE work here, so
  // the heartbeat reflects what the cron actually delivered, not the optional
  // best-effort enrichment.
  await recordCronHeartbeat('scouting', {
    note: `${createdCount} persisted, ${result.leads.length} qualified`,
  });

  // ── Best-effort: enrich top persisted leads with property snapshot ──
  // Runs AFTER the heartbeat on purpose: founder surfacing + liveness are both
  // already recorded, so a timeout here only costs un-enriched snapshots — never
  // the daily review action or the heartbeat. Top-8 by score, deduped by
  // postcode; each update commits independently so partial progress survives a kill.
  const topToEnrich = [...result.leads]
    .sort((a, b) => b.leadScore - a.leadScore)
    .slice(0, 8);
  const snapshotsByPostcode = new Map<
    string,
    Awaited<ReturnType<typeof getPropertySnapshot>>
  >();
  let enrichedCount = 0;
  let degradedSnapshots = 0;
  for (const lead of topToEnrich) {
    try {
      // createMany doesn't return ids — look the persisted row up by its
      // unique key. Skips cleanly if the lead was a dedup no-op miss.
      const row = await database.scoutLead.findUnique({
        where: {
          address_postcode: { address: lead.address, postcode: lead.postcode },
        },
      });
      if (!row) continue;
      const existingRaw = (row.rawPayload ?? {}) as Record<string, unknown>;
      if (existingRaw.snapshot) {
        enrichedCount++;
        continue; // already enriched on a prior run — don't re-spend credits
      }

      let snap = snapshotsByPostcode.get(lead.postcode);
      if (!snap) {
        const pd = (
          lead.rawPayload as { propertyData?: Record<string, unknown> } | null
        )?.propertyData;
        const rawType = pd?.propertyType as string | undefined;
        const propertyType:
          | 'detached'
          | 'semi-detached'
          | 'terraced'
          | 'flat'
          | 'bungalow'
          | undefined = rawType?.toLowerCase().includes('semi')
          ? 'semi-detached'
          : rawType?.toLowerCase().includes('detached')
            ? 'detached'
            : rawType?.toLowerCase().includes('terrac')
              ? 'terraced'
              : rawType?.toLowerCase().includes('flat') ||
                  rawType?.toLowerCase().includes('apart')
                ? 'flat'
                : rawType?.toLowerCase().includes('bungalow')
                  ? 'bungalow'
                  : undefined;
        const bedrooms =
          typeof pd?.bedrooms === 'number'
            ? (pd.bedrooms as number)
            : undefined;
        snap = await getPropertySnapshot({
          postcode: lead.postcode,
          address: lead.address,
          propertyType,
          bedrooms,
        });
        snapshotsByPostcode.set(lead.postcode, snap);
        // A snapshot is persisted even when its sources failed, and the 7-day
        // freshness guard then treats it as valid — so a snapshot full of nulls
        // from a 429 storm would go unre-fetched for a week. Surface it.
        if (snap.degraded) {
          degradedSnapshots++;
          console.warn(
            `[cron/scouting] snapshot for ${lead.postcode} is degraded — ${Object.keys(snap.errors).join(', ')} unavailable`
          );
        }
      }

      await database.scoutLead.update({
        where: { id: row.id },
        data: {
          rawPayload: {
            ...existingRaw,
            snapshot: snap,
          } as Prisma.InputJsonValue,
        },
      });
      enrichedCount++;
    } catch (err) {
      console.warn(
        '[cron/scouting] snapshot enrichment failed',
        lead.postcode,
        err
      );
    }
  }

  // Auto-appraise right after scouting: kick the appraiser as a follow-up so
  // fresh leads get their AVM / BMV / ROI (and stop looking uniformly mediocre
  // in the sourcing-only state) without waiting for the scheduled appraise cron.
  // Runs AFTER the response is sent (Next `after`), on a separate invocation, so
  // it never delays or fails the scout run that already completed above.
  after(async () => {
    try {
      // Server-controlled origin: this request carries CRON_SECRET, and
      // request.url is derived from the Host header.
      await fetch(`${selfOrigin()}/cron/lead-appraise`, {
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      });
    } catch (err) {
      console.warn('[cron/scouting] auto-appraise trigger failed', err);
    }
  });

  return NextResponse.json({
    success: true,
    runDate: result.runDate.toISOString(),
    fetched: result.fetched,
    enriched: result.enriched,
    qualified: result.leads.length,
    persisted: createdCount,
    duplicatesSkipped,
    dealbreakersParked: dealbreakerFlags.size,
    snapshotsEnriched: enrichedCount,
    snapshotsDegraded: degradedSnapshots,
    evalConfigVersion,
    highScoreLeads: highScoreLeads.length,
    strongLeads: strongLeads.length,
    summary: result.summary,
    gdprFieldsStripped: result.gdprStripped.length,
    sources: result.sources,
    sourceErrors: result.sourceErrors,
    sourceHealth: result.sourceHealth,
    truncatedByDeadline: result.truncatedByDeadline,
    sourceHealthHeadline: healthSummary.headline,
  });
};

// Vercel cron sends GET by default. Accept either method so a manual
// POST and an automated GET both reach the same handler.
export const GET = POST;

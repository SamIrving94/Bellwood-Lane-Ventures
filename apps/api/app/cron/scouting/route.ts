import { env } from '@/env';
import { database, Prisma } from '@repo/database';
import {
  dedupeDealbreakerRules,
  mergeScorerConfig,
  runScoutingPipeline,
  screenDealbreakers,
} from '@repo/scouting';
import { getPropertySnapshot } from '@repo/property-data/src/propertydata';
import { NextResponse, after } from 'next/server';
import { recordCronHeartbeat } from '../_lib/heartbeat';

// Snapshot enrichment is slow (~27s per unique postcode). Allow more time
// than the default 60s — bumps to Vercel Pro plan cap.
export const maxDuration = 800;

/**
 * Daily scouting pipeline — runs at 7am.
 * Fetches probate / chain-break / repos leads, enriches, scores, persists.
 *
 * Mirrors the FounderAction creation in /agents/leads so the founder
 * dashboard's Today page surfaces high-scoring leads regardless of
 * whether scouting ran via this cron or via Paperclip's API push.
 */
export const POST = async (request: Request) => {
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
  // through the whole list over a few days.
  const MAX_SEEDS_PER_RUN = 6;

  type ScanSeed = { label?: string; postcode: string; radiusMiles: number };
  let scanSeeds: ScanSeed[] = [];
  let sourcedPropertyPostcodes: string[] = [];
  // Raw area objects + the ids we scanned this run — used to advance rotation.
  let areasRaw: Record<string, unknown>[] | null = null;
  let selectedAreaIds: string[] = [];

  try {
    const areasSetting = await database.setting.findUnique({
      where: { key: 'scouting.areas' },
    });
    if (areasSetting && Array.isArray(areasSetting.value)) {
      areasRaw = (areasSetting.value as unknown[]).filter(
        (r): r is Record<string, unknown> => !!r && typeof r === 'object',
      );
      const areas = areasRaw.flatMap((a) => {
        const seedPostcode =
          typeof a.seedPostcode === 'string' ? a.seedPostcode : null;
        const radiusMiles =
          typeof a.radiusMiles === 'number' ? a.radiusMiles : 1.5;
        const label = typeof a.label === 'string' ? a.label : undefined;
        const id =
          typeof a.id === 'string' ? a.id : (seedPostcode ?? `${label}`);
        // never-probed → 0 so it sorts to the FRONT of the rotation queue.
        const lp = a.lastProbe as { checkedAt?: unknown } | null | undefined;
        const lastProbeAt =
          lp && typeof lp.checkedAt === 'string'
            ? (Number.isFinite(Date.parse(lp.checkedAt))
                ? Date.parse(lp.checkedAt)
                : 0)
            : 0;
        if (!seedPostcode) return [];
        return [{ id, seedPostcode, radiusMiles, label, lastProbeAt }];
      });
      // Oldest-probed (and never-probed) first; bounded batch per run.
      areas.sort((a, b) => a.lastProbeAt - b.lastProbeAt);
      const batch = areas.slice(0, MAX_SEEDS_PER_RUN);
      scanSeeds = batch.map((a) => ({
        label: a.label,
        postcode: a.seedPostcode,
        radiusMiles: a.radiusMiles,
      }));
      selectedAreaIds = batch.map((a) => a.id);
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
          (v): v is string => typeof v === 'string' && v.trim().length > 0,
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
      MAX_SEEDS_PER_RUN,
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
    minScore: 30,
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
  });

  // ── Dealbreaker screen (founder's recorded hard NOs) ─────────────────
  // Rules mined from feedback notes/voice notes (overrides._insights
  // .dealbreakers) are enforced here, before persistence — the same pattern
  // as the land/garage/SSTC screens, but learned from the founder's own
  // judgement. Violators are parked as 'passed' with the rule + evidence
  // recorded (visible in the Passed tab, reversible), so they never draw
  // appraisal spend. Best-effort: any failure means no leads are flagged.
  const dealbreakerFlags = new Map<
    number,
    { rule: string; reason: string }
  >();
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
          ? insights.dealbreakers.filter((d): d is string => typeof d === 'string')
          : [];
      }),
    );
    if (rules.length > 0) {
      // Only screen leads worth money downstream — the ones the appraisal
      // crons will pick up.
      const candidates = result.leads
        .map((lead, index) => ({ lead, index }))
        .filter(({ lead }) => lead.verdict === 'STRONG' || lead.verdict === 'VIABLE');
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
        }),
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

  // ── Advance area rotation ───────────────────────────────────────────
  // Stamp lastProbe.checkedAt on the areas we scanned this run. Because we
  // select oldest-probed-first, stamping now pushes them to the back of the
  // queue so the next run picks up the following batch — full coverage over
  // ~ceil(areaCount / MAX_SEEDS_PER_RUN) days. Best-effort: a failure here
  // never affects the leads already persisted above.
  if (areasRaw && selectedAreaIds.length > 0) {
    try {
      const nowIso = result.runDate.toISOString();
      const updatedAreas = areasRaw.map((a) => {
        const id =
          typeof a.id === 'string'
            ? a.id
            : typeof a.seedPostcode === 'string'
              ? a.seedPostcode
              : null;
        if (!id || !selectedAreaIds.includes(id)) return a;
        const prevLp =
          a.lastProbe && typeof a.lastProbe === 'object'
            ? (a.lastProbe as Record<string, unknown>)
            : {};
        return { ...a, lastProbe: { ...prevLp, checkedAt: nowIso } };
      });
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
  const summaryText = `Daily scout cron found ${result.leads.length} leads (${strongLeads.length} STRONG, ${highScoreLeads.length} scored 70+)`;

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
          gdprFieldsStripped: result.gdprStripped.length,
          // Contact-enrichment health for this run — tier split + hit-rate.
          // Persisted per run so a falling hit-rate (the early sign that an
          // enrichment API has silently broken) is trendable over time.
          enrichment: result.enrichment,
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
          `${i}:${l.address.slice(0, 40)}, ${l.postcode} — ${l.leadScore}/${l.verdict}`,
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
      const reviewPriority =
        highScoreLeads.length >= 5 || strongLeads.length > 0
          ? 'high'
          : highScoreLeads.length > 0
            ? 'medium'
            : 'low';
      const reviewData = {
        priority: reviewPriority,
        status: 'pending',
        title: `Review ${result.leads.length} new qualified lead${result.leads.length === 1 ? '' : 's'}${highScoreLeads.length ? ` (${highScoreLeads.length} scored 70+)` : ''}`,
        description: `Daily scout run found ${result.leads.length} qualified leads — ${strongLeads.length} STRONG, ${highScoreLeads.length} scored ≥ 70. Open Pipeline → Leads to review each and decide invest / pass / refer to another investor.`,
        metadata: {
          source: 'cron_scouting',
          assignedToAgent: 'board',
          leadCount: result.leads.length,
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
  // The pipeline gracefully returns partial results when a source errors, but
  // that means a dead feed (e.g. Gazette timing out, PropertyData credits
  // exhausted, enrichment APIs down) is invisible unless someone reads the
  // response JSON. Raise one deduped founder action per day listing the
  // failing sources. Dedup bucket is the UTC day, so a persistently-broken
  // source alerts at most once per day.
  const failingSources = Object.entries(result.sourceErrors ?? {}).filter(
    ([, msg]) => Boolean(msg)
  );
  if (failingSources.length > 0) {
    try {
      // ONE card, stable key: while sources keep failing, each run refreshes
      // the same card (reopening it if it was completed). No per-day stacking.
      const dedupKey = 'scouting-source-error';
      const title = `Scouting source${failingSources.length === 1 ? '' : 's'} failing: ${failingSources.map(([s]) => s).join(', ')}`;
      const description = `The daily scout run completed but ${failingSources.length} source${failingSources.length === 1 ? '' : 's'} errored, so lead volume may be degraded${result.leads.length === 0 ? ' (zero leads found this run)' : ''}:\n\n${failingSources.map(([s, msg]) => `• ${s}: ${msg}`).join('\n')}`;
      const priority = result.leads.length === 0 ? 'high' : 'medium';
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
          metadata: {
            source: 'cron_scouting',
            failingSources: Object.fromEntries(failingSources),
            leadsThisRun: result.leads.length,
          },
        },
        update: {
          status: 'pending',
          priority,
          title,
          description,
          resolvedAt: null,
          resolvedBy: null,
          metadata: {
            source: 'cron_scouting',
            failingSources: Object.fromEntries(failingSources),
            leadsThisRun: result.leads.length,
          },
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
          typeof pd?.bedrooms === 'number' ? (pd.bedrooms as number) : undefined;
        snap = await getPropertySnapshot({
          postcode: lead.postcode,
          address: lead.address,
          propertyType,
          bedrooms,
        });
        snapshotsByPostcode.set(lead.postcode, snap);
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
        err,
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
      const origin = new URL(request.url).origin;
      await fetch(`${origin}/cron/lead-appraise`, {
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
    dealbreakersParked: dealbreakerFlags.size,
    snapshotsEnriched: enrichedCount,
    evalConfigVersion,
    highScoreLeads: highScoreLeads.length,
    strongLeads: strongLeads.length,
    summary: result.summary,
    gdprFieldsStripped: result.gdprStripped.length,
    sources: result.sources,
    sourceErrors: result.sourceErrors,
  });
};

// Vercel cron sends GET by default. Accept either method so a manual
// POST and an automated GET both reach the same handler.
export const GET = POST;

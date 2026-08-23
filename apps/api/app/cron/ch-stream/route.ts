import { env } from '@/env';
import { type Prisma, database } from '@repo/database';
import {
  baseFromProbateLead,
  classifyTrack,
  drainCompaniesHouseStream,
  fetchCompanyCharges,
  fetchCompanyProfile,
  filterToDistricts,
  isPropertyCompany,
  leadTypeForInsolvencyCase,
  mergeScorerConfig,
  minePropertiesFromParticulars,
  parseChargeItem,
  scoreLead,
  toDistrictSet,
} from '@repo/scouting';
import { NextResponse } from 'next/server';
import {
  graphContextForCompany,
  propertyEntityKey,
  recordChargeObservation,
} from '../_lib/entity-graph';
import { recordCronHeartbeat } from '../_lib/heartbeat';

export const maxDuration = 300;

/**
 * Companies House stream drain — every 30 minutes.
 *
 * Cuts detection of fresh charges + insolvency appointments on
 * property-holding companies from ~24h (the daily REST poll) to minutes.
 * See packages/scouting/src/ch-stream.ts for the stream-as-poll design and
 * the Aug 2026 scoping that chose the raw stream over Stratum CH Watch.
 *
 * Division of labour with the daily scouting cron: this route is the FAST
 * path — same lead shape, same scorer, same gate, just sooner. The daily
 * REST poll stays on as the backstop that re-covers any window this cron
 * missed (a 416 backlog restart, a dead run), and `skipDuplicates` on the
 * (address, postcode) key makes double-coverage free.
 *
 * This cron also feeds the entity graph (companies ↔ properties ↔ lenders),
 * the read-only connection overlay trialled per the Aug 2026 review — graph
 * writes are best-effort and can never cost a lead.
 */

/** Bound on companies looked up per run — budget guard, not a target. */
const MAX_COMPANIES_PER_RUN = 40;
/** Per-stream read budget. Two streams must fit maxDuration with headroom. */
const DRAIN_BUDGET_MS = 60_000;

const TIMEPOINT_SETTING_KEY = 'chstream.timepoints';

export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const streamKey = env.CH_STREAM_KEY;
  const restKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!streamKey || !restKey) {
    // Not configured is a valid state (the daily poll still covers the
    // ground) — but say so on the heartbeat, never silently.
    await recordCronHeartbeat('ch-stream', {
      note: 'skipped — CH_STREAM_KEY / COMPANIES_HOUSE_API_KEY not configured',
    });
    return NextResponse.json({
      skipped: true,
      reason: streamKey
        ? 'COMPANIES_HOUSE_API_KEY not configured'
        : 'CH_STREAM_KEY not configured',
    });
  }

  // ── The founder's patch: districts from scouting.areas ────────────────
  // ALL configured areas, not this run's rotation batch — the stream is
  // cheap enough to watch the whole patch continuously, which is the point.
  const districts = new Set<string>();
  const primeDistricts: string[] = [];
  try {
    const areasSetting = await database.setting.findUnique({
      where: { key: 'scouting.areas' },
    });
    if (areasSetting && Array.isArray(areasSetting.value)) {
      for (const raw of areasSetting.value as unknown[]) {
        if (!raw || typeof raw !== 'object') continue;
        const a = raw as Record<string, unknown>;
        if (typeof a.district === 'string' && a.district.trim()) {
          districts.add(a.district.trim().toUpperCase());
          if (a.track === 'prime') primeDistricts.push(a.district);
        }
      }
    }
  } catch (err) {
    console.warn('[cron/ch-stream] failed to read scouting.areas', err);
  }
  if (districts.size === 0) {
    await recordCronHeartbeat('ch-stream', {
      note: 'skipped — no scouting areas configured',
    });
    return NextResponse.json({ skipped: true, reason: 'no areas configured' });
  }
  const founderPrimeDistricts = toDistrictSet(primeDistricts);

  // ── Resume from the stored timepoints ─────────────────────────────────
  let timepoints: { charges: number | null; insolvency: number | null } = {
    charges: null,
    insolvency: null,
  };
  try {
    const row = await database.setting.findUnique({
      where: { key: TIMEPOINT_SETTING_KEY },
    });
    if (row && row.value && typeof row.value === 'object') {
      const v = row.value as Record<string, unknown>;
      timepoints = {
        charges: typeof v.charges === 'number' ? v.charges : null,
        insolvency: typeof v.insolvency === 'number' ? v.insolvency : null,
      };
    }
  } catch (err) {
    console.warn('[cron/ch-stream] failed to read timepoints', err);
  }

  const [chargesDrain, insolvencyDrain] = await Promise.all([
    drainCompaniesHouseStream({
      stream: 'charges',
      streamKey,
      sinceTimepoint: timepoints.charges,
      budgetMs: DRAIN_BUDGET_MS,
    }),
    drainCompaniesHouseStream({
      stream: 'insolvency-cases',
      streamKey,
      sinceTimepoint: timepoints.insolvency,
      budgetMs: DRAIN_BUDGET_MS,
    }),
  ]);

  // ── Scorer config: same active EvalConfig the daily cron uses ─────────
  let scorerConfig = mergeScorerConfig(null);
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
    console.warn('[cron/ch-stream] failed to load scorer config', err);
  }

  // ── Turn events into leads ────────────────────────────────────────────
  // Per-run profile cache: one company can emit several events per drain.
  const profileCache = new Map<
    string,
    Awaited<ReturnType<typeof fetchCompanyProfile>>
  >();
  const profileFor = async (companyNumber: string) => {
    if (!profileCache.has(companyNumber)) {
      if (profileCache.size >= MAX_COMPANIES_PER_RUN) return null;
      try {
        profileCache.set(
          companyNumber,
          await fetchCompanyProfile(companyNumber, restKey)
        );
      } catch (err) {
        console.warn(`[cron/ch-stream] profile ${companyNumber} failed`, err);
        profileCache.set(companyNumber, null);
      }
    }
    return profileCache.get(companyNumber) ?? null;
  };

  type StagedLead = {
    address: string;
    postcode: string;
    leadTypeHint: 'mortgage_default' | 'receivership' | 'distressed_sale';
    source: string;
    companyNumber: string;
    companyName: string;
    lender: string | null;
    sourceRef: string;
    signalKey: 'chargeSignal' | 'insolvencySignal';
    signal: Record<string, unknown>;
    observedAt: Date;
    graphKind: 'charge_over' | 'insolvency';
  };
  const staged: StagedLead[] = [];
  let eventsInPatch = 0;

  // Charge events carry the charge object inline — no extra REST call
  // beyond the SIC-check profile.
  for (const event of chargesDrain.events) {
    if (event.eventType !== 'changed' || !event.companyNumber) continue;
    const profile = await profileFor(event.companyNumber);
    if (!profile || !isPropertyCompany(profile.sicCodes)) continue;

    const charge = parseChargeItem(event.data);
    if (!charge.particulars) continue;
    const inPatch = filterToDistricts(
      minePropertiesFromParticulars(charge.particulars, profile.companyName),
      districts
    );
    eventsInPatch += inPatch.length > 0 ? 1 : 0;
    for (const property of inPatch) {
      staged.push({
        address: property.address,
        postcode: property.postcode,
        leadTypeHint: 'mortgage_default',
        source: 'ch_stream_charge',
        companyNumber: profile.companyNumber,
        companyName: profile.companyName,
        lender: charge.lender,
        sourceRef: `ch-stream:charge:${charge.chargeRef || event.resourceId}`,
        signalKey: 'chargeSignal',
        signal: {
          companyNumber: profile.companyNumber,
          companyName: profile.companyName,
          chargeRef: charge.chargeRef,
          lender: charge.lender,
          createdOn: charge.createdOn,
          particulars: charge.particulars.slice(0, 500),
          detectedVia: 'stream',
        },
        observedAt: event.publishedAt
          ? new Date(event.publishedAt)
          : new Date(),
        graphKind: 'charge_over',
      });
    }
  }

  // Insolvency events name the company; the properties live in its charges
  // (one REST call), mirroring the receivership source's approach.
  for (const event of insolvencyDrain.events) {
    if (event.eventType !== 'changed' || !event.companyNumber) continue;
    const profile = await profileFor(event.companyNumber);
    if (!profile || !isPropertyCompany(profile.sicCodes)) continue;

    const cases = Array.isArray(event.data.cases)
      ? (event.data.cases as Array<Record<string, unknown>>)
      : [];
    const latestCase = cases.at(-1);
    const caseType =
      latestCase && typeof latestCase.type === 'string'
        ? latestCase.type
        : null;

    let charges: Awaited<ReturnType<typeof fetchCompanyCharges>> = [];
    try {
      charges = await fetchCompanyCharges(profile.companyNumber, restKey);
    } catch (err) {
      console.warn(
        `[cron/ch-stream] charges for ${profile.companyNumber} failed`,
        err
      );
      continue;
    }
    for (const charge of charges) {
      if (!charge.particulars) continue;
      const inPatch = filterToDistricts(
        minePropertiesFromParticulars(charge.particulars, profile.companyName),
        districts
      );
      eventsInPatch += inPatch.length > 0 ? 1 : 0;
      for (const property of inPatch) {
        staged.push({
          address: property.address,
          postcode: property.postcode,
          leadTypeHint: leadTypeForInsolvencyCase(caseType),
          source: 'ch_stream_insolvency',
          companyNumber: profile.companyNumber,
          companyName: profile.companyName,
          lender: charge.lender,
          sourceRef: `ch-stream:insolvency:${event.resourceId || profile.companyNumber}`,
          signalKey: 'insolvencySignal',
          signal: {
            companyNumber: profile.companyNumber,
            companyName: profile.companyName,
            caseType,
            chargeRef: charge.chargeRef,
            lender: charge.lender,
            detectedVia: 'stream',
          },
          observedAt: event.publishedAt
            ? new Date(event.publishedAt)
            : new Date(),
          graphKind: 'insolvency',
        });
      }
    }
  }

  // ── Graph writes (best-effort, before scoring so graphContext can see
  // this run's own siblings — two properties on one charge should already
  // count each other as connections) ────────────────────────────────────
  let graphWrites = 0;
  for (const lead of staged) {
    try {
      await recordChargeObservation({
        companyNumber: lead.companyNumber,
        companyName: lead.companyName,
        address: lead.address,
        postcode: lead.postcode,
        lender: lead.lender,
        kind: lead.graphKind,
        sourceRef: lead.sourceRef,
        sourceTrail: `${lead.source} → ${lead.companyNumber}`,
        observedAt: lead.observedAt,
      });
      graphWrites++;
    } catch (err) {
      // Graph tables may not exist yet on this environment — leads still land.
      console.warn('[cron/ch-stream] graph write failed', err);
    }
  }

  // ── Score with the SAME scorer + gate as the daily pipeline ───────────
  const runDate = new Date();
  const rows: Prisma.ScoutLeadCreateManyInput[] = [];
  for (const lead of staged) {
    // The raw-grant shape all sources share; leadTypeHint rides along so
    // baseFromProbateLead credits the right motivation class (receivership /
    // mortgage_default) instead of the probate default.
    const rawGrant: Parameters<typeof baseFromProbateLead>[0] & {
      leadTypeHint: string;
    } = {
      probateRef: lead.sourceRef,
      address: lead.address,
      postcode: lead.postcode,
      grantDate: runDate.toISOString().slice(0, 10),
      executorName: null,
      solicitorFirm: null,
      estateValuePence: null,
      grantType: 'unknown',
      source: lead.source,
      daysSinceGrant: 0,
      leadTypeHint: lead.leadTypeHint,
    };
    const base = baseFromProbateLead(rawGrant);
    const breakdown = scoreLead(
      {
        ...base,
        contactName: null,
        contactPhone: null,
        contactEmail: null,
        enrichmentTier: 3 as const,
        sourceTrail: lead.source,
      },
      null,
      null,
      undefined,
      scorerConfig
    );

    const track = classifyTrack({
      valuePence: null,
      text: lead.address,
      propertyType: null,
      postcode: lead.postcode,
      areaAvgPence: null,
      primeDistricts: founderPrimeDistricts,
    });

    // Same gate as the pipeline: volume leads must clear the sourcing
    // threshold; prime/block always reach the founder.
    const passesGate =
      breakdown.verdict !== 'INSUFFICIENT_DATA' &&
      (track !== 'volume' ||
        breakdown.sourcingScore >= scorerConfig.sourcingThreshold);
    if (!passesGate) continue;

    // What did the graph already know about this company? Stamped for the
    // overlay trial's measurement — see entity-graph.ts.
    let graphContext: Record<string, unknown> | null = null;
    try {
      graphContext = await graphContextForCompany(
        lead.companyNumber,
        propertyEntityKey(lead.address, lead.postcode)
      );
    } catch {
      // Overlay measurement only — never blocks a lead.
    }

    rows.push({
      runDate,
      source: lead.source,
      address: lead.address,
      postcode: lead.postcode,
      leadType: base.leadType,
      track,
      estimatedEquityPence: null,
      contactName: null,
      contactPhone: null,
      contactEmail: null,
      leadScore: breakdown.total,
      verdict: breakdown.verdict,
      marketTrend: breakdown.marketTrendLabel,
      sourceTrail: lead.source,
      status: 'new',
      evalConfigVersion,
      rawPayload: {
        [lead.signalKey]: lead.signal,
        scoreFactors: breakdown.factors,
        leadingIndicator: breakdown.leadingIndicator,
        rationale: breakdown.rationale,
        scoreBreakdown: {
          acquisition: breakdown.acquisition,
          roi: breakdown.roi,
          marketTrend: breakdown.marketTrend,
          risk: breakdown.risk,
          total: breakdown.total,
          appraised: breakdown.appraised,
          sourcingScore: breakdown.sourcingScore,
          achievablePoints: breakdown.achievablePoints,
        },
        ...(graphContext ? { graphContext } : {}),
      } as Prisma.InputJsonValue,
    });
  }

  let createdCount = 0;
  if (rows.length > 0) {
    const written = await database.scoutLead.createMany({
      data: rows,
      skipDuplicates: true,
    });
    createdCount = written.count;
  }

  // ── Persist the new timepoints — AFTER the leads, so a crash between the
  // two re-processes events (skipDuplicates makes that free) rather than
  // silently skipping them ──────────────────────────────────────────────
  const newTimepoints = {
    charges: chargesDrain.latestTimepoint ?? timepoints.charges,
    insolvency: insolvencyDrain.latestTimepoint ?? timepoints.insolvency,
  };
  try {
    await database.setting.upsert({
      where: { key: TIMEPOINT_SETTING_KEY },
      create: { key: TIMEPOINT_SETTING_KEY, value: newTimepoints },
      update: { value: newTimepoints },
    });
  } catch (err) {
    console.warn('[cron/ch-stream] failed to persist timepoints', err);
  }

  // ── Surface fresh catches — this is the latency win made visible ──────
  if (createdCount > 0) {
    try {
      const dayBucket = runDate.toISOString().slice(0, 10);
      const sample = rows
        .slice(0, 3)
        .map((r) => `${String(r.address).slice(0, 50)}`)
        .join(' | ');
      const data = {
        priority: 'high',
        status: 'pending',
        title: `${createdCount} fresh lender-pressure lead${createdCount === 1 ? '' : 's'} — caught on the live stream`,
        description: `Companies House stream flagged fresh charge/insolvency activity on property companies in your patch, minutes-fresh rather than tomorrow-morning. The office-holder clock is already running: ${sample}`,
        metadata: {
          source: 'cron_ch_stream',
          leadCount: createdCount,
          runDate: runDate.toISOString(),
          link: '/pipeline?tab=leads',
        },
        resolvedAt: null,
        resolvedBy: null,
        expiresAt: new Date(Date.now() + 48 * 3600_000),
      } as const;
      await database.founderAction.upsert({
        where: { dedupKey: `ch-stream-leads:${dayBucket}` },
        create: {
          type: 'review_leads',
          agent: 'scout',
          dedupKey: `ch-stream-leads:${dayBucket}`,
          ...data,
        },
        update: data,
      });
    } catch (err) {
      console.warn('[cron/ch-stream] founder-action create failed', err);
    }
  }

  // AgentEvent per run only when something happened — a quiet drain every
  // 30 minutes would drown the event log for zero information.
  if (createdCount > 0 || chargesDrain.error || insolvencyDrain.error) {
    try {
      await database.agentEvent.create({
        data: {
          agent: 'system',
          eventType: 'leads_created',
          summary: `CH stream drain: ${createdCount} new leads from ${eventsInPatch} in-patch events`,
          count: createdCount,
          payload: {
            source: 'cron_ch_stream',
            chargesEvents: chargesDrain.events.length,
            insolvencyEvents: insolvencyDrain.events.length,
            eventsInPatch,
            staged: staged.length,
            persisted: createdCount,
            graphWrites,
            restarted:
              chargesDrain.restartedFromLiveTail ||
              insolvencyDrain.restartedFromLiveTail,
            errors: [chargesDrain.error, insolvencyDrain.error].filter(Boolean),
          },
        },
      });
    } catch (err) {
      console.warn('[cron/ch-stream] agent-event create failed', err);
    }
  }

  await recordCronHeartbeat('ch-stream', {
    note: `${createdCount} persisted / ${staged.length} staged / ${chargesDrain.events.length + insolvencyDrain.events.length} events`,
  });

  return NextResponse.json({
    success: true,
    charges: {
      events: chargesDrain.events.length,
      caughtUp: chargesDrain.caughtUp,
      restarted: chargesDrain.restartedFromLiveTail,
      error: chargesDrain.error ?? null,
    },
    insolvency: {
      events: insolvencyDrain.events.length,
      caughtUp: insolvencyDrain.caughtUp,
      restarted: insolvencyDrain.restartedFromLiveTail,
      error: insolvencyDrain.error ?? null,
    },
    companiesChecked: profileCache.size,
    eventsInPatch,
    staged: staged.length,
    persisted: createdCount,
    graphWrites,
    timepoints: newTimepoints,
  });
};

// Vercel cron sends GET by default — accept both, matching the other crons.
export const GET = POST;

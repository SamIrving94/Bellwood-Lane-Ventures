import { env } from '@/env';
import { database, Prisma } from '@repo/database';
import { mergeScorerConfig, runScoutingPipeline } from '@repo/scouting';
import { getPropertySnapshot } from '@repo/property-data/src/propertydata';
import { NextResponse } from 'next/server';

// Snapshot enrichment is slow (~27s per unique postcode). Allow more time
// than the default 60s — bumps to Vercel Pro plan cap.
export const maxDuration = 300;

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
  // Each Area = { label, seedPostcode, district, radiusMiles, lastProbe }
  // Derive both: districts[] for HMCTS/Gazette/agent-prospecting AND
  // scanSeeds[] for PropertyData /sourced-properties + /listings.
  type ScanSeed = { label?: string; postcode: string; radiusMiles: number };
  let scanSeeds: ScanSeed[] = [];
  let sourcedPropertyPostcodes: string[] = [];

  try {
    const areasSetting = await database.setting.findUnique({
      where: { key: 'scouting.areas' },
    });
    if (areasSetting && Array.isArray(areasSetting.value)) {
      const areas = (areasSetting.value as unknown[]).flatMap((raw) => {
        if (!raw || typeof raw !== 'object') return [];
        const a = raw as Record<string, unknown>;
        const seedPostcode =
          typeof a.seedPostcode === 'string' ? a.seedPostcode : null;
        const district = typeof a.district === 'string' ? a.district : null;
        const radiusMiles =
          typeof a.radiusMiles === 'number' ? a.radiusMiles : 1.5;
        const label = typeof a.label === 'string' ? a.label : undefined;
        if (!seedPostcode || !district) return [];
        return [{ seedPostcode, district, radiusMiles, label }];
      });
      scanSeeds = areas.map((a) => ({
        label: a.label,
        postcode: a.seedPostcode,
        radiusMiles: a.radiusMiles,
      }));
      sourcedPropertyPostcodes = Array.from(
        new Set(areas.map((a) => a.district)),
      );
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

  const result = await runScoutingPipeline({
    limit: 50,
    minScore: 30,
    sourcedPropertyPostcodes,
    scanSeeds,
    scorerConfig,
    evalConfigVersion,
  });

  // ── Persist leads FIRST (cheap, durable) ─────────────────────────────
  // Snapshot enrichment is slow (~27s/postcode) and previously ran BEFORE
  // the write — so a 300s timeout during enrichment lost the entire run.
  // We now persist immediately (a few ms), then enrich in a second pass
  // where each lead is updated individually. A timeout now only costs
  // un-enriched snapshots; the leads themselves are already safe.
  let createdCount = 0;
  if (result.leads.length > 0) {
    const written = await database.scoutLead.createMany({
      data: result.leads.map((lead) => ({
        ...lead,
        rawPayload:
          lead.rawPayload === null
            ? Prisma.JsonNull
            : (lead.rawPayload as Prisma.InputJsonValue),
      })),
      skipDuplicates: true,
    });
    createdCount = written.count;
  }

  // ── Second pass: enrich top-N persisted leads with property snapshot ──
  // For the top 10 leads by score, fetch the full Tier 1+2 snapshot
  // (AVM + sold comps + yields + tenure + EPC + facts) and merge into the
  // persisted row. Deduped by postcode (cache covers repeats). Each
  // update commits independently, so partial progress survives a timeout.
  const topToEnrich = [...result.leads]
    .sort((a, b) => b.leadScore - a.leadScore)
    .slice(0, 10);
  const snapshotsByPostcode = new Map<
    string,
    Awaited<ReturnType<typeof getPropertySnapshot>>
  >();
  let enrichedCount = 0;
  for (const lead of topToEnrich) {
    try {
      // createMany doesn't return ids — look the persisted row up by its
      // new unique key. Skips cleanly if the lead was a dedup no-op miss.
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
  if (highScoreLeads.length > 0) {
    const leadIds = result.leads
      .filter((l) => l.leadScore >= 70)
      .map((l, i) => `${i}:${l.address.slice(0, 40)}, ${l.postcode}`)
      .slice(0, 10);
    try {
      // Founder-facing review action
      await database.founderAction.create({
        data: {
          type: 'review_leads',
          priority: highScoreLeads.length >= 5 ? 'high' : 'medium',
          status: 'pending',
          agent: 'system',
          agentEventId: eventId,
          title: `Review ${highScoreLeads.length} new lead${highScoreLeads.length === 1 ? '' : 's'} scored 70+`,
          description: `Daily scout run found ${result.leads.length} qualified leads. ${strongLeads.length} STRONG, ${highScoreLeads.length} scored ≥ 70. Open Pipeline → Leads to review and convert the best to deals.`,
          metadata: {
            source: 'cron_scouting',
            assignedToAgent: 'board',
            leadCount: highScoreLeads.length,
            strongCount: strongLeads.length,
            runDate: result.runDate.toISOString(),
            link: '/pipeline?tab=leads',
            leadSample: leadIds,
          },
        },
      });

      // Marketer-facing draft action (Paperclip picks up on next heartbeat)
      await database.founderAction.create({
        data: {
          type: 'dispatch_campaign',
          priority: 'medium',
          status: 'pending',
          agent: 'marketer',
          agentEventId: eventId,
          title: `Draft outreach for ${highScoreLeads.length} new high-scoring lead${highScoreLeads.length === 1 ? '' : 's'}`,
          description: `Scout cron found ${highScoreLeads.length} leads scored ≥ 70 (${strongLeads.length} STRONG). For each, draft a first-touch email to the executor/contact tailored to the lead type (probate / chain break / repos / problem property). Hold all drafts for board approval. Top examples: ${leadIds.slice(0, 3).join(' | ')}.`,
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
    } catch (err) {
      console.warn('[cron/scouting] founder-action create failed', err);
    }
  }

  return NextResponse.json({
    success: true,
    runDate: result.runDate.toISOString(),
    fetched: result.fetched,
    enriched: result.enriched,
    qualified: result.leads.length,
    persisted: createdCount,
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

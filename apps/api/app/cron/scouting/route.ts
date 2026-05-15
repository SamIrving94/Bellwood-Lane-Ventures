import { env } from '@/env';
import { database, Prisma } from '@repo/database';
import { runScoutingPipeline } from '@repo/scouting';
import { NextResponse } from 'next/server';

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

  // Read target postcodes from the DB-backed Setting (founder-managed via
  // /settings/scouting in the dashboard). Falls back to the legacy
  // AGENT_PROSPECTING_POSTCODES env var if no setting is configured.
  let sourcedPropertyPostcodes: string[] = [];
  try {
    const setting = await database.setting.findUnique({
      where: { key: 'scouting.targetPostcodes' },
    });
    if (setting && Array.isArray(setting.value)) {
      sourcedPropertyPostcodes = (setting.value as unknown[]).filter(
        (v): v is string => typeof v === 'string' && v.trim().length > 0,
      );
    }
  } catch (err) {
    console.warn('[cron/scouting] failed to read postcodes from DB, falling back to env', err);
  }
  if (sourcedPropertyPostcodes.length === 0) {
    sourcedPropertyPostcodes = (env.AGENT_PROSPECTING_POSTCODES ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
  }

  // Scan seeds — full UK postcodes with a radius. PropertyData's
  // /sourced-properties needs these (it rejects bare districts).
  type ScanSeed = { label?: string; postcode: string; radiusMiles: number };
  let scanSeeds: ScanSeed[] = [];
  try {
    const seedsSetting = await database.setting.findUnique({
      where: { key: 'scouting.scanSeeds' },
    });
    if (seedsSetting && Array.isArray(seedsSetting.value)) {
      scanSeeds = (seedsSetting.value as unknown[]).flatMap((raw) => {
        if (!raw || typeof raw !== 'object') return [];
        const s = raw as Record<string, unknown>;
        const postcode = typeof s.postcode === 'string' ? s.postcode : null;
        const radiusMiles = typeof s.radiusMiles === 'number' ? s.radiusMiles : 1;
        const label = typeof s.label === 'string' ? s.label : undefined;
        return postcode ? [{ postcode, radiusMiles, label }] : [];
      });
    }
  } catch (err) {
    console.warn('[cron/scouting] failed to read scan seeds from DB', err);
  }

  const result = await runScoutingPipeline({
    limit: 50,
    minScore: 30,
    sourcedPropertyPostcodes,
    scanSeeds,
  });

  let createdCount = 0;
  if (result.leads.length > 0) {
    const written = await database.scoutLead.createMany({
      data: result.leads.map((lead) => ({
        ...lead,
        rawPayload: lead.rawPayload === null ? Prisma.JsonNull : (lead.rawPayload as Prisma.InputJsonValue),
      })),
      skipDuplicates: true,
    });
    createdCount = written.count;
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
    highScoreLeads: highScoreLeads.length,
    strongLeads: strongLeads.length,
    summary: result.summary,
    gdprFieldsStripped: result.gdprStripped.length,
    sources: result.sources,
    sourceErrors: result.sourceErrors,
  });
};

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

  const result = await runScoutingPipeline({
    limit: 50,
    minScore: 30,
    sourcedPropertyPostcodes,
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

  // Founder Action surfaces high-scoring leads in /actions and Today.
  // Best-effort — never blocks the cron response.
  if (highScoreLeads.length > 0) {
    try {
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

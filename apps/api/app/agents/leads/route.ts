import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

// Scout agent pushes new leads into the platform
// Creates ScoutLeads + AgentEvent + FounderAction (if high-scoring leads)
export const POST = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  const body = await request.json();
  const { leads, runSummary } = body;

  if (!leads || !Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json(
      { error: 'Missing or empty leads array' },
      { status: 400 }
    );
  }

  // Save leads to database
  const created = await database.scoutLead.createMany({
    data: leads,
    skipDuplicates: true,
  });

  // Count high-scoring leads
  const highScoreLeads = leads.filter(
    (l: { leadScore: number }) => l.leadScore >= 70
  );
  const strongLeads = leads.filter(
    (l: { verdict: string }) => l.verdict === 'STRONG'
  );

  // Build summary
  const summary = runSummary?.summary ??
    `Scout found ${leads.length} leads (${strongLeads.length} STRONG, ${highScoreLeads.length} scored 70+)`;

  // Log agent event
  const event = await database.agentEvent.create({
    data: {
      agent: 'scout',
      eventType: 'leads_created',
      summary,
      count: leads.length,
      payload: {
        total: leads.length,
        strong: strongLeads.length,
        highScore: highScoreLeads.length,
        fetched: runSummary?.fetched,
        enriched: runSummary?.enriched,
      },
    },
  });

  // If high-scoring leads exist, create a FounderAction
  if (highScoreLeads.length > 0) {
    await database.founderAction.create({
      data: {
        type: 'review_leads',
        priority: highScoreLeads.length >= 5 ? 'high' : 'medium',
        title: `Review ${highScoreLeads.length} new leads scored 70+`,
        description: `Scout run found ${leads.length} total leads. ${strongLeads.length} have STRONG verdict, ${highScoreLeads.length} scored 70 or above. Review and convert the best ones to deals.`,
        agent: 'scout',
        agentEventId: event.id,
        metadata: {
          leadCount: highScoreLeads.length,
          strongCount: strongLeads.length,
          runDate: new Date().toISOString(),
        },
      },
    });
  }

  return NextResponse.json({
    success: true,
    created: created.count,
    highScoreLeads: highScoreLeads.length,
    eventId: event.id,
  });
};

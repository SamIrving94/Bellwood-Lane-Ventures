import { env } from '@/env';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';

// Pipeline Stage 4: Morning Summary (8:00am daily)
// Creates a single FounderAction summarising everything the agents did overnight
export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Gather today's agent activity
  const [
    todayEvents,
    pendingActions,
    newLeadsToday,
    strongLeadsToday,
    dealsAppraised,
    outreachSent,
    heldComms,
    slaBreaches,
  ] = await Promise.all([
    database.agentEvent.findMany({
      where: { createdAt: { gte: todayStart } },
      orderBy: { createdAt: 'desc' },
    }),
    database.founderAction.count({
      where: { status: { in: ['pending', 'in_progress'] } },
    }),
    database.scoutLead.count({
      where: { createdAt: { gte: todayStart } },
    }),
    database.scoutLead.count({
      where: {
        createdAt: { gte: todayStart },
        verdict: 'STRONG',
      },
    }),
    database.agentEvent.count({
      where: {
        createdAt: { gte: todayStart },
        agent: 'appraiser',
        eventType: { in: ['avm_completed', 'pipeline_appraise'] },
      },
    }),
    database.agentEvent.findFirst({
      where: {
        createdAt: { gte: todayStart },
        agent: 'marketer',
        eventType: 'pipeline_outreach',
      },
      select: { payload: true },
    }),
    database.outreachHold.count({
      where: { status: 'held', createdAt: { gte: todayStart } },
    }),
    database.founderAction.count({
      where: {
        type: 'sla_breach',
        status: 'pending',
      },
    }),
  ]);

  const outreachPayload = outreachSent?.payload as Record<string, number> | null;
  const emailsSent = outreachPayload?.autoSent ?? 0;

  // Build the morning summary
  const lines: string[] = [];

  if (newLeadsToday > 0) {
    lines.push(`**Scout:** ${newLeadsToday} new leads found (${strongLeadsToday} STRONG)`);
  } else {
    lines.push('**Scout:** No new leads today');
  }

  if (dealsAppraised > 0) {
    lines.push(`**Appraiser:** ${dealsAppraised} valuations completed`);
  }

  if (emailsSent > 0 || heldComms > 0) {
    const parts = [];
    if (emailsSent > 0) parts.push(`${emailsSent} emails auto-sent`);
    if (heldComms > 0) parts.push(`${heldComms} vendor emails awaiting review`);
    lines.push(`**Marketer:** ${parts.join(', ')}`);
  }

  if (slaBreaches > 0) {
    lines.push(`**SLA:** ${slaBreaches} breach${slaBreaches === 1 ? '' : 'es'} need attention`);
  }

  lines.push(`\n**Total pending actions:** ${pendingActions}`);

  const summaryTitle = `Morning briefing: ${newLeadsToday} leads, ${pendingActions} actions pending`;
  const summaryBody = lines.join('\n');

  // Determine priority based on what needs attention
  const hasCritical = slaBreaches > 0 || heldComms > 0;
  const hasActivity = newLeadsToday > 0 || dealsAppraised > 0 || emailsSent > 0;

  // Only create summary if there's something to report
  if (hasActivity || pendingActions > 0) {
    await database.founderAction.create({
      data: {
        type: 'general',
        priority: hasCritical ? 'high' : 'medium',
        title: summaryTitle,
        description: summaryBody,
        agent: 'orchestrator',
        metadata: {
          newLeadsToday,
          strongLeadsToday,
          dealsAppraised,
          emailsSent,
          heldComms,
          slaBreaches,
          pendingActions,
          totalEvents: todayEvents.length,
        },
      },
    });
  }

  // Log the summary event
  await database.agentEvent.create({
    data: {
      agent: 'orchestrator',
      eventType: 'morning_summary',
      summary: summaryTitle,
      count: todayEvents.length,
      payload: {
        newLeadsToday,
        strongLeadsToday,
        dealsAppraised,
        emailsSent,
        heldComms,
        slaBreaches,
        pendingActions,
      },
    },
  });

  return NextResponse.json({
    success: true,
    summary: {
      newLeadsToday,
      strongLeadsToday,
      dealsAppraised,
      emailsSent,
      heldComms,
      slaBreaches,
      pendingActions,
      totalEvents: todayEvents.length,
    },
  });
};

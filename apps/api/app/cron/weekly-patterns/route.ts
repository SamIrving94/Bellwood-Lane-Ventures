import { env } from '@/env';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';

/**
 * GET/POST /cron/weekly-patterns
 *
 * Sunday-evening retrospective. Runs once a week, gathers last-7-day
 * platform activity, and creates a CEO `general` FounderAction asking
 * the CEO (Paperclip board agent) to surface patterns + a single
 * highest-leverage move for the week ahead.
 *
 * Token budget: one prompt per week. Designed to be the cheapest possible
 * "what should we change?" signal — not a daily nag.
 */
export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Idempotency — don't double-fire if Vercel retries within the same week.
  const recent = await database.founderAction.findFirst({
    where: {
      type: 'general',
      agent: 'orchestrator',
      metadata: { path: ['workflow'], equals: 'weekly_pattern_review' },
      createdAt: { gte: weekAgo },
    },
  });
  if (recent) {
    return NextResponse.json({ ok: true, skipped: 'already_created_this_week' });
  }

  // Aggregate the week
  const [
    quotesCreated,
    quotesQuoted,
    dealsCreated,
    dealsCompleted,
    leadsCreated,
    actionsCompleted,
    actionsBreaching,
  ] = await Promise.all([
    database.quoteRequest.count({ where: { createdAt: { gte: weekAgo } } }),
    database.quoteRequest.count({
      where: { createdAt: { gte: weekAgo }, status: 'quoted' },
    }),
    database.deal.count({ where: { createdAt: { gte: weekAgo } } }),
    database.deal.count({
      where: { createdAt: { gte: weekAgo }, status: 'completed' },
    }),
    // No Lead model — count newly-scouted leads via AgentEvent instead
    database.agentEvent
      .count({
        where: {
          createdAt: { gte: weekAgo },
          eventType: { in: ['scouting_complete', 'lead_created'] },
        },
      })
      .catch(() => 0),
    database.founderAction.count({
      where: { status: 'completed', resolvedAt: { gte: weekAgo } },
    }),
    database.founderAction.count({
      where: { status: { in: ['pending', 'in_progress'] }, createdAt: { lt: weekAgo } },
    }),
  ]);

  const summary = [
    `Week ending ${now.toISOString().slice(0, 10)}:`,
    `- Quotes created: ${quotesCreated} (of which ${quotesQuoted} priced)`,
    `- Deals created: ${dealsCreated}, completed: ${dealsCompleted}`,
    `- New scouted leads: ${leadsCreated}`,
    `- FounderActions resolved: ${actionsCompleted}`,
    `- Stale actions (>7 days unresolved): ${actionsBreaching}`,
  ].join('\n');

  const action = await database.founderAction.create({
    data: {
      type: 'general',
      priority: 'medium',
      agent: 'orchestrator',
      title: `Weekly review — week of ${now.toISOString().slice(0, 10)}`,
      description: [
        'Once-a-week pattern review. Read the activity snapshot below, then answer three things:',
        '',
        "1. **One pattern you noticed this week** — what's working, what's stuck, what surprised you.",
        '2. **One thing to STOP doing next week** — subtraction beats addition.',
        '3. **One highest-leverage move for next week** — the single thing that, if it lands, makes the week.',
        '',
        'Post your answer as a `system_summary` AgentEvent so the platform timeline records it. Then resolve this action.',
        '',
        '---',
        '',
        summary,
        '',
        `Stale actions backlog: ${actionsBreaching}. If > 10, propose a triage pass.`,
      ].join('\n'),
      metadata: {
        assignedToAgent: 'board',
        workflow: 'weekly_pattern_review',
        weekEnding: now.toISOString(),
        snapshot: {
          quotesCreated,
          quotesQuoted,
          dealsCreated,
          dealsCompleted,
          leadsCreated,
          actionsCompleted,
          actionsBreaching,
        },
      },
    },
  });

  await database.agentEvent
    .create({
      data: {
        agent: 'system',
        eventType: 'weekly_patterns_prompt',
        summary: `Weekly pattern review queued for CEO (${quotesCreated} quotes, ${dealsCompleted} completions).`,
        count: 1,
        payload: { actionId: action.id },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true, actionId: action.id, snapshot: { quotesCreated, quotesQuoted, dealsCreated, dealsCompleted, leadsCreated, actionsCompleted, actionsBreaching } });
};

export const GET = POST;

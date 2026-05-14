import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

/**
 * GET /agents/inbox?agent=marketer
 *
 * The polling endpoint Paperclip agents hit on each heartbeat. Returns
 * the FounderActions assigned to that agent (via metadata.assignedToAgent)
 * that are still pending/in_progress.
 *
 * Lets agents wake, see if there's real work for them, and do it — without
 * the platform needing to push events.
 *
 * Usage from a Paperclip agent:
 *   1. GET /agents/inbox?agent=marketer
 *   2. If response.actions is empty → exit cheaply (~500 tokens).
 *   3. Otherwise, work the highest-priority action.
 *   4. When done, POST /agents/inbox/[id]/complete to clear it (TBD).
 *
 * @param agent  one of: marketer | liaison | appraiser | counsel | engineer | designer | ceo
 * @param limit  default 10
 */
export const GET = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();
  const url = new URL(request.url);
  const agent = url.searchParams.get('agent');
  const limit = Math.min(Number.parseInt(url.searchParams.get('limit') ?? '10', 10), 50);

  if (!agent) {
    return NextResponse.json(
      { error: 'Missing agent query param' },
      { status: 400 },
    );
  }

  const actions = await database.founderAction.findMany({
    where: {
      status: { in: ['pending', 'in_progress'] },
      metadata: { path: ['assignedToAgent'], equals: agent },
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    take: limit,
  });

  return NextResponse.json({
    agent,
    count: actions.length,
    actions: actions.map((a) => ({
      id: a.id,
      type: a.type,
      priority: a.priority,
      status: a.status,
      title: a.title,
      description: a.description,
      metadata: a.metadata,
      createdAt: a.createdAt,
      expiresAt: a.expiresAt,
    })),
  });
};

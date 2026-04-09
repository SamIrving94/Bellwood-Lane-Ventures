import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

// Generic agent event logging
// Any Paperclip agent can log what it did
export const POST = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  const body = await request.json();
  const { agent, eventType, summary, payload, dealId, count } = body;

  if (!agent || !eventType || !summary) {
    return NextResponse.json(
      { error: 'Missing required fields: agent, eventType, summary' },
      { status: 400 }
    );
  }

  const event = await database.agentEvent.create({
    data: {
      agent,
      eventType,
      summary,
      payload: payload ?? undefined,
      dealId: dealId ?? undefined,
      count: count ?? 1,
    },
  });

  return NextResponse.json({ success: true, eventId: event.id });
};

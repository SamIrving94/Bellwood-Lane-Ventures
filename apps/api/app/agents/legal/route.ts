import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

// Counsel agent updates legal steps and flags issues
export const POST = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  const body = await request.json();
  const { dealId, stepKey, completed, notes, flagIssue } = body;

  if (!dealId || !stepKey) {
    return NextResponse.json(
      { error: 'Missing required fields: dealId, stepKey' },
      { status: 400 }
    );
  }

  // Upsert the legal step
  const legalStep = await database.legalStep.upsert({
    where: { dealId_stepKey: { dealId, stepKey } },
    update: {
      completed: completed ?? false,
      completedAt: completed ? new Date() : null,
      notes: notes ?? undefined,
    },
    create: {
      dealId,
      stepKey,
      completed: completed ?? false,
      completedAt: completed ? new Date() : null,
      notes: notes ?? undefined,
    },
  });

  // Fetch deal for context
  const deal = await database.deal.findUnique({
    where: { id: dealId },
    select: { address: true, postcode: true },
  });
  const address = deal?.address ?? dealId;

  // Log deal activity
  await database.dealActivity.create({
    data: {
      dealId,
      action: 'legal_update',
      detail: `Legal step "${stepKey}" ${completed ? 'completed' : 'updated'}${notes ? `: ${notes}` : ''}`,
    },
  });

  // Log agent event
  const event = await database.agentEvent.create({
    data: {
      agent: 'counsel',
      eventType: flagIssue ? 'legal_flag' : 'legal_step_updated',
      summary: flagIssue
        ? `Legal flag on ${address}: ${notes ?? stepKey}`
        : `Legal step "${stepKey}" ${completed ? 'completed' : 'updated'} on ${address}`,
      dealId,
      payload: { stepKey, completed, notes, flagIssue },
    },
  });

  // If flagging an issue, create a FounderAction
  if (flagIssue) {
    await database.founderAction.create({
      data: {
        type: 'legal_flag',
        priority: 'critical',
        title: `Legal flag: ${notes ?? stepKey} on ${address}`,
        description: `Counsel has flagged a legal issue on this deal. Step: "${stepKey}". ${notes ?? 'Review required.'}`,
        agent: 'counsel',
        dealId,
        agentEventId: event.id,
        metadata: { stepKey, notes, legalStepId: legalStep.id },
      },
    });
  }

  return NextResponse.json({
    success: true,
    legalStepId: legalStep.id,
    eventId: event.id,
    flagged: !!flagIssue,
  });
};

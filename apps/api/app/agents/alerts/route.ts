import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

// Orchestrator agent sends alerts: chain breaks, golden windows, etc.
export const POST = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  const body = await request.json();
  const { alertType, dealId, title, description, priority, metadata } = body;

  if (!alertType || !title) {
    return NextResponse.json(
      { error: 'Missing required fields: alertType, title' },
      { status: 400 }
    );
  }

  // Map alertType to ActionType
  const typeMap: Record<string, string> = {
    chain_break: 'chain_break_alert',
    golden_window: 'golden_window',
    sla_breach: 'sla_breach',
    ceo_escalation: 'ceo_escalation',
    legal_flag: 'legal_flag',
  };
  const actionType = typeMap[alertType] ?? 'general';

  // If there's a deal, update golden window / mortgage expiry fields
  if (dealId && metadata) {
    const updateData: Record<string, unknown> = {};
    if (metadata.goldenWindowExpiresAt) {
      updateData.goldenWindowExpiresAt = new Date(metadata.goldenWindowExpiresAt);
    }
    if (metadata.mortgageExpiryDate) {
      updateData.mortgageExpiryDate = new Date(metadata.mortgageExpiryDate);
    }
    if (metadata.suggestedNextAction) {
      updateData.suggestedNextAction = JSON.stringify(metadata.suggestedNextAction);
    }
    if (Object.keys(updateData).length > 0) {
      await database.deal.update({ where: { id: dealId }, data: updateData });
    }
  }

  // Log agent event
  const event = await database.agentEvent.create({
    data: {
      agent: 'orchestrator',
      eventType: alertType,
      summary: title,
      dealId: dealId ?? undefined,
      payload: metadata ?? undefined,
    },
  });

  // Log deal activity if linked
  if (dealId) {
    await database.dealActivity.create({
      data: {
        dealId,
        action: `alert_${alertType}`,
        detail: title,
      },
    });
  }

  // Create FounderAction
  const action = await database.founderAction.create({
    data: {
      type: actionType as any,
      priority: priority ?? (alertType === 'ceo_escalation' ? 'critical' : 'high'),
      title,
      description: description ?? undefined,
      agent: 'orchestrator',
      dealId: dealId ?? undefined,
      agentEventId: event.id,
      metadata: metadata ?? undefined,
      expiresAt: metadata?.expiresAt ? new Date(metadata.expiresAt) : undefined,
    },
  });

  return NextResponse.json({
    success: true,
    actionId: action.id,
    eventId: event.id,
  });
};

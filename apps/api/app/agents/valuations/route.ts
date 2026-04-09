import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

// Appraiser agent pushes AVM results
// Creates AvmResult + updates Deal + AgentEvent + FounderAction
export const POST = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  const body = await request.json();
  const { dealId, postcode, propertyType, riskScore, resultJson, expiresAt } = body;

  if (!postcode || !propertyType || riskScore === undefined || !resultJson) {
    return NextResponse.json(
      { error: 'Missing required fields: postcode, propertyType, riskScore, resultJson' },
      { status: 400 }
    );
  }

  // Create AVM result
  const avmResult = await database.avmResult.create({
    data: {
      dealId: dealId ?? undefined,
      postcode,
      propertyType,
      riskScore,
      resultJson,
      expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Extract key values from result
  const estimatedValue = resultJson?.hedonic?.value ?? resultJson?.csa?.adjustedMedian;
  const offerPence = resultJson?.offer?.offerPence;
  const verdict = resultJson?.verdict;
  const marginPercent = resultJson?.offer?.marginPercent;
  const requiresCeoEscalation = resultJson?.offer?.ceoEscalation === true;

  // Update deal if linked
  if (dealId) {
    await database.deal.update({
      where: { id: dealId },
      data: {
        estimatedMarketValuePence: estimatedValue ?? undefined,
        ourOfferPence: offerPence ?? undefined,
        marginPercent: marginPercent ?? undefined,
        verdict: verdict ?? undefined,
      },
    });

    // Log activity on deal
    await database.dealActivity.create({
      data: {
        dealId,
        action: 'avm_completed',
        detail: `AVM completed: risk score ${riskScore}, verdict ${verdict ?? 'N/A'}${offerPence ? `, suggested offer ${(offerPence / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}` : ''}`,
      },
    });
  }

  // Fetch deal address for the action title
  const deal = dealId
    ? await database.deal.findUnique({ where: { id: dealId }, select: { address: true, postcode: true } })
    : null;

  const address = deal?.address ?? postcode;

  // Log agent event
  const event = await database.agentEvent.create({
    data: {
      agent: 'appraiser',
      eventType: 'avm_completed',
      summary: `AVM completed for ${address}: risk ${riskScore}, verdict ${verdict ?? 'N/A'}`,
      dealId: dealId ?? undefined,
      payload: {
        avmResultId: avmResult.id,
        riskScore,
        verdict,
        estimatedValue,
        offerPence,
        marginPercent,
      },
    },
  });

  // Create FounderAction
  if (requiresCeoEscalation) {
    await database.founderAction.create({
      data: {
        type: 'ceo_escalation',
        priority: 'critical',
        title: `CEO escalation: offer < 60% AVM on ${address}`,
        description: `The AVM-generated offer is less than 60% of estimated market value. This requires founder sign-off before proceeding.`,
        agent: 'appraiser',
        dealId: dealId ?? undefined,
        agentEventId: event.id,
        metadata: {
          avmResultId: avmResult.id,
          riskScore,
          estimatedValue,
          offerPence,
          marginPercent,
        },
      },
    });
  } else if (dealId) {
    await database.founderAction.create({
      data: {
        type: 'approve_offer',
        priority: 'medium',
        title: `Approve offer on ${address}${offerPence ? ` — ${(offerPence / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}` : ''}${marginPercent ? ` (margin ${marginPercent.toFixed(1)}%)` : ''}`,
        description: `Valuation complete. Risk score: ${riskScore}/100. Verdict: ${verdict ?? 'N/A'}. Review the AVM breakdown and approve or adjust the offer.`,
        agent: 'appraiser',
        dealId,
        agentEventId: event.id,
        metadata: {
          avmResultId: avmResult.id,
          riskScore,
          verdict,
          estimatedValue,
          offerPence,
          marginPercent,
        },
      },
    });
  }

  return NextResponse.json({
    success: true,
    avmResultId: avmResult.id,
    eventId: event.id,
    ceoEscalation: requiresCeoEscalation,
  });
};

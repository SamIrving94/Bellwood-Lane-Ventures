import { env } from '@/env';
import {
  type CalendlyInviteeEvent,
  extractEventStart,
  extractLeadId,
  verifyWebhookSignature,
} from '@repo/calendly';
import { database } from '@repo/database';
import { log } from '@repo/observability/log';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Calendly webhook handler.
 *
 * Flow:
 *   1. Verify signature (skipped gracefully if no signing key configured).
 *   2. Parse `invitee.created` / `invitee.canceled`.
 *   3. Resolve our internal lead/deal id from `tracking.utm_content`.
 *   4. Update DB:
 *      - Deal: set `calendlyEventAt` (on created) and log DealActivity.
 *      - ScoutLead: nothing to timestamp (no field), but we still record
 *        the activity via a FounderAction.
 *   5. Create a FounderAction so the founder sees it in the Action Centre.
 */
export const POST = async (request: Request): Promise<Response> => {
  const raw = await request.text();

  const headerList = await headers();
  const signature = headerList.get('calendly-webhook-signature');
  const signingKey = env.CALENDLY_WEBHOOK_SIGNING_KEY;

  // Only enforce signature verification when a signing key is configured.
  // Without a key we accept the payload but log a warning — this keeps
  // local dev / pre-provisioned environments usable.
  if (signingKey) {
    if (!verifyWebhookSignature(raw, signature, signingKey)) {
      log.warn('Calendly webhook: bad signature', {
        hasSig: Boolean(signature),
      });
      return new Response('Invalid signature', { status: 401 });
    }
  } else {
    log.warn(
      'Calendly webhook: CALENDLY_WEBHOOK_SIGNING_KEY not set, skipping signature check',
    );
  }

  let event: CalendlyInviteeEvent;
  try {
    event = JSON.parse(raw) as CalendlyInviteeEvent;
  } catch (error) {
    log.error('Calendly webhook: invalid JSON', { error });
    return new Response('Invalid payload', { status: 400 });
  }

  const leadId = extractLeadId(event);
  if (!leadId) {
    log.warn('Calendly webhook: no utm_content/leadId on event', {
      eventType: event.event,
    });
    // Return 200 so Calendly doesn't retry — it's not our booking.
    return NextResponse.json({ ok: true, matched: false });
  }

  // `leadId` may point to either a Deal or a ScoutLead (we send links from both).
  const [deal, scoutLead] = await Promise.all([
    database.deal.findUnique({ where: { id: leadId } }),
    database.scoutLead.findUnique({ where: { id: leadId } }),
  ]);

  if (!deal && !scoutLead) {
    log.warn('Calendly webhook: leadId not found in Deal or ScoutLead', {
      leadId,
      eventType: event.event,
    });
    return NextResponse.json({ ok: true, matched: false });
  }

  const inviteeName = event.payload?.name ?? 'invitee';
  const startTime = extractEventStart(event);

  if (event.event === 'invitee.created') {
    if (deal) {
      await database.deal.update({
        where: { id: deal.id },
        data: {
          calendlyEventAt: startTime ?? undefined,
        },
      });

      await database.dealActivity.create({
        data: {
          dealId: deal.id,
          action: 'call_booked',
          detail: startTime
            ? `${inviteeName} booked initial call for ${startTime.toISOString()}`
            : `${inviteeName} booked initial call`,
        },
      });
    }

    await database.founderAction.create({
      data: {
        type: 'general',
        priority: 'high',
        title: deal
          ? `Call booked: ${deal.address}`
          : `Call booked (lead ${leadId})`,
        description: startTime
          ? `${inviteeName} booked an initial call for ${startTime.toLocaleString('en-GB')}.`
          : `${inviteeName} booked an initial call.`,
        agent: 'liaison',
        dealId: deal?.id ?? undefined,
        metadata: {
          leadId,
          inviteeName,
          inviteeEmail: event.payload?.email ?? null,
          startTime: startTime?.toISOString() ?? null,
          rescheduleUrl: event.payload?.reschedule_url ?? null,
          cancelUrl: event.payload?.cancel_url ?? null,
          source: scoutLead ? 'scout_lead' : 'deal',
        },
      },
    });

    log.info('Calendly: invitee.created processed', { leadId, startTime });
    return NextResponse.json({ ok: true, matched: true, event: 'created' });
  }

  if (event.event === 'invitee.canceled') {
    if (deal) {
      await database.dealActivity.create({
        data: {
          dealId: deal.id,
          action: 'call_cancelled',
          detail: `${inviteeName} cancelled the initial call`,
        },
      });
    }

    await database.founderAction.create({
      data: {
        type: 'general',
        priority: 'medium',
        title: deal
          ? `Call cancelled: ${deal.address}`
          : `Call cancelled (lead ${leadId})`,
        description: `${inviteeName} cancelled their initial call.`,
        agent: 'liaison',
        dealId: deal?.id ?? undefined,
        metadata: {
          leadId,
          inviteeName,
          source: scoutLead ? 'scout_lead' : 'deal',
        },
      },
    });

    log.info('Calendly: invitee.canceled processed', { leadId });
    return NextResponse.json({ ok: true, matched: true, event: 'canceled' });
  }

  // Unhandled event type — ack so Calendly doesn't retry.
  log.info('Calendly: unhandled event type', { eventType: event.event });
  return NextResponse.json({ ok: true, matched: true, event: 'ignored' });
};

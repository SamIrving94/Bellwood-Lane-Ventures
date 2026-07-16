import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * POST /api/track/[token]/reply
 *
 * Public endpoint — no auth, gated by the unguessable trackToken.
 * The vendor (or agent) leaves a message from the TrackToken page.
 * We create a Liaison-assigned FounderAction so Liaison picks it up
 * via the event-poller cron's vendor-reply triage.
 *
 * We never auto-respond. Liaison drafts, the board approves, then it sends.
 */
const Input = z.object({
  message: z.string().min(1).max(2000),
  contactName: z.string().max(120).optional(),
  contactEmail: z.string().email().max(200).optional(),
  contactPhone: z.string().max(40).optional(),
  // Honeypot — bots fill this, humans don't see it.
  website: z.string().optional(),
});

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) => {
  const { token } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Honeypot — silently accept and discard.
  if (input.website && input.website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const trackToken = await database.trackToken.findUnique({
    where: { token },
    include: { quoteRequest: true, deal: true },
  });
  if (!trackToken) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const property = trackToken.quoteRequest ?? trackToken.deal;
  const address = property?.address ?? 'unknown property';
  const postcode = property?.postcode ?? '';

  // Surface this to Liaison as a queued action.
  const action = await database.founderAction.create({
    data: {
      type: 'general',
      priority: 'high',
      agent: 'liaison',
      title: `Vendor reply on ${address}`,
      description: [
        `Inbound message from the TrackToken page for ${address}, ${postcode}.`,
        '',
        `Message:`,
        input.message,
        '',
        input.contactName ? `Name: ${input.contactName}` : '',
        input.contactEmail ? `Email: ${input.contactEmail}` : '',
        input.contactPhone ? `Phone: ${input.contactPhone}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      metadata: {
        assignedToAgent: 'liaison',
        workflow: 'vendor_reply_triage',
        quoteRequestId: trackToken.quoteRequestId ?? null,
        dealId: trackToken.dealId ?? null,
        trackToken: trackToken.token,
        message: input.message,
        contactName: input.contactName ?? null,
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ?? null,
        receivedAt: new Date().toISOString(),
      },
    },
  });

  // Append a quiet note to the timeline so the board can see vendor activity.
  // Visibility = 'internal' — we don't show "vendor said X" publicly until
  // Liaison + board have triaged it.
  if (trackToken.quoteRequestId || trackToken.dealId) {
    await database.dealUpdate
      .create({
        data: {
          quoteRequestId: trackToken.quoteRequestId ?? null,
          dealId: trackToken.dealId ?? null,
          kind: 'note',
          title: 'Vendor reply received',
          detail: 'Held for Liaison triage + board approval before reply.',
          visibility: 'internal',
          notifiedBy: 'vendor_track_page',
        },
      })
      .catch(() => undefined);
  }

  return NextResponse.json({ ok: true, actionId: action.id });
};

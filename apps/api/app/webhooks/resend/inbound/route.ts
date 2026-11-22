import { env } from '@/env';
import { database } from '@repo/database';
import { bareAddress, htmlToText } from '@repo/email/addresses';
import { findEmailLinks, recordEmail } from '@repo/email/log';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { z } from 'zod';

/**
 * POST /webhooks/resend/inbound
 *
 * Resend's `email.received` webhook. This is how a seller's reply gets into
 * the dashboard /inbox.
 *
 * The path a reply takes:
 *   1. Every email we send carries Reply-To: the one live mailbox
 *      (sam@wearekept.co.uk, Google Workspace). The founder still sees every
 *      reply in Gmail; nothing depends on this route to not lose mail.
 *   2. A Gmail forwarding rule copies each message to our Resend receiving
 *      address. Resend POSTs the metadata here.
 *   3. The webhook carries no body, so we fetch it from Resend, store one
 *      EmailMessage row, and raise a FounderAction if we know the sender.
 *
 * Auth: Svix signature over the RAW body (RESEND_INBOUND_WEBHOOK_SECRET).
 * Re-serialising the JSON would break the signature, so we read text.
 *
 * Replay-safe: `providerId` is unique and checked first, and the
 * FounderAction carries a dedupKey.
 *
 * Setup steps (DNS, Gmail rule, env vars): docs/setup/email-inbox.md.
 */

export const maxDuration = 60;

const EventSchema = z.object({
  type: z.string(),
  data: z
    .object({
      email_id: z.string().min(1),
      from: z.string(),
      to: z.array(z.string()).default([]),
      subject: z.string().nullish(),
      message_id: z.string().nullish(),
      attachments: z.array(z.unknown()).nullish(),
    })
    .passthrough(),
});

const ReceivedSchema = z
  .object({
    text: z.string().nullish(),
    html: z.string().nullish(),
    headers: z.record(z.unknown()).nullish(),
  })
  .passthrough();

type FetchedBody = {
  text: string | null;
  html: string | null;
  inReplyTo: string | null;
  /** Set when the body could not be fetched; shown in place of the body. */
  problem: string | null;
};

/**
 * The webhook is metadata only; the content lives behind
 * GET /emails/receiving/{id}. Raw fetch because the pinned SDK (resend@4)
 * predates receiving. A failure here must not lose the message: we still
 * store the row and say plainly that the body is missing and why.
 */
async function fetchBody(emailId: string): Promise<FetchedBody> {
  const empty = { text: null, html: null, inReplyTo: null };
  if (!env.RESEND_TOKEN) {
    return { ...empty, problem: 'RESEND_TOKEN is not set on bellwood-api.' };
  }
  try {
    const res = await fetch(
      `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
      {
        headers: { Authorization: `Bearer ${env.RESEND_TOKEN}` },
        signal: AbortSignal.timeout(30_000),
      }
    );
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return {
        ...empty,
        problem: `Resend returned ${res.status} when asked for the body. A sending-only API key cannot read received mail; the key needs full access. ${detail}`,
      };
    }
    const parsed = ReceivedSchema.safeParse(await res.json());
    if (!parsed.success) {
      return { ...empty, problem: 'Resend returned a body we could not read.' };
    }
    // Header keys arrive lower-cased, but do not rely on it.
    const headers = Object.fromEntries(
      Object.entries(parsed.data.headers ?? {}).map(([k, v]) => [
        k.toLowerCase(),
        v,
      ])
    );
    const inReplyTo = headers['in-reply-to'];
    return {
      text: parsed.data.text ?? null,
      html: parsed.data.html ?? null,
      inReplyTo: typeof inReplyTo === 'string' ? inReplyTo : null,
      problem: null,
    };
  } catch (err) {
    return {
      ...empty,
      problem: `Could not reach Resend for the body: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

export const POST = async (request: Request): Promise<Response> => {
  if (!env.RESEND_INBOUND_WEBHOOK_SECRET) {
    // 503, not 200: Resend retries, so mail sent before the secret is set
    // arrives once it is, instead of being acknowledged and dropped.
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rawBody = await request.text();
  let verified: unknown;
  try {
    verified = new Webhook(env.RESEND_INBOUND_WEBHOOK_SECRET).verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = EventSchema.safeParse(verified);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  if (parsed.data.type !== 'email.received') {
    return NextResponse.json({ success: true, ignored: parsed.data.type });
  }

  const event = parsed.data.data;
  const sender = bareAddress(event.from);
  if (!sender) {
    // No usable sender means no thread to file it under. Say so loudly
    // rather than inventing one.
    console.error('[resend/inbound] no sender address', {
      emailId: event.email_id,
      from: event.from,
    });
    return NextResponse.json(
      { error: 'No sender address in event' },
      { status: 400 }
    );
  }

  // Loop guard. The Gmail rule forwards everything the mailbox receives,
  // which includes the app's own notifications to the founder. Those are
  // already in the log as outbound rows; filing them again as "inbound"
  // would bury real replies.
  const ownSender = bareAddress(env.RESEND_FROM);
  if (ownSender && sender === ownSender) {
    return NextResponse.json({ success: true, ignored: 'own-sender' });
  }

  const existing = await database.emailMessage.findUnique({
    where: { providerId: event.email_id },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ success: true, duplicate: true });
  }

  const [body, links, priorOutbound] = await Promise.all([
    fetchBody(event.email_id),
    findEmailLinks(sender),
    database.emailMessage.count({
      where: { counterparty: sender, direction: 'outbound' },
    }),
  ]);

  const subject = event.subject?.trim() || '(no subject)';
  const text = body.problem
    ? `[The body of this email could not be fetched. ${body.problem} The original is in the Gmail mailbox.]`
    : (body.text ?? (body.html ? htmlToText(body.html) : null));

  const row = await recordEmail({
    direction: 'inbound',
    counterparty: sender,
    fromAddress: event.from,
    toAddress: event.to.join(', '),
    subject,
    textBody: text,
    htmlBody: body.html,
    providerId: event.email_id,
    messageId: event.message_id ?? null,
    inReplyTo: body.inReplyTo,
    attachmentCount: event.attachments?.length ?? 0,
    links,
  });

  // Only people we already deal with raise a card: someone we have emailed,
  // or the contact on a deal or quote. Everything else still lands in
  // /inbox, but a newsletter must not page the founder.
  const known =
    priorOutbound > 0 || links.dealId !== null || links.quoteRequestId !== null;
  if (known) {
    const link = `/inbox/${encodeURIComponent(sender)}`;
    await database.founderAction
      .create({
        data: {
          type: 'general',
          priority: 'high',
          status: 'pending',
          agent: 'system',
          title: `Email reply from ${sender}`,
          description: [
            `Subject: ${subject}`,
            '',
            (text ?? '').slice(0, 600),
            '',
            `Read and reply: ${link}`,
          ].join('\n'),
          dealId: links.dealId,
          dedupKey: `email-inbound:${event.email_id}`,
          metadata: {
            link,
            sourceType: 'email_inbound',
            emailMessageId: row.id,
            fromEmail: sender,
            quoteRequestId: links.quoteRequestId,
          },
        },
      })
      .catch((err) => {
        // The message is stored and visible in /inbox either way.
        console.warn('[resend/inbound] FounderAction create failed', err);
      });
  }

  return NextResponse.json({
    success: true,
    id: row.id,
    known,
    bodyFetched: body.problem === null,
  });
};

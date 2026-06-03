/**
 * Send a signed binding-offer email.
 *
 * Called from the Approve & Send server action on `/quotes/[id]`. Wraps
 * the email dispatch, the deal-timeline event, and the FounderAction
 * completion in one shot so the UI only has one moving part.
 */

import 'server-only';

import * as React from 'react';

import { database } from '@repo/database';
import { sendEmail } from '@repo/email';
import { recordDealUpdate } from '@repo/deal-updates';
import { SignedOfferEmail } from '@repo/email/templates/signed-offer';

import type { SendSignedOfferInput, SendSignedOfferResult } from './types';

function formatGBP(pence: number | null | undefined): string {
  if (pence == null) return '—';
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

function firstName(name?: string | null): string | undefined {
  if (!name) return undefined;
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const first = trimmed.split(/\s+/)[0];
  return first;
}

/**
 * Lookup the FounderAction, read `signedOfferUrl` from its metadata, mail
 * the agent, write a DealUpdate (`kind: 'offer_sent'`) and mark the action
 * completed. Designed to be idempotent enough to retry: a second call after
 * `status === 'completed'` short-circuits.
 */
export async function sendSignedOffer(
  input: SendSignedOfferInput,
): Promise<SendSignedOfferResult> {
  const action = await database.founderAction.findUnique({
    where: { id: input.founderActionId },
  });
  if (!action) {
    throw new Error(`FounderAction ${input.founderActionId} not found`);
  }
  if (action.status === 'completed') {
    return { sent: false, emailSkipped: true, reason: 'already_completed' };
  }

  const quote = await database.quoteRequest.findUnique({
    where: { id: input.quoteId },
    include: { offer: true },
  });
  if (!quote) {
    throw new Error(`QuoteRequest ${input.quoteId} not found`);
  }

  // Pull metadata-derived numbers (cron stashes them). Fall back to the
  // live QuoteOffer if absent.
  const meta = (action.metadata ?? {}) as Record<string, unknown>;
  const newOfferPence =
    typeof meta.newOfferPence === 'number'
      ? (meta.newOfferPence as number)
      : (quote.offer?.offerPence ?? null);

  const offerFormatted = formatGBP(newOfferPence);

  const agentFirstName = firstName(quote.contactName);
  const recipient = quote.contactEmail;

  const subject = `Signed binding offer — ${quote.address}`;

  const emailResult = await sendEmail({
    to: recipient,
    subject,
    html: undefined,
    text: [
      `${agentFirstName ? `Hi ${agentFirstName},` : 'Hello,'}`,
      '',
      `Attached is our signed binding offer for ${quote.address} at ${offerFormatted}.`,
      '',
      'Walk-away cover of £1,000 applies if anything changes our side after acceptance. Subject only to the carve-outs in the letter, this is firm cash, no chain, no finance condition.',
      '',
      'Reply if anything needs adjusting and we will respond before the next working day.',
      '',
      `Signed PDF: ${input.signedOfferUrl}`,
      '',
      'Sam — Bellwood Ventures',
    ].join('\n'),
  }).catch((err: unknown) => {
    console.warn('[quote-ops/send-signed-offer] email send failed', err);
    return { skipped: true as const, reason: 'error' };
  });

  // Render a richer HTML body via the React Email template on success path
  // (the plain-text above is what Resend will actually send because we did
  // not pass `react`/`html`. We keep the text-only path because it lets us
  // remain framework-agnostic and avoids importing React Email's render
  // helper in this hot path.)
  // The React component is still exported from `@repo/email/templates/...`
  // for the upcoming `/instant-offer` UI to reuse.
  void React.version;
  void SignedOfferEmail;

  const emailSkipped =
    typeof emailResult === 'object' &&
    emailResult !== null &&
    'skipped' in emailResult &&
    (emailResult as { skipped?: boolean }).skipped === true;

  // Record the timeline event regardless of email outcome — the founder
  // still wants to see "offer_sent" on the deal page.
  const recorded = await recordDealUpdate({
    quoteRequestId: input.quoteId,
    kind: 'offer_sent',
    title: `Signed offer issued: ${offerFormatted}`,
    detail: `Signed binding PDF sent to ${recipient}.`,
    metadata: {
      signedOfferUrl: input.signedOfferUrl,
      offerPence: newOfferPence,
      founderActionId: action.id,
    },
    notifiedBy: `quote-ops:approve-and-send`,
    // Don't double-notify the agent — sendEmail above already did it.
    skipNotify: true,
  }).catch((err: unknown) => {
    console.warn('[quote-ops/send-signed-offer] recordDealUpdate failed', err);
    return null;
  });

  await database.founderAction.update({
    where: { id: action.id },
    data: {
      status: 'completed',
      resolvedAt: new Date(),
    },
  });

  return {
    sent: !emailSkipped,
    emailSkipped,
    reason:
      emailSkipped && typeof emailResult === 'object' && emailResult !== null && 'reason' in emailResult
        ? String((emailResult as { reason?: unknown }).reason ?? 'unknown')
        : undefined,
    dealUpdateId: recorded?.id,
  };
}

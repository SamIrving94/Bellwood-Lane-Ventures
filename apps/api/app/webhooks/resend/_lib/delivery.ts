import { database } from '@repo/database';
import {
  type DeliveryStatus,
  deliveryLabel,
  deliveryReason,
  isDeliveryProblem,
  shouldReplaceStatus,
} from '@repo/email/delivery';

/**
 * What Resend says happened to an email we sent: delivered, delayed,
 * bounced, marked as spam, failed.
 *
 * Why this exists: until now a send was "fire and hope". A seller's address
 * with a typo bounced and nobody knew; the welcome email simply never
 * arrived. Now the status sits on the EmailMessage row, and a bounce, a
 * failure or a spam report raises one card in Today.
 *
 * Only emails in the correspondence log are tracked. Internal notifications
 * (sends to our own domains) are not logged, so their events are ignored.
 */

export type DeliveryOutcome =
  | { tracked: false; reason: 'not-logged' }
  | { tracked: true; status: DeliveryStatus; changed: boolean; card: boolean };

const WHAT_TO_DO: Record<'bounced' | 'failed' | 'complained', string> = {
  bounced:
    'The address rejected it. Check the address for a typo, or reach them by phone.',
  failed:
    'Resend could not send it. Nothing reached the recipient. Check the address, then send again.',
  complained:
    'They marked our email as spam. Do not email this address again without speaking to them first.',
};

export async function recordDeliveryEvent(input: {
  emailId: string;
  status: DeliveryStatus;
  data: Record<string, unknown>;
  at: Date;
}): Promise<DeliveryOutcome> {
  const row = await database.emailMessage.findUnique({
    where: { providerId: input.emailId },
    select: {
      id: true,
      direction: true,
      counterparty: true,
      subject: true,
      dealId: true,
      quoteRequestId: true,
      deliveryStatus: true,
    },
  });
  if (!row || row.direction !== 'outbound') {
    return { tracked: false, reason: 'not-logged' };
  }

  if (!shouldReplaceStatus(row.deliveryStatus, input.status)) {
    // An older or repeated event. The row already says something later.
    return {
      tracked: true,
      status: row.deliveryStatus ?? input.status,
      changed: false,
      card: false,
    };
  }

  const detail = deliveryReason(input.data);
  await database.emailMessage.update({
    where: { id: row.id },
    data: {
      deliveryStatus: input.status,
      deliveryDetail: detail,
      deliveryAt: input.at,
    },
  });

  if (!isDeliveryProblem(input.status)) {
    return { tracked: true, status: input.status, changed: true, card: false };
  }

  const link = `/inbox/${encodeURIComponent(row.counterparty)}`;
  const problem = input.status as 'bounced' | 'failed' | 'complained';
  await database.founderAction
    .create({
      data: {
        type: 'general',
        priority: 'high',
        status: 'pending',
        agent: 'system',
        title: `${deliveryLabel(input.status)}: email to ${row.counterparty}`,
        description: [
          `Subject: ${row.subject}`,
          detail ? `Reason given: ${detail}` : 'No reason was given.',
          '',
          WHAT_TO_DO[problem],
          '',
          `See the conversation: ${link}`,
        ].join('\n'),
        dealId: row.dealId,
        // One card per email per problem, however often Resend retries.
        dedupKey: `email-delivery:${input.emailId}:${input.status}`,
        metadata: {
          link,
          sourceType: 'email_delivery',
          emailMessageId: row.id,
          toEmail: row.counterparty,
          deliveryStatus: input.status,
          quoteRequestId: row.quoteRequestId,
        },
      },
    })
    .catch((err) => {
      // A unique-key clash here is the dedup doing its job on a replay.
      // The status is on the row and visible in /inbox either way.
      console.warn('[resend/delivery] FounderAction not created', err);
    });

  return { tracked: true, status: input.status, changed: true, card: true };
}

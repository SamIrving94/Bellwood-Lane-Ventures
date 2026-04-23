'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { sendEmail } from '@repo/email';
import { log } from '@repo/observability/log';
import { revalidatePath } from 'next/cache';

export async function approveHold(holdId: string, editedBody?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // Stage 1: mark approved + persist any founder edits before sending.
  const hold = await database.outreachHold.update({
    where: { id: holdId },
    data: {
      status: 'approved',
      reviewedBy: userId,
      reviewedAt: new Date(),
      editedBody: editedBody ?? undefined,
    },
  });

  if (!hold.recipientEmail) {
    log.warn('approveHold: no recipient email, marking sent without dispatch', {
      holdId,
    });
    await database.outreachHold.update({
      where: { id: holdId },
      data: { status: 'sent' },
    });
    revalidatePath('/outreach/holds');
    revalidatePath('/actions');
    return { sent: false, reason: 'no-email' as const };
  }

  // Stage 2: actually dispatch via Resend. Founder edits (if any) win over
  // the originally rendered body.
  const body = hold.editedBody ?? hold.renderedBody;

  try {
    const result = await sendEmail({
      to: hold.recipientEmail,
      subject: hold.renderedSubject,
      text: body,
    });

    await database.outreachHold.update({
      where: { id: holdId },
      data: { status: 'sent' },
    });

    // Mirror the recipient row so campaign analytics stay accurate.
    await database.outreachRecipient
      .update({
        where: { id: hold.recipientId },
        data: {
          status: 'sent',
          lastSentAt: new Date(),
        },
      })
      .catch((err) => {
        // Recipient may have been deleted — log and continue.
        log.warn('approveHold: failed to update recipient row', {
          holdId,
          recipientId: hold.recipientId,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    // Record the Resend message id (if any) against the agent event log so
    // it's recoverable later.
    await database.agentEvent.create({
      data: {
        agent: 'marketer',
        eventType: 'outreach_hold_sent',
        summary: `Vendor email sent to ${hold.recipientEmail} after founder review`,
        count: 1,
        payload: {
          holdId,
          recipientId: hold.recipientId,
          to: hold.recipientEmail,
          messageId: result.skipped ? null : result.messageId,
          skipped: result.skipped ? result.reason : null,
          reviewedBy: userId,
        },
      },
    });

    revalidatePath('/outreach/holds');
    revalidatePath('/actions');

    return result.skipped
      ? ({ sent: false, reason: 'skipped' as const, detail: result.reason })
      : ({ sent: true, messageId: result.messageId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('approveHold: send failed', { holdId, error: message });

    // Roll back to `approved` so the founder can retry — do NOT leave it
    // marked `sent` if the dispatch blew up.
    await database.outreachHold.update({
      where: { id: holdId },
      data: { status: 'approved' },
    });

    revalidatePath('/outreach/holds');
    revalidatePath('/actions');
    throw new Error(`Failed to send approved hold: ${message}`);
  }
}

export async function rejectHold(holdId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  await database.outreachHold.update({
    where: { id: holdId },
    data: {
      status: 'rejected',
      reviewedBy: userId,
      reviewedAt: new Date(),
    },
  });

  revalidatePath('/outreach/holds');
  revalidatePath('/actions');
}

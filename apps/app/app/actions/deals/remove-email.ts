'use server';

import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

/**
 * Take one email out of the log: it is not deal mail, or it should not be
 * here. Emails arrive without anyone choosing to log them, so there has to
 * be a way to take one back.
 *
 * The content is wiped, and the row stays behind as a tombstone (Gmail id
 * only). Without it the next sync would see the same email in Gmail, see
 * that it still matches, and bring it straight back. Gmail itself is not
 * touched: the email is still in the mailbox.
 */
export async function removeDealEmail(formData: FormData): Promise<void> {
  const { userId } = await requireFounder();

  const emailId = String(formData.get('emailId') ?? '');
  if (!emailId) {
    throw new Error('No email chosen.');
  }

  const email = await database.dealEmail.findUnique({
    where: { id: emailId },
    select: { dealId: true, threadKey: true, subject: true, removedAt: true },
  });
  if (!email || email.removedAt) {
    // Already gone (a double click, or the other founder got there first).
    revalidatePath('/deals/email-log');
    return;
  }

  await database.dealEmail.update({
    where: { id: emailId },
    data: {
      removedAt: new Date(),
      dealId: null,
      matchedBy: null,
      fromName: null,
      toEmails: [],
      ccEmails: [],
      subject: '',
      bodyText: '',
      replyText: null,
      summary: null,
      party: null,
      needsReply: null,
      nextStep: null,
      attachments: [],
    },
  });

  if (email.dealId) {
    await database.dealActivity.create({
      data: {
        dealId: email.dealId,
        action: 'email_removed',
        detail: email.subject || '(no subject)',
        userId,
      },
    });
    revalidatePath(`/deals/${email.dealId}`);
  } else {
    // The last unfiled email of a conversation takes its card with it.
    const left = await database.dealEmail.count({
      where: { threadKey: email.threadKey, dealId: null, removedAt: null },
    });
    if (left === 0) {
      await database.founderAction.updateMany({
        where: {
          dedupKey: `deal_email_unfiled:${email.threadKey}`,
          status: { in: ['pending', 'in_progress'] },
        },
        data: {
          status: 'dismissed',
          resolvedBy: userId,
          resolvedAt: new Date(),
        },
      });
    }
  }

  revalidatePath('/deals/email-log');
}

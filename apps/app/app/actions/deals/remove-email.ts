'use server';

import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import { del } from '@repo/storage';
import { revalidatePath } from 'next/cache';

/**
 * Take one email out of the log: it is not deal mail, or it should never
 * have been captured. With the automatic copy on, emails arrive without
 * anyone choosing to log them, so there has to be a way to take one back.
 *
 * Deletes the row and its stored attachments. The founder's own mailbox
 * still has the email; this only removes OUR copy. It cannot be undone.
 */
export async function removeDealEmail(formData: FormData): Promise<void> {
  const { userId } = await requireFounder();

  const emailId = String(formData.get('emailId') ?? '');
  if (!emailId) {
    throw new Error('No email chosen.');
  }

  const email = await database.dealEmail.findUnique({
    where: { id: emailId },
    select: {
      dealId: true,
      threadKey: true,
      subject: true,
      attachments: true,
    },
  });
  if (!email) {
    // Already gone (a double click, or the other founder got there first).
    revalidatePath('/deals/email-log');
    return;
  }

  const urls = Array.isArray(email.attachments)
    ? email.attachments
        .map((a) => (a as { url?: unknown } | null)?.url)
        .filter((url): url is string => typeof url === 'string')
    : [];
  if (urls.length > 0) {
    try {
      await del(urls);
    } catch (err) {
      // The row still goes. A file left behind sits at a link nobody can
      // guess and nothing shows any more; say so in the logs.
      console.warn('[remove-email] could not delete stored attachments', err);
    }
  }

  await database.dealEmail.delete({ where: { id: emailId } });

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
      where: { threadKey: email.threadKey, dealId: null },
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

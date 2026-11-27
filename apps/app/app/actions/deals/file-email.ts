'use server';

import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

/**
 * Put a logged email on a deal by hand: an unfiled one, or one the importer
 * placed wrongly. The whole conversation moves with it, because a thread is
 * about one home, and the "needs a deal" card for the thread closes.
 */
export async function fileDealEmail(formData: FormData): Promise<void> {
  const { userId } = await requireFounder();

  const emailId = String(formData.get('emailId') ?? '');
  const dealId = String(formData.get('dealId') ?? '');
  if (!emailId || !dealId) {
    throw new Error('Pick a deal first.');
  }

  const [email, deal] = await Promise.all([
    database.dealEmail.findUnique({
      where: { id: emailId },
      select: { threadKey: true, subject: true },
    }),
    database.deal.findUnique({ where: { id: dealId }, select: { id: true } }),
  ]);
  if (!email) {
    throw new Error('Email not found.');
  }
  if (!deal) {
    throw new Error('Deal not found.');
  }

  // Removed emails in the thread stay removed.
  const inThread = { threadKey: email.threadKey, removedAt: null };
  const thread = await database.dealEmail.findMany({
    where: inThread,
    select: { dealId: true },
  });
  await database.dealEmail.updateMany({
    where: inThread,
    data: { dealId, matchedBy: 'manual' },
  });

  await database.founderAction.updateMany({
    where: {
      dedupKey: `deal_email_unfiled:${email.threadKey}`,
      status: { in: ['pending', 'in_progress'] },
    },
    data: { status: 'completed', resolvedBy: userId, resolvedAt: new Date() },
  });

  await database.dealActivity.create({
    data: {
      dealId,
      action: 'email_filed',
      detail: `${thread.length} email${thread.length === 1 ? '' : 's'}: ${email.subject || '(no subject)'}`,
      userId,
    },
  });

  revalidatePath('/deals/email-log');
  revalidatePath(`/deals/${dealId}`);
  for (const previous of new Set(thread.map((row) => row.dealId))) {
    if (previous && previous !== dealId) {
      revalidatePath(`/deals/${previous}`);
    }
  }
}

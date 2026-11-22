'use server';

import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

/**
 * Put a logged email on a deal by hand: an unfiled one, or one the matcher
 * placed wrongly. The whole conversation moves with it, because a thread is
 * about one home. Documents read from those emails follow, and the "needs a
 * deal" card for the thread closes.
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
      select: { threadKey: true, dealId: true, subject: true },
    }),
    database.deal.findUnique({ where: { id: dealId }, select: { id: true } }),
  ]);
  if (!email) {
    throw new Error('Email not found.');
  }
  if (!deal) {
    throw new Error('Deal not found.');
  }

  const thread = await database.dealEmail.findMany({
    where: { threadKey: email.threadKey },
    select: { dealId: true, attachments: true },
  });

  await database.dealEmail.updateMany({
    where: { threadKey: email.threadKey },
    data: { dealId, matchedBy: 'manual' },
  });

  const extractIds = thread.flatMap((row) =>
    Array.isArray(row.attachments)
      ? row.attachments
          .map((a) => (a as { extractId?: unknown } | null)?.extractId)
          .filter((id): id is string => typeof id === 'string')
      : []
  );
  if (extractIds.length > 0) {
    await database.documentExtract.updateMany({
      where: { id: { in: extractIds } },
      data: { dealId },
    });
  }

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

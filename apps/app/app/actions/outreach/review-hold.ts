'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

export async function approveHold(holdId: string, editedBody?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  await database.outreachHold.update({
    where: { id: holdId },
    data: {
      status: editedBody ? 'approved' : 'approved',
      reviewedBy: userId,
      reviewedAt: new Date(),
      editedBody: editedBody ?? undefined,
    },
  });

  // TODO: Wire up @repo/email (Resend) to actually send the email
  // For now, mark as approved and update status to 'sent'
  await database.outreachHold.update({
    where: { id: holdId },
    data: { status: 'sent' },
  });

  revalidatePath('/outreach/holds');
  revalidatePath('/actions');
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

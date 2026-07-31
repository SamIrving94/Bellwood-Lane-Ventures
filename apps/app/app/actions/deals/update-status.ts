'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { DealStatus } from '@repo/database/generated/client';
import { revalidatePath } from 'next/cache';

export async function updateDealStatus(dealId: string, newStatus: DealStatus) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const deal = await database.deal.findUnique({
    where: { id: dealId },
    select: { status: true },
  });

  if (!deal) throw new Error('Deal not found');

  const oldStatus = deal.status;

  await database.deal.update({
    where: { id: dealId },
    data: {
      status: newStatus,
      stageEnteredAt: new Date(),
    },
  });

  await database.dealActivity.create({
    data: {
      dealId,
      action: 'status_change',
      detail: `Moved from ${oldStatus.replace('_', ' ')} to ${newStatus.replace('_', ' ')}`,
      userId,
    },
  });

  revalidatePath('/pipeline');
  revalidatePath(`/deals/${dealId}`);
  revalidatePath('/');
}

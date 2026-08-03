'use server';

import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import type { DealStatus } from '@repo/database/generated/client';
import { LEGAL_STEPS } from '@repo/database/legal-steps';
import { revalidatePath } from 'next/cache';

export async function updateDealStatus(dealId: string, newStatus: DealStatus) {
  const { userId } = await requireFounder();

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

  // Going under offer starts the legal clock: seed the conveyancing
  // checklist so the legal-chaser cron has something to drive. Idempotent —
  // (dealId, stepKey) is unique.
  if (newStatus === 'under_offer') {
    await database.legalStep.createMany({
      data: LEGAL_STEPS.map((s) => ({ dealId, stepKey: s.key })),
      skipDuplicates: true,
    });
  }

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

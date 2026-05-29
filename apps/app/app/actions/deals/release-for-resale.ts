'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

/**
 * Horizon 2 guardrail. A deal only becomes shareable to investors / referral
 * partners AFTER Bellwood passes on it for its own book. This action is the
 * single gate that flips `releasedForResale`: it marks the deal `rejected`
 * (we passed), records who released it and why, and logs the decision to the
 * activity timeline. Until this runs, nothing leaves the pipeline.
 */
export async function releaseForResale(
  dealId: string,
  reason: string,
  resalePricePence?: number,
) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  if (!reason.trim()) throw new Error('Add a reason — why are we passing?');

  const deal = await database.deal.findUnique({
    where: { id: dealId },
    select: { id: true, releasedForResale: true, status: true },
  });
  if (!deal) throw new Error('Deal not found');
  if (deal.releasedForResale) throw new Error('Deal is already released.');

  await database.deal.update({
    where: { id: dealId },
    data: {
      status: 'rejected', // Bellwood has passed on it for its own book
      releasedForResale: true,
      releasedAt: new Date(),
      releasedBy: userId,
      resaleReason: reason.trim().slice(0, 1000),
      resalePricePence: resalePricePence ?? null,
    },
  });

  await database.dealActivity.create({
    data: {
      dealId,
      action: 'released_for_resale',
      detail: `Passed for own book and released to investor feed. Reason: ${reason.trim()}`,
      userId,
    },
  });

  revalidatePath(`/deals/${dealId}`);
  revalidatePath('/pipeline');
  revalidatePath('/investors');

  return { released: true };
}

/**
 * Pull a deal back off the investor feed (e.g. released by mistake, or we want
 * it back for our own book). Reverts the flag; status is left for the founder
 * to reset manually since the right next stage depends on context.
 */
export async function unreleaseForResale(dealId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const deal = await database.deal.findUnique({
    where: { id: dealId },
    select: { id: true, releasedForResale: true },
  });
  if (!deal) throw new Error('Deal not found');
  if (!deal.releasedForResale) throw new Error('Deal is not released.');

  await database.deal.update({
    where: { id: dealId },
    data: {
      releasedForResale: false,
      releasedAt: null,
      releasedBy: null,
    },
  });

  await database.dealActivity.create({
    data: {
      dealId,
      action: 'unreleased_for_resale',
      detail: 'Pulled back off the investor feed.',
      userId,
    },
  });

  revalidatePath(`/deals/${dealId}`);
  revalidatePath('/investors');

  return { released: false };
}

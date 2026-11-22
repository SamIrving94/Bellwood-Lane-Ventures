'use server';

import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import type { DealStatus } from '@repo/database/generated/client';
import { LEGAL_STEPS } from '@repo/database/legal-steps';
import { ensureDealFolder } from '@repo/google';
import { log } from '@repo/observability/log';
import { revalidatePath } from 'next/cache';

const DRIVE_FOLDER_STAGES = new Set<DealStatus>([
  'valuation',
  'offer_made',
  'under_offer',
  'exchanged',
]);

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

  // From valuation onwards a deal collects paperwork, so it gets its Drive
  // folder (Photos, Legal, Offer, Comps). Skips when Google is not
  // connected; never blocks the status change.
  if (DRIVE_FOLDER_STAGES.has(newStatus)) {
    await ensureDealFolder(dealId).catch((err) => {
      log.warn('deal drive folder failed', {
        dealId,
        error: err instanceof Error ? err.message : String(err),
      });
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

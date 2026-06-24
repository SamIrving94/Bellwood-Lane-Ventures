'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { SourcingFeeStatus } from '@repo/database/generated/client';
import { revalidatePath } from 'next/cache';

/**
 * Line 2 — record the investor sourcing fee on a released deal. This is the
 * money outcome of the sourcing channel: who took the deal, for how much, and
 * where the fee is in its lifecycle (proposed → agreed → invoiced → paid).
 *
 * We stamp the lifecycle timestamps the first time a status is reached and
 * leave them once set, so the Book/feed can report "paid in May" accurately.
 * Only deals released to the investor feed can carry a fee.
 */
export type SourcingFeeInput = {
  feePence?: number | null;
  status: SourcingFeeStatus;
  sourcedToName?: string | null;
  sourcedToEmail?: string | null;
};

function money(v: number | null | undefined): number | null {
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  const n = Math.round(v);
  if (n < 0) throw new Error('Fee cannot be negative.');
  return n;
}

export async function recordSourcingFee(
  dealId: string,
  input: SourcingFeeInput,
) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const deal = await database.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      releasedForResale: true,
      sourcingAgreedAt: true,
      sourcingInvoicedAt: true,
      sourcingPaidAt: true,
    },
  });
  if (!deal) throw new Error('Deal not found');
  if (!deal.releasedForResale) {
    throw new Error('Release the deal to the investor feed first.');
  }

  const status = input.status;
  const feePence = money(input.feePence);

  if (status !== 'none' && status !== 'proposed' && feePence === null) {
    throw new Error('Set the fee amount before marking it agreed.');
  }

  // Stamp lifecycle timestamps the first time each stage is reached; clear them
  // if the status is rolled back below that stage.
  const reached = (s: SourcingFeeStatus) => {
    const order: SourcingFeeStatus[] = [
      'none',
      'proposed',
      'agreed',
      'invoiced',
      'paid',
    ];
    return order.indexOf(status) >= order.indexOf(s);
  };

  const now = new Date();

  await database.deal.update({
    where: { id: dealId },
    data: {
      sourcingFeePence: feePence,
      sourcingFeeStatus: status,
      sourcedToName: input.sourcedToName?.trim().slice(0, 200) || null,
      sourcedToEmail: input.sourcedToEmail?.trim().toLowerCase() || null,
      sourcingAgreedAt: reached('agreed')
        ? (deal.sourcingAgreedAt ?? now)
        : null,
      sourcingInvoicedAt: reached('invoiced')
        ? (deal.sourcingInvoicedAt ?? now)
        : null,
      sourcingPaidAt: reached('paid') ? (deal.sourcingPaidAt ?? now) : null,
    },
  });

  await database.dealActivity.create({
    data: {
      dealId,
      action: 'sourcing_fee_updated',
      detail:
        feePence !== null
          ? `Sourcing fee ${status} — £${(feePence / 100).toLocaleString('en-GB')}${
              input.sourcedToName ? ` (${input.sourcedToName.trim()})` : ''
            }.`
          : `Sourcing fee status: ${status}.`,
      userId,
    },
  });

  revalidatePath(`/deals/${dealId}`);
  revalidatePath('/investors');

  return { ok: true };
}

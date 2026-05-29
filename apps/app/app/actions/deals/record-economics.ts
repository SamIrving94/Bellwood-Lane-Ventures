'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

/**
 * Line 1 — record the *actuals* for a deal Bellwood buys for its own book:
 * what we paid, what it cost us, and what we sold it for. This is the trade
 * P&L the system was missing. We store realisedProfitPence (exit − acquisition
 * − all costs) so the Book/Portfolio view can sum it cheaply, and so the AVM
 * can later be checked against the real sale price.
 *
 * All amounts arrive in PENCE. Any field left undefined is cleared (null) so
 * the founder can correct mistakes by blanking a box.
 */
export type DealEconomicsInput = {
  acquisitionPricePence?: number | null;
  acquiredAt?: string | null; // ISO date (yyyy-mm-dd)
  refurbCostPence?: number | null;
  legalFeesPence?: number | null;
  otherCostsPence?: number | null;
  exitPricePence?: number | null;
  exitedAt?: string | null; // ISO date (yyyy-mm-dd)
};

// Coerce a possibly-empty numeric input to a clean non-negative integer or null.
function money(v: number | null | undefined): number | null {
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  const n = Math.round(v);
  return n < 0 ? 0 : n;
}

function date(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function recordDealEconomics(
  dealId: string,
  input: DealEconomicsInput,
) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const deal = await database.deal.findUnique({
    where: { id: dealId },
    select: { id: true },
  });
  if (!deal) throw new Error('Deal not found');

  const acquisitionPricePence = money(input.acquisitionPricePence);
  const refurbCostPence = money(input.refurbCostPence);
  const legalFeesPence = money(input.legalFeesPence);
  const otherCostsPence = money(input.otherCostsPence);
  const exitPricePence = money(input.exitPricePence);

  // Realised profit only makes sense once we know both ends of the trade.
  let realisedProfitPence: number | null = null;
  if (acquisitionPricePence !== null && exitPricePence !== null) {
    const costs =
      (refurbCostPence ?? 0) + (legalFeesPence ?? 0) + (otherCostsPence ?? 0);
    realisedProfitPence = exitPricePence - acquisitionPricePence - costs;
  }

  await database.deal.update({
    where: { id: dealId },
    data: {
      acquisitionPricePence,
      acquiredAt: date(input.acquiredAt),
      refurbCostPence,
      legalFeesPence,
      otherCostsPence,
      exitPricePence,
      exitedAt: date(input.exitedAt),
      realisedProfitPence,
    },
  });

  await database.dealActivity.create({
    data: {
      dealId,
      action: 'economics_updated',
      detail:
        realisedProfitPence !== null
          ? `Recorded trade economics. Realised profit: £${(realisedProfitPence / 100).toLocaleString('en-GB')}.`
          : 'Updated trade economics.',
      userId,
    },
  });

  revalidatePath(`/deals/${dealId}`);
  revalidatePath('/book');

  return { realisedProfitPence };
}

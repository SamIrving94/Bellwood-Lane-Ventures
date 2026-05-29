'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { recordDealUpdate } from '@repo/deal-updates';
import { revalidatePath } from 'next/cache';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * B-3 — register an investor's interest in a released deal. The interest row
 * doubles as the notification subscription: with notify=true the investor
 * receives live DealUpdate emails (B-2). A deal must be released to the feed
 * first (Bellwood has passed on it for its own book).
 */
export async function registerInvestorInterest(
  dealId: string,
  investorName: string,
  investorEmail: string,
  note?: string,
  notify = true,
) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  if (!investorName.trim()) throw new Error('Investor name is required.');
  if (!EMAIL_RE.test(investorEmail.trim())) {
    throw new Error('A valid investor email is required.');
  }

  const deal = await database.deal.findUnique({
    where: { id: dealId },
    select: { id: true, releasedForResale: true },
  });
  if (!deal) throw new Error('Deal not found');
  if (!deal.releasedForResale) {
    throw new Error('Release the deal to the investor feed first.');
  }

  await database.investorInterest.upsert({
    where: {
      dealId_investorEmail: {
        dealId,
        investorEmail: investorEmail.trim().toLowerCase(),
      },
    },
    create: {
      dealId,
      investorName: investorName.trim(),
      investorEmail: investorEmail.trim().toLowerCase(),
      note: note?.trim().slice(0, 1000) || null,
      notify,
      createdBy: userId,
    },
    update: {
      investorName: investorName.trim(),
      note: note?.trim().slice(0, 1000) || null,
      notify,
    },
  });

  revalidatePath(`/deals/${dealId}`);
  revalidatePath('/investors');

  return { ok: true };
}

export async function removeInvestorInterest(interestId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const interest = await database.investorInterest.findUnique({
    where: { id: interestId },
    select: { dealId: true },
  });
  if (!interest) throw new Error('Interest not found');

  await database.investorInterest.delete({ where: { id: interestId } });

  revalidatePath(`/deals/${interest.dealId}`);
  revalidatePath('/investors');

  return { ok: true };
}

/**
 * B-2 — post a progress update to every subscribed investor on a released
 * deal. Reuses the canonical recordDealUpdate plumbing: it records a timeline
 * event and emails the recipient list. We pass the investor emails via
 * notifyOverride (so the seller is NOT emailed) and use `internal` visibility
 * so the note never shows on the seller-facing /track page.
 */
export async function postInvestorUpdate(
  dealId: string,
  title: string,
  detail?: string,
) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  if (!title.trim()) throw new Error('Add a short headline for the update.');

  const deal = await database.deal.findUnique({
    where: { id: dealId },
    select: { id: true, releasedForResale: true },
  });
  if (!deal) throw new Error('Deal not found');
  if (!deal.releasedForResale) {
    throw new Error('Only released deals can be sent to investors.');
  }

  const subscribers = await database.investorInterest.findMany({
    where: { dealId, notify: true },
    select: { investorEmail: true },
  });
  const recipients = subscribers.map((s) => s.investorEmail);

  if (recipients.length === 0) {
    throw new Error('No subscribed investors to notify yet.');
  }

  const result = await recordDealUpdate({
    dealId,
    kind: 'note',
    title: title.trim().slice(0, 140),
    detail: detail?.trim().slice(0, 2000),
    visibility: 'internal',
    notifyOverride: recipients,
    notifiedBy: userId,
  });

  await database.dealActivity.create({
    data: {
      dealId,
      action: 'investor_update_sent',
      detail: `Sent "${title.trim()}" to ${result.notifiedTo.length} investor(s).`,
      userId,
    },
  });

  revalidatePath(`/deals/${dealId}`);

  return { notified: result.notifiedTo.length };
}

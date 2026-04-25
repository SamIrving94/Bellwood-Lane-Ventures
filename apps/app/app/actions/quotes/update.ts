'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { recordDealUpdate } from '@repo/deal-updates';
import { revalidatePath } from 'next/cache';

async function requireUser(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  return userId;
}

export async function acceptQuote(quoteRequestId: string): Promise<void> {
  const userId = await requireUser();

  const quote = await database.quoteRequest.findUnique({
    where: { id: quoteRequestId },
    include: { offer: true },
  });
  if (!quote) throw new Error('Quote not found');
  if (!quote.offer) throw new Error('Cannot accept — no offer generated');

  await database.quoteRequest.update({
    where: { id: quoteRequestId },
    data: { status: 'accepted' },
  });
  await database.quoteOffer.update({
    where: { id: quote.offer.id },
    data: { acceptedAt: new Date() },
  });

  await recordDealUpdate({
    quoteRequestId,
    kind: 'offer_accepted',
    title: 'Cash offer accepted by Bellwoods Lane',
    detail: `We've confirmed acceptance. Solicitors will be instructed within 24 hours and you'll see the next update here.`,
    notifiedBy: userId,
  });

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${quoteRequestId}`);
}

export async function declineQuote(quoteRequestId: string): Promise<void> {
  const userId = await requireUser();

  await database.quoteRequest.update({
    where: { id: quoteRequestId },
    data: { status: 'declined' },
  });

  await recordDealUpdate({
    quoteRequestId,
    kind: 'offer_declined',
    title: 'Offer not progressing',
    detail:
      'After review we have decided not to proceed. We will follow up by email with the reason. No fees, no obligation.',
    notifiedBy: userId,
  });

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${quoteRequestId}`);
}

export async function postNote(
  quoteRequestId: string,
  text: string,
): Promise<void> {
  const userId = await requireUser();
  if (!text.trim()) throw new Error('Note cannot be empty');

  await recordDealUpdate({
    quoteRequestId,
    kind: 'note',
    title: 'Update from the Bellwoods Lane team',
    detail: text.trim(),
    notifiedBy: userId,
  });

  revalidatePath(`/quotes/${quoteRequestId}`);
}

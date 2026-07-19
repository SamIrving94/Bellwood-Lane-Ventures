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

const SELLER_SITUATION_TO_TYPE: Record<
  string,
  'probate' | 'chain_break' | 'short_lease' | 'repossession' | 'relocation' | 'standard'
> = {
  probate: 'probate',
  chain_break: 'chain_break',
  short_lease: 'short_lease',
  repossession: 'repossession',
  relocation: 'relocation',
};

/**
 * An accepted quote is a vendor who said YES — it must enter the pipeline,
 * not die in the quotes silo. Creates a Deal carrying the offer numbers,
 * marks the quote converted_to_deal, and returns the deal for redirect.
 */
export async function convertQuoteToDeal(quoteRequestId: string) {
  const userId = await requireUser();

  const quote = await database.quoteRequest.findUnique({
    where: { id: quoteRequestId },
    include: { offer: true },
  });
  if (!quote) throw new Error('Quote not found');
  if (quote.status === 'converted_to_deal') {
    throw new Error('Quote already converted');
  }
  if (quote.status !== 'accepted') {
    throw new Error('Only accepted quotes can be converted to a deal');
  }

  const emvPence = quote.offer
    ? Math.round(
        (quote.offer.estimatedMarketValueMinPence +
          quote.offer.estimatedMarketValueMaxPence) /
          2,
      )
    : null;

  const deal = await database.deal.create({
    data: {
      address: quote.address,
      postcode: quote.postcode,
      propertyType: quote.propertyType ?? 'unknown',
      bedrooms: quote.bedrooms,
      sellerType:
        SELLER_SITUATION_TO_TYPE[quote.sellerSituation ?? ''] ?? 'standard',
      // Agent-referred quotes are referrals; direct vendors came via the
      // public instant-offer intake.
      source: quote.referralCode ? 'referral' : 'intake_form',
      // Vendor accepted this number — the deal starts contacted, not cold.
      status: 'contacted',
      askingPricePence: quote.askingPricePence,
      ourOfferPence: quote.offer?.offerPence ?? null,
      estimatedMarketValuePence: emvPence,
      sellerName: quote.contactName,
      sellerEmail: quote.contactEmail,
      sellerPhone: quote.contactPhone,
      notes: quote.notes,
    },
  });

  await database.quoteRequest.update({
    where: { id: quoteRequestId },
    data: { status: 'converted_to_deal' },
  });

  await database.dealActivity.create({
    data: {
      dealId: deal.id,
      action: 'deal_created',
      detail: `Converted from accepted instant-offer quote (${quote.contactName}, offer ${
        quote.offer ? `£${Math.round(quote.offer.offerPence / 100).toLocaleString('en-GB')}` : 'n/a'
      })`,
      userId,
    },
  });

  revalidatePath('/pipeline');
  revalidatePath('/quotes');
  revalidatePath(`/quotes/${quoteRequestId}`);
  revalidatePath('/');

  return deal;
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

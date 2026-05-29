'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

/**
 * Horizon 2 Track A guardrail. A scouted lead is only listed to referral
 * partners AFTER Bellwood passes on it for its own book. This action is the
 * single gate that flips `referralReleased`: it marks the lead `passed`
 * (we won't convert it), records who released it and why, and optionally sets
 * a referral price. Until this runs, the lead never leaves the pipeline.
 */
export async function releaseForReferral(
  leadId: string,
  reason: string,
  referralPricePence?: number,
) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  if (!reason.trim()) throw new Error('Add a reason — why are we passing?');

  const lead = await database.scoutLead.findUnique({
    where: { id: leadId },
    select: { id: true, referralReleased: true, status: true },
  });
  if (!lead) throw new Error('Lead not found');
  if (lead.status === 'converted') {
    throw new Error('Converted leads cannot be listed for referral.');
  }
  if (lead.referralReleased) throw new Error('Lead is already listed.');

  await database.scoutLead.update({
    where: { id: leadId },
    data: {
      status: 'passed', // Bellwood has passed on it for its own book
      referralReleased: true,
      referralReleasedAt: new Date(),
      referralReleasedBy: userId,
      referralReason: reason.trim().slice(0, 1000),
      referralPricePence: referralPricePence ?? null,
    },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/leads');
  revalidatePath('/referrals');

  return { released: true };
}

/**
 * Pull a lead back off the referral feed (e.g. listed by mistake, or we want
 * it back for our own book). Reverts the flag and clears any claim. Status is
 * left for the founder to reset since the right next stage depends on context.
 */
export async function unreleaseForReferral(leadId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const lead = await database.scoutLead.findUnique({
    where: { id: leadId },
    select: { id: true, referralReleased: true },
  });
  if (!lead) throw new Error('Lead not found');
  if (!lead.referralReleased) throw new Error('Lead is not listed.');

  await database.scoutLead.update({
    where: { id: leadId },
    data: {
      referralReleased: false,
      referralReleasedAt: null,
      referralReleasedBy: null,
      referralClaimedBy: null,
      referralClaimedAt: null,
    },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/referrals');

  return { released: false };
}

/**
 * Record that a referral partner has claimed a listed lead — used for
 * referral-income attribution. A lead must be released to the feed first.
 */
export async function claimReferral(leadId: string, partner: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  if (!partner.trim()) throw new Error('Who is taking the lead?');

  const lead = await database.scoutLead.findUnique({
    where: { id: leadId },
    select: { id: true, referralReleased: true },
  });
  if (!lead) throw new Error('Lead not found');
  if (!lead.referralReleased) {
    throw new Error('List the lead for referral first.');
  }

  await database.scoutLead.update({
    where: { id: leadId },
    data: {
      referralClaimedBy: partner.trim().slice(0, 200),
      referralClaimedAt: new Date(),
    },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/referrals');

  return { claimed: true };
}

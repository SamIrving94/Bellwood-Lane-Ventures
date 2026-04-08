'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

export async function convertLeadToDeal(leadId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const lead = await database.scoutLead.findUnique({
    where: { id: leadId },
  });

  if (!lead) throw new Error('Lead not found');
  if (lead.status === 'converted') throw new Error('Lead already converted');

  // Create deal from lead data
  const deal = await database.deal.create({
    data: {
      address: lead.address,
      postcode: lead.postcode,
      propertyType: lead.leadType, // Will be refined later
      sellerType: lead.leadType === 'probate'
        ? 'probate'
        : lead.leadType === 'chain_break'
          ? 'chain_break'
          : lead.leadType === 'repossession'
            ? 'repossession'
            : lead.leadType === 'short_lease'
              ? 'short_lease'
              : 'standard',
      source: 'scout_lead',
      sellerName: lead.contactName,
      sellerEmail: lead.contactEmail,
      sellerPhone: lead.contactPhone,
      convertedFromLeadId: lead.id,
    },
  });

  // Update lead status
  await database.scoutLead.update({
    where: { id: leadId },
    data: {
      status: 'converted',
      convertedDealId: deal.id,
    },
  });

  // Log activity
  await database.dealActivity.create({
    data: {
      dealId: deal.id,
      action: 'deal_created',
      detail: `Converted from scout lead (score: ${lead.leadScore}, verdict: ${lead.verdict})`,
      userId,
    },
  });

  revalidatePath('/pipeline');
  revalidatePath('/leads');
  revalidatePath('/');

  return deal;
}

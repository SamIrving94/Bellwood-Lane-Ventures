'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

export type CreateCampaignInput = {
  name: string;
  postcodeArea: string;
  radiusMiles: number;
  propertyTypes: string[];
  minPricePence?: number;
  maxPricePence?: number;
  sellerTypes: string[];
  minLeadScore: number;
  outreachChannels: string[];
  budgetPence?: number;
  dailyCap: number;
  targetEndDate?: string;
};

export async function createCampaign(input: CreateCampaignInput) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error('Campaign name is required');

  const normalisedArea = input.postcodeArea.toUpperCase().trim();
  if (!/^[A-Z]{1,2}[0-9][0-9A-Z]?$/.test(normalisedArea)) {
    throw new Error('Postcode area must be a valid UK postcode prefix (e.g. M1, B15, LS6)');
  }

  const campaign = await database.campaign.create({
    data: {
      name: trimmedName,
      createdBy: userId,
      status: 'draft',
      postcodeArea: normalisedArea,
      radiusMiles: input.radiusMiles,
      propertyTypes: input.propertyTypes,
      minPricePence: input.minPricePence,
      maxPricePence: input.maxPricePence,
      sellerTypes: input.sellerTypes,
      minLeadScore: input.minLeadScore,
      outreachChannels: input.outreachChannels,
      budgetPence: input.budgetPence,
      dailyCap: input.dailyCap,
      targetEndDate: input.targetEndDate ? new Date(input.targetEndDate) : null,
    },
  });

  revalidatePath('/campaigns');
  return { id: campaign.id };
}

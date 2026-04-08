'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { DealSource, SellerType } from '@repo/database/generated/client';
import { revalidatePath } from 'next/cache';

type CreateDealInput = {
  address: string;
  postcode: string;
  propertyType: string;
  bedrooms?: number;
  sellerType?: SellerType;
  source?: DealSource;
  askingPricePence?: number;
  sellerName?: string;
  sellerEmail?: string;
  sellerPhone?: string;
  notes?: string;
};

export async function createDeal(input: CreateDealInput) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const deal = await database.deal.create({
    data: {
      address: input.address,
      postcode: input.postcode.toUpperCase().trim(),
      propertyType: input.propertyType,
      bedrooms: input.bedrooms,
      sellerType: input.sellerType || 'standard',
      source: input.source || 'manual',
      askingPricePence: input.askingPricePence,
      sellerName: input.sellerName,
      sellerEmail: input.sellerEmail,
      sellerPhone: input.sellerPhone,
      notes: input.notes,
    },
  });

  // Log creation activity
  await database.dealActivity.create({
    data: {
      dealId: deal.id,
      action: 'deal_created',
      detail: `Deal created from ${input.source || 'manual'} source`,
      userId,
    },
  });

  revalidatePath('/pipeline');
  revalidatePath('/');

  return deal;
}

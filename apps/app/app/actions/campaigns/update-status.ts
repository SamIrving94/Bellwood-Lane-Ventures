'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

async function transition(id: string, to: 'paused' | 'active' | 'completed', label: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const campaign = await database.campaign.findUnique({ where: { id } });
  if (!campaign) throw new Error('Campaign not found');

  const data: {
    status: typeof to;
    completedAt?: Date | null;
  } = { status: to };
  if (to === 'completed') data.completedAt = new Date();

  await database.campaign.update({
    where: { id },
    data,
  });

  await database.agentEvent.create({
    data: {
      agent: 'orchestrator',
      eventType: `campaign_${to}`,
      summary: `Campaign "${campaign.name}" ${label}`,
      payload: { campaignId: id },
    },
  });

  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${id}`);
  return { success: true };
}

export async function pauseCampaign(id: string) {
  return transition(id, 'paused', 'paused');
}

export async function resumeCampaign(id: string) {
  return transition(id, 'active', 'resumed');
}

export async function completeCampaign(id: string) {
  return transition(id, 'completed', 'completed');
}

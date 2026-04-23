'use server';

import { env } from '@/env';
import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

export async function launchCampaign(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const campaign = await database.campaign.findUnique({ where: { id } });
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status !== 'draft' && campaign.status !== 'paused') {
    throw new Error(`Cannot launch a campaign that is ${campaign.status}`);
  }

  const updated = await database.campaign.update({
    where: { id },
    data: {
      status: 'active',
      launchedAt: campaign.launchedAt ?? new Date(),
    },
  });

  const brief = {
    postcodeArea: updated.postcodeArea,
    radiusMiles: updated.radiusMiles,
    propertyTypes: updated.propertyTypes,
    minPrice: updated.minPricePence,
    maxPrice: updated.maxPricePence,
    sellerTypes: updated.sellerTypes,
    minLeadScore: updated.minLeadScore,
    outreachChannels: updated.outreachChannels,
    dailyCap: updated.dailyCap,
  };

  const agentEvent = await database.agentEvent.create({
    data: {
      agent: 'orchestrator',
      eventType: 'campaign_launched',
      summary: `Campaign "${updated.name}" launched targeting ${updated.postcodeArea} (${updated.radiusMiles}mi)`,
      payload: {
        campaignId: updated.id,
        brief,
      },
    },
  });

  await database.founderAction.create({
    data: {
      type: 'dispatch_campaign',
      priority: 'medium',
      title: `Campaign dispatched: ${updated.name}`,
      description: `Paperclip Scout + Appraiser + Marketer assigned to campaign "${updated.name}" (${updated.postcodeArea}, ${updated.radiusMiles}mi radius). Min lead score ${updated.minLeadScore}. Daily cap ${updated.dailyCap}.`,
      agent: 'orchestrator',
      agentEventId: agentEvent.id,
      metadata: {
        campaignId: updated.id,
        assignedAgents: ['scout', 'appraiser', 'marketer'],
        brief,
      },
    },
  });

  // Signal Paperclip via the dispatch endpoint (best-effort, don't block launch)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const key = env.PAPERCLIP_API_KEY;
  if (apiUrl && key) {
    try {
      await fetch(`${apiUrl}/agents/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          campaignId: updated.id,
          assignedAgents: ['scout', 'appraiser', 'marketer'],
          brief,
        }),
      });
    } catch (err) {
      console.error('[launchCampaign] dispatch call failed (non-fatal):', err);
    }
  }

  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${id}`);
  revalidatePath('/actions');
  return { success: true };
}

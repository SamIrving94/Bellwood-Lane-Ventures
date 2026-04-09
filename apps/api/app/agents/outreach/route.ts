import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

// Marketer agent submits outreach campaigns for founder review
export const POST = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  const body = await request.json();
  const { campaignName, templates, recipientContactIds, summary } = body;

  if (!campaignName) {
    return NextResponse.json(
      { error: 'Missing required field: campaignName' },
      { status: 400 }
    );
  }

  // Create templates if provided
  const templateIds: string[] = [];
  if (templates && Array.isArray(templates)) {
    for (const t of templates) {
      const template = await database.outreachTemplate.create({
        data: {
          name: t.name,
          subject: t.subject,
          body: t.body,
          type: t.type ?? 'general',
          sequence: t.sequence ?? 1,
          delayDays: t.delayDays ?? 0,
        },
      });
      templateIds.push(template.id);
    }
  }

  // Create campaign
  const campaign = await database.outreachCampaign.create({
    data: {
      name: campaignName,
      templateIds,
      status: 'draft',
    },
  });

  // Add recipients if provided
  if (recipientContactIds && Array.isArray(recipientContactIds)) {
    await database.outreachRecipient.createMany({
      data: recipientContactIds.map((contactId: string) => ({
        campaignId: campaign.id,
        contactId,
      })),
      skipDuplicates: true,
    });
  }

  const recipientCount = recipientContactIds?.length ?? 0;

  // Log agent event
  const event = await database.agentEvent.create({
    data: {
      agent: 'marketer',
      eventType: 'campaign_drafted',
      summary: summary ?? `Campaign "${campaignName}" drafted with ${templateIds.length} templates, ${recipientCount} recipients`,
      count: recipientCount,
      payload: {
        campaignId: campaign.id,
        templateCount: templateIds.length,
        recipientCount,
      },
    },
  });

  // Create FounderAction for review
  await database.founderAction.create({
    data: {
      type: 'review_campaign',
      priority: 'medium',
      title: `Review outreach campaign: "${campaignName}"`,
      description: `Marketer has drafted a new outreach campaign with ${templateIds.length} email templates and ${recipientCount} recipients. Review and approve before sending.`,
      agent: 'marketer',
      agentEventId: event.id,
      metadata: {
        campaignId: campaign.id,
        templateIds,
        recipientCount,
      },
    },
  });

  return NextResponse.json({
    success: true,
    campaignId: campaign.id,
    templateIds,
    recipientCount,
    eventId: event.id,
  });
};

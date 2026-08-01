import { database, Prisma } from '@repo/database';
import { NextResponse } from 'next/server';
import { unauthorizedResponse, validateAgentAuth } from '../_lib/auth';

// Orchestrator dispatch: signal assigned Paperclip agents to work on a campaign.
// Paperclip agents subscribe to FounderAction + AgentEvent and act on their inbox.
export const POST = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  let body: {
    campaignId?: string;
    assignedAgents?: string[];
    brief?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { campaignId, assignedAgents, brief } = body;

  if (!campaignId || typeof campaignId !== 'string') {
    return NextResponse.json(
      { error: 'campaignId is required' },
      { status: 400 }
    );
  }
  if (!Array.isArray(assignedAgents) || assignedAgents.length === 0) {
    return NextResponse.json(
      { error: 'assignedAgents must be a non-empty array' },
      { status: 400 }
    );
  }
  if (!brief || typeof brief !== 'object') {
    return NextResponse.json({ error: 'brief is required' }, { status: 400 });
  }

  const campaign = await database.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }
  if (campaign.status !== 'active') {
    return NextResponse.json(
      { error: `Campaign is ${campaign.status}, must be active to dispatch` },
      { status: 400 }
    );
  }

  // Log the dispatch event
  const agentEvent = await database.agentEvent.create({
    data: {
      agent: 'orchestrator',
      eventType: 'campaign_dispatched',
      summary: `Dispatched ${assignedAgents.join(', ')} to campaign "${campaign.name}" (${campaign.postcodeArea})`,
      payload: {
        campaignId,
        assignedAgents,
        brief,
      } as Prisma.InputJsonValue,
      count: assignedAgents.length,
    },
  });

  // Map assigned-agent string to AgentName enum
  const AGENT_MAP: Record<string, 'scout' | 'appraiser' | 'marketer' | 'counsel' | 'orchestrator'> = {
    scout: 'scout',
    appraiser: 'appraiser',
    marketer: 'marketer',
    counsel: 'counsel',
    orchestrator: 'orchestrator',
  };

  const actionsCreated: Array<{ id: string; agent: string }> = [];

  for (const agentStr of assignedAgents) {
    const agent = AGENT_MAP[agentStr];
    if (!agent) continue;

    const action = await database.founderAction.create({
      data: {
        type: 'dispatch_campaign',
        priority: 'medium',
        title: `Paperclip ${agent} running on campaign "${campaign.name}"`,
        description: `Agent ${agent} is now sourcing/working within ${campaign.postcodeArea} (${campaign.radiusMiles}mi). Min lead score ${campaign.minLeadScore}. Daily cap ${campaign.dailyCap}.`,
        agent,
        agentEventId: agentEvent.id,
        metadata: {
          campaignId,
          brief,
        } as Prisma.InputJsonValue,
      },
    });

    actionsCreated.push({ id: action.id, agent });
  }

  return NextResponse.json({
    dispatched: true,
    campaignId,
    agentEventId: agentEvent.id,
    actions: actionsCreated,
  });
};

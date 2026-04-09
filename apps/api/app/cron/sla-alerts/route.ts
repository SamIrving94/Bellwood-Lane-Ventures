import { env } from '@/env';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';

// Daily SLA breach check — runs at 9am
// Flags deals that have been in a stage too long
// Creates FounderActions so breaches appear in the Action Centre
const SLA_LIMITS: Record<string, number> = {
  new_lead: 2,       // 2 days max before first contact
  contacted: 5,      // 5 days max before valuation
  valuation: 7,      // 7 days max before offer
  offer_made: 14,    // 14 days for vendor decision
  under_offer: 28,   // 28 days to exchange
  exchanged: 14,     // 14 days to complete
};

export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const breaches: Array<{ dealId: string; address: string; status: string; daysInStage: number }> = [];

  for (const [status, maxDays] of Object.entries(SLA_LIMITS)) {
    const cutoff = new Date(now.getTime() - maxDays * 24 * 60 * 60 * 1000);

    const overdueDeals = await database.deal.findMany({
      where: {
        status: status as any,
        stageEnteredAt: { lt: cutoff },
      },
      select: { id: true, address: true, postcode: true, status: true, stageEnteredAt: true },
    });

    for (const deal of overdueDeals) {
      const daysInStage = Math.floor(
        (now.getTime() - deal.stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      breaches.push({
        dealId: deal.id,
        address: deal.address,
        status: deal.status,
        daysInStage,
      });

      // Check if there's already a pending SLA action for this deal
      const existing = await database.founderAction.findFirst({
        where: {
          dealId: deal.id,
          type: 'sla_breach',
          status: 'pending',
        },
      });

      if (!existing) {
        // Create FounderAction for the breach
        await database.founderAction.create({
          data: {
            type: 'sla_breach',
            priority: daysInStage > maxDays * 2 ? 'critical' : 'high',
            title: `SLA breach: ${deal.address} stuck in "${status.replace('_', ' ')}" for ${daysInStage} days`,
            description: `This deal has exceeded the ${maxDays}-day SLA for the "${status.replace('_', ' ')}" stage. It's been ${daysInStage} days. Take action to move it forward or withdraw.`,
            agent: 'system',
            dealId: deal.id,
            metadata: {
              status,
              maxDays,
              daysInStage,
              stageEnteredAt: deal.stageEnteredAt.toISOString(),
            },
          },
        });
      }
    }
  }

  // Log one agent event for the whole run
  if (breaches.length > 0) {
    await database.agentEvent.create({
      data: {
        agent: 'system',
        eventType: 'sla_check',
        summary: `SLA check found ${breaches.length} breach${breaches.length === 1 ? '' : 'es'}`,
        count: breaches.length,
        payload: { breaches },
      },
    });
  }

  return NextResponse.json({
    success: true,
    breaches: breaches.length,
    details: breaches,
  });
};

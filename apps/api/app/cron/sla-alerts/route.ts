import { env } from '@/env';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';

// Daily SLA breach check — runs at 9am
// Flags deals that have been in a stage too long
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
      select: { id: true, address: true, status: true, stageEnteredAt: true },
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
    }
  }

  // TODO: Send email alerts via @repo/email for breaches

  return NextResponse.json({
    success: true,
    breaches: breaches.length,
    details: breaches,
  });
};

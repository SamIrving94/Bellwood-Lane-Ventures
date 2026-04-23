import { env } from '@/env';
import { getUpcomingAuctions } from '@repo/auctions';
import { NextResponse } from 'next/server';

// Weekly auction scan — runs Mondays at 8am
// Scrapes all free UK auction sources and pushes lots through the
// auctions agent endpoint (which upserts + creates FounderActions).
export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Fetch upcoming lots from all free sources
  const lots = await getUpcomingAuctions();

  if (lots.length === 0) {
    return NextResponse.json({
      success: true,
      lotsFound: 0,
      message: 'No upcoming lots found this week',
    });
  }

  // 2. Push to the auctions agent endpoint internally. We use an absolute
  //    self-URL so the same host serves both routes (Vercel passes this).
  const protocol = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('host') ?? 'localhost:3002';
  const agentUrl = `${protocol}://${host}/agents/auctions`;

  const agentResponse = await fetch(agentUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.PAPERCLIP_API_KEY}`,
    },
    body: JSON.stringify({
      lots: lots.map((lot) => ({
        sourceHouse: lot.sourceHouse,
        sourceLotRef: lot.sourceLotRef,
        auctionDate: lot.auctionDate.toISOString(),
        address: lot.address,
        postcode: lot.postcode,
        propertyType: lot.propertyType,
        guidePriceMinPence: lot.guidePriceMinPence,
        guidePriceMaxPence: lot.guidePriceMaxPence,
        lotUrl: lot.lotUrl,
      })),
      runSummary: {
        totalFetched: lots.length,
        source: 'weekly-cron-scan',
      },
    }),
  });

  const agentResult = await agentResponse.json();

  // Counts by source for the cron response
  const bySource = lots.reduce<Record<string, number>>((acc, lot) => {
    acc[lot.sourceHouse] = (acc[lot.sourceHouse] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    success: true,
    runDate: new Date().toISOString(),
    lotsFound: lots.length,
    bySource,
    agentResponse: agentResult,
  });
};

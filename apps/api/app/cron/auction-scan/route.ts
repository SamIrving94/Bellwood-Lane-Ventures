import { env } from '@/env';
import {
  type AuctionLot,
  type VisualAssessment,
  getUpcomingAuctions,
  screenAuctionLot,
} from '@repo/auctions';
import { NextResponse } from 'next/server';

// Weekly auction scan — runs Mondays at 8am
// Scrapes all free UK auction sources and pushes lots through the
// auctions agent endpoint (which upserts + creates FounderActions).
//
// In addition to scraping, we vision-screen up to VISION_SCREEN_CAP lots
// per run (Claude Sonnet) so the appraiser flow can downgrade visibly-
// distressed lots automatically. Lots without photos are skipped silently.

// Cap vision calls per run to control spend. The screener is graceful so
// over-cap lots simply get `visualAssessment: null` and flow through unchanged.
const VISION_SCREEN_CAP = 50;

// Bound concurrent vision calls — Vercel functions have ~60s timeouts and
// each vision call can take 5-10s. 3 concurrent ~= 50 lots in ~150s worst-case.
const VISION_CONCURRENCY = 3;

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

  // 2. Vision-screen up to VISION_SCREEN_CAP lots. Lots beyond the cap (or
  //    without photos) flow through with visualAssessment = null.
  const screenedLots = await screenLots(lots, VISION_SCREEN_CAP);
  const screenedCount = screenedLots.filter(
    (l) => l.visualAssessment != null
  ).length;

  // 3. Push to the auctions agent endpoint internally. We use an absolute
  //    self-URL so the same host serves both routes (Vercel passes this).
  const protocol = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('host') ?? 'localhost:3002';
  const agentUrl = `${protocol}://${host}/agents/auctions`;

  const agentResponse = await fetch(agentUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.BELLWOOD_API_KEY ?? env.PAPERCLIP_API_KEY ?? ''}`,
    },
    body: JSON.stringify({
      lots: screenedLots.map((lot) => ({
        sourceHouse: lot.sourceHouse,
        sourceLotRef: lot.sourceLotRef,
        auctionDate: lot.auctionDate.toISOString(),
        address: lot.address,
        postcode: lot.postcode,
        propertyType: lot.propertyType,
        guidePriceMinPence: lot.guidePriceMinPence,
        guidePriceMaxPence: lot.guidePriceMaxPence,
        lotUrl: lot.lotUrl,
        visualAssessment: lot.visualAssessment ?? null,
      })),
      runSummary: {
        totalFetched: lots.length,
        visionScreenAttempted: Math.min(lots.length, VISION_SCREEN_CAP),
        visionScreenSucceeded: screenedCount,
        source: 'weekly-cron-scan',
      },
    }),
  });

  const agentResult = await agentResponse.json();

  // Counts by source for the cron response
  const bySource = screenedLots.reduce<Record<string, number>>((acc, lot) => {
    acc[lot.sourceHouse] = (acc[lot.sourceHouse] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    success: true,
    runDate: new Date().toISOString(),
    lotsFound: lots.length,
    visionScreenSucceeded: screenedCount,
    bySource,
    agentResponse: agentResult,
  });
};

/**
 * Apply `screenAuctionLot` to the first `cap` lots with a small concurrency
 * pool. Returns a new array where eligible lots have `visualAssessment`
 * populated; everything else is passed through unchanged.
 */
async function screenLots(
  lots: AuctionLot[],
  cap: number
): Promise<AuctionLot[]> {
  const result: AuctionLot[] = lots.map((l) => ({ ...l }));
  const indicesToScreen: number[] = [];
  for (let i = 0; i < result.length && indicesToScreen.length < cap; i++) {
    const lot = result[i];
    if (lot && lot.photoUrls && lot.photoUrls.length > 0) {
      indicesToScreen.push(i);
    }
  }

  let cursor = 0;
  const workers: Promise<void>[] = [];
  const runOne = async (): Promise<void> => {
    while (cursor < indicesToScreen.length) {
      const myIdx = indicesToScreen[cursor++];
      if (myIdx === undefined) return;
      const lot = result[myIdx];
      if (!lot) continue;
      const assessment: VisualAssessment | null = await screenAuctionLot({
        lotRef: lot.sourceLotRef,
        address: lot.address,
        photoUrls: lot.photoUrls ?? [],
      });
      lot.visualAssessment = assessment;
    }
  };
  for (let i = 0; i < VISION_CONCURRENCY; i++) workers.push(runOne());
  await Promise.all(workers);

  return result;
}

// Vercel cron sends GET by default. Accept either method so a manual
// POST and an automated GET both reach the same handler.
export const GET = POST;

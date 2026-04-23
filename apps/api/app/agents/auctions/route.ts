import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

// Auction scraper pushes upcoming auction lots into the platform
// Upserts AuctionLots + logs AgentEvent + creates FounderAction when a lot
// looks like a strong Bellwood match (cheap terraced/semi distressed stock).
//
// Shape expected:
// {
//   "lots": [
//     {
//       "sourceHouse": "auction_house_uk",
//       "sourceLotRef": "AHN-2604-012",
//       "auctionDate": "2026-05-13T10:00:00.000Z",
//       "address": "14 Alder Road, Moston, Manchester",
//       "postcode": "M40 9QR",
//       "propertyType": "terraced_house",
//       "guidePriceMinPence": 8500000,
//       "guidePriceMaxPence": 9500000,
//       "lotUrl": "https://..."
//     }
//   ],
//   "runSummary": { "totalFetched": 18, "source": "weekly-scan" }
// }
export const POST = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  const body = await request.json();
  const { lots, runSummary } = body as {
    lots: Array<{
      sourceHouse: string;
      sourceLotRef: string;
      auctionDate: string | Date;
      address: string;
      postcode: string;
      propertyType: string;
      guidePriceMinPence?: number | null;
      guidePriceMaxPence?: number | null;
      lotUrl?: string | null;
    }>;
    runSummary?: { totalFetched?: number; source?: string; summary?: string };
  };

  if (!lots || !Array.isArray(lots) || lots.length === 0) {
    return NextResponse.json(
      { error: 'Missing or empty lots array' },
      { status: 400 }
    );
  }

  // Upsert each lot keyed by (sourceHouse, sourceLotRef)
  let createdCount = 0;
  let updatedCount = 0;
  for (const lot of lots) {
    const data = {
      sourceHouse: lot.sourceHouse,
      sourceLotRef: lot.sourceLotRef,
      auctionDate: new Date(lot.auctionDate),
      address: lot.address,
      postcode: lot.postcode,
      propertyType: lot.propertyType,
      guidePriceMinPence: lot.guidePriceMinPence ?? null,
      guidePriceMaxPence: lot.guidePriceMaxPence ?? null,
      lotUrl: lot.lotUrl ?? null,
    };
    const existing = await database.auctionLot.findUnique({
      where: {
        sourceHouse_sourceLotRef: {
          sourceHouse: lot.sourceHouse,
          sourceLotRef: lot.sourceLotRef,
        },
      },
      select: { id: true },
    });
    if (existing) {
      await database.auctionLot.update({
        where: { id: existing.id },
        data,
      });
      updatedCount++;
    } else {
      await database.auctionLot.create({ data });
      createdCount++;
    }
  }

  // Bellwood match: cheap terraced/semi = classic distressed chain-break stock
  const STRONG_MAX_GUIDE_PENCE = 100_000_00; // £100k
  const strongMatches = lots.filter(
    (l) =>
      (l.propertyType === 'terraced_house' ||
        l.propertyType === 'semi_detached') &&
      l.guidePriceMinPence != null &&
      l.guidePriceMinPence < STRONG_MAX_GUIDE_PENCE
  );

  const summary =
    runSummary?.summary ??
    `Auction scraper found ${lots.length} lots (${createdCount} new, ${updatedCount} updated, ${strongMatches.length} strong Bellwood matches)`;

  const event = await database.agentEvent.create({
    data: {
      agent: 'scout',
      eventType: 'auction_lots_scraped',
      summary,
      count: lots.length,
      payload: {
        total: lots.length,
        created: createdCount,
        updated: updatedCount,
        strongMatches: strongMatches.length,
        source: runSummary?.source,
      },
    },
  });

  if (strongMatches.length > 0) {
    await database.founderAction.create({
      data: {
        type: 'review_leads',
        priority: strongMatches.length >= 5 ? 'high' : 'medium',
        title: `Review ${strongMatches.length} auction lot${strongMatches.length === 1 ? '' : 's'} matching Bellwood profile`,
        description: `Auction scan found ${lots.length} upcoming lots; ${strongMatches.length} are terraced/semi under £100k guide — classic distressed / chain-break stock. Review before the sale date.`,
        agent: 'scout',
        agentEventId: event.id,
        metadata: {
          strongMatchCount: strongMatches.length,
          totalLots: lots.length,
          runDate: new Date().toISOString(),
        },
      },
    });
  }

  return NextResponse.json({
    success: true,
    created: createdCount,
    updated: updatedCount,
    strongMatches: strongMatches.length,
    eventId: event.id,
  });
};

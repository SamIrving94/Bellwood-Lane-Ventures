import { Prisma, database } from '@repo/database';
import { classifyAuctionTrack, toDistrictSet } from '@repo/scouting';
import { NextResponse } from 'next/server';
import { unauthorizedResponse, validateAgentAuth } from '../_lib/auth';

// Auction scraper pushes upcoming auction lots into the platform
// Upserts AuctionLots + logs AgentEvent + creates FounderAction when a lot
// looks like a strong Kept match (cheap terraced/semi distressed stock).
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
      /** Raw lot title/description text, for block/portfolio detection. */
      summary?: string | null;
      /** Claude-vision condition screen from the auction-scan cron. */
      visualAssessment?: unknown;
    }>;
    runSummary?: { totalFetched?: number; source?: string; summary?: string };
  };

  if (!lots || !Array.isArray(lots) || lots.length === 0) {
    return NextResponse.json(
      { error: 'Missing or empty lots array' },
      { status: 400 }
    );
  }

  // The founder's prime geography (Settings → Scouting): lots guided just
  // under the £700k floor inside these districts still classify prime,
  // because auction guides are teaser floors and hammer lands 10–40% over.
  // Best-effort — an unreadable setting only costs the in-district headroom.
  let primeDistricts: ReadonlySet<string> = new Set();
  try {
    const areasSetting = await database.setting.findUnique({
      where: { key: 'scouting.areas' },
    });
    if (areasSetting && Array.isArray(areasSetting.value)) {
      primeDistricts = toDistrictSet(
        (areasSetting.value as unknown[]).flatMap((raw) => {
          if (!raw || typeof raw !== 'object') return [];
          const a = raw as { track?: unknown; district?: unknown };
          return a.track === 'prime' && typeof a.district === 'string'
            ? [a.district]
            : [];
        })
      );
    }
  } catch (err) {
    console.warn('[agents/auctions] failed to read prime districts', err);
  }

  // Upsert each lot keyed by (sourceHouse, sourceLotRef)
  let createdCount = 0;
  let updatedCount = 0;
  const trackByRef = new Map<string, 'volume' | 'prime' | 'block'>();
  for (const lot of lots) {
    // Two-track classification from the advertised words + guide price:
    // block/portfolio language wins, then £700k+ guide = prime anywhere,
    // then a near-floor guide inside a prime district (guides are floors,
    // not values — see classifyAuctionTrack).
    const track = classifyAuctionTrack({
      guidePriceMinPence: lot.guidePriceMinPence,
      guidePriceMaxPence: lot.guidePriceMaxPence,
      text: `${lot.address} ${lot.summary ?? ''}`,
      propertyType: lot.propertyType,
      postcode: lot.postcode,
      primeDistricts,
    });
    trackByRef.set(`${lot.sourceHouse}:${lot.sourceLotRef}`, track);
    const data = {
      sourceHouse: lot.sourceHouse,
      sourceLotRef: lot.sourceLotRef,
      auctionDate: new Date(lot.auctionDate),
      address: lot.address,
      postcode: lot.postcode,
      propertyType: lot.propertyType,
      track,
      summary: lot.summary ?? null,
      guidePriceMinPence: lot.guidePriceMinPence ?? null,
      guidePriceMaxPence: lot.guidePriceMaxPence ?? null,
      lotUrl: lot.lotUrl ?? null,
      // Persist the vision screen so the per-lot Claude spend isn't thrown away.
      visualAssessment:
        (lot.visualAssessment as Prisma.InputJsonValue | undefined) ??
        Prisma.JsonNull,
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

  // Kept match: cheap terraced/semi = classic distressed chain-break stock
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
    `Auction scraper found ${lots.length} lots (${createdCount} new, ${updatedCount} updated, ${strongMatches.length} strong Kept matches)`;

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
        title: `Review ${strongMatches.length} auction lot${strongMatches.length === 1 ? '' : 's'} matching Kept profile`,
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

  // Prime/block lots are own-book candidates — a separate, higher-priority
  // card so a block of flats never drowns under the volume review pile.
  const primeLots = lots.filter(
    (l) => trackByRef.get(`${l.sourceHouse}:${l.sourceLotRef}`) !== 'volume'
  );
  if (primeLots.length > 0) {
    const blockCount = primeLots.filter(
      (l) => trackByRef.get(`${l.sourceHouse}:${l.sourceLotRef}`) === 'block'
    ).length;
    const sample = primeLots
      .slice(0, 3)
      .map((l) => `${l.address} (${l.postcode})`)
      .join(' | ');
    await database.founderAction.create({
      data: {
        type: 'review_leads',
        priority: 'high',
        title: `${primeLots.length} prime/block auction lot${primeLots.length === 1 ? '' : 's'} — own-book candidates`,
        description: `Auction scan surfaced ${blockCount} block/portfolio lot${blockCount === 1 ? '' : 's'} and ${primeLots.length - blockCount} prime-guide lot${primeLots.length - blockCount === 1 ? '' : 's'} (£700k+ anywhere, or near-floor guides inside a prime district — auction guides run low). Principal-track candidates — review before the sale date. ${sample}`,
        agent: 'scout',
        agentEventId: event.id,
        metadata: {
          primeLotCount: primeLots.length,
          blockLotCount: blockCount,
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
    primeLots: primeLots.length,
    eventId: event.id,
  });
};

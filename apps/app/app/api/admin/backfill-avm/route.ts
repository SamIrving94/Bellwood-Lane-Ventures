import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { mergeOfferConfig, runAVM } from '@repo/valuation';
import { NextResponse } from 'next/server';

/**
 * One-time (re-runnable) backfill that re-values every deal with the current
 * AVM engine and writes the result in correct PENCE.
 *
 * Why this exists: a pounds-vs-pence bug stored AVM figures 100x too small on
 * the deal flow (the engine works in pounds; DB columns are pence). This route
 * re-runs the fixed AVM and rewrites estimatedMarketValuePence / ourOfferPence
 * correctly. It runs server-side in production, where PROPERTYDATA_API_KEY is
 * configured, so the new distance-weighted comps are used too.
 *
 * Batched via ?skip & ?take so a large pipeline can't blow the 300s function
 * limit — the trigger script loops until `remaining` hits 0.
 *
 * Auth: either a logged-in founder (Clerk) OR `Authorization: Bearer <CRON_SECRET>`.
 */

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const PROPERTY_TYPE_MAP: Record<string, string> = {
  detached: 'detached',
  'semi-detached': 'semi-detached',
  semi: 'semi-detached',
  terraced: 'terraced',
  terrace: 'terraced',
  flat: 'flat',
  apartment: 'flat',
  bungalow: 'detached',
};

const SELLER_TYPE_MAP: Record<string, string> = {
  probate: 'probate',
  chain_break: 'chain_break',
  short_lease: 'short_lease',
  repossession: 'repossession',
  relocation: 'relocation',
  standard: 'standard',
};

async function isAuthorised(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader === `Bearer ${secret}`) return true;
  const { userId } = await auth();
  return Boolean(userId);
}

export async function POST(request: Request) {
  if (!(await isAuthorised(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const skip = Math.max(0, Number(url.searchParams.get('skip') ?? 0) || 0);
  const take = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get('take') ?? 15) || 15),
  );

  const total = await database.deal.count();
  const deals = await database.deal.findMany({
    orderBy: { createdAt: 'asc' },
    skip,
    take,
    select: {
      id: true,
      address: true,
      postcode: true,
      propertyType: true,
      bedrooms: true,
      sellerType: true,
    },
  });

  // Founder-tuned offer policy (same lookup the deal-flow action uses).
  const activeConfig = await database.evalConfig.findFirst({
    where: { evalType: 'avm_confidence', activatedAt: { not: null } },
    orderBy: { version: 'desc' },
    select: { version: true, config: true },
  });
  const offerConfig = mergeOfferConfig(activeConfig?.config);
  const evalConfigVersion = activeConfig?.version ?? null;

  const results: Array<{
    id: string;
    address: string;
    ok: boolean;
    estimatedMarketValuePence?: number;
    ourOfferPence?: number;
    source?: string;
    error?: string;
  }> = [];

  for (const deal of deals) {
    try {
      const avmPropertyType =
        PROPERTY_TYPE_MAP[deal.propertyType.toLowerCase()] ?? 'terraced';
      const avmSellerType = SELLER_TYPE_MAP[deal.sellerType] ?? 'standard';

      const avm = await runAVM({
        postcode: deal.postcode,
        propertyType: avmPropertyType as never,
        address: deal.address,
        bedrooms: deal.bedrooms ?? undefined,
        sellerType: avmSellerType as never,
        dealId: deal.id,
        offerConfig,
      });
      const r = avm.resultJson;

      await database.avmResult.create({
        data: {
          dealId: deal.id,
          postcode: avm.postcode,
          propertyType: avm.propertyType,
          riskScore: avm.riskScore,
          resultJson: avm.resultJson as never,
          expiresAt: avm.expiresAt,
          evalConfigVersion,
        },
      });

      // AVM works in pounds; DB columns are pence — convert at this boundary.
      const estimatedMarketValuePence = Math.round(r.avmPointEstimate * 100);
      const ourOfferPence = Math.round(r.finalOffer * 100);
      const marginPercent =
        r.avmPointEstimate > 0
          ? ((r.avmPointEstimate - r.finalOffer) / r.avmPointEstimate) * 100
          : null;
      const verdict = r.requiresCeoEscalation
        ? 'THIN'
        : r.confidenceLevel === 'high'
          ? 'STRONG'
          : 'VIABLE';

      await database.deal.update({
        where: { id: deal.id },
        data: {
          estimatedMarketValuePence,
          ourOfferPence,
          marginPercent,
          verdict,
        },
      });

      await database.dealActivity.create({
        data: {
          dealId: deal.id,
          action: 'avm_backfilled',
          detail: `AVM re-run (unit fix + distance comps): EMV £${Math.round(
            r.avmPointEstimate,
          ).toLocaleString('en-GB')}, source ${r.avmSources}`,
        },
      });

      results.push({
        id: deal.id,
        address: deal.address,
        ok: true,
        estimatedMarketValuePence,
        ourOfferPence,
        source: r.avmSources,
      });
    } catch (error) {
      results.push({
        id: deal.id,
        address: deal.address,
        ok: false,
        error: (error as Error).message,
      });
    }
  }

  const processedThrough = skip + deals.length;
  const remaining = Math.max(0, total - processedThrough);

  return NextResponse.json({
    ok: true,
    total,
    skip,
    take,
    processed: deals.length,
    updated: results.filter((x) => x.ok).length,
    failed: results.filter((x) => !x.ok).length,
    remaining,
    nextSkip: remaining > 0 ? processedThrough : null,
    results,
  });
}

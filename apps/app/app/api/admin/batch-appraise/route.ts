import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { mergeOfferConfig, runAVM } from '@repo/valuation';
import { NextResponse } from 'next/server';
import { conservativeMarketValue } from '../../../../lib/batch/condition';
import { computeDiscount } from '../../../../lib/batch/discount';
import { fetchBatchSignals } from '../../../../lib/batch/signals';

/**
 * Run the AVM over a batch of uploaded properties.
 *
 * Chunked via ?take so a 40-row sheet (each row = geocode + comps + AVM) can't
 * blow the function time limit — the client calls this repeatedly until
 * `remaining` is 0. Runs server-side in production where PROPERTYDATA_API_KEY
 * is configured, so the distance-weighted sold comps are used.
 *
 * Per item: map type → runAVM (market value, in pounds) → apply the
 * conservative condition haircut → compute % discount of the underwriting
 * benchmark (Acceptable Trade Offer, else Sign-off, else left blank/flagged).
 *
 * Auth: logged-in founder (Clerk) OR Bearer CRON_SECRET.
 */

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

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
  const batchId = url.searchParams.get('batchId');
  if (!batchId) {
    return NextResponse.json({ error: 'batchId required' }, { status: 400 });
  }
  const take = Math.min(
    20,
    Math.max(1, Number(url.searchParams.get('take') ?? 8) || 8),
  );

  const batch = await database.propertyBatch.findUnique({
    where: { id: batchId },
    select: { id: true, totalItems: true },
  });
  if (!batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }

  // Founder-tuned offer policy (same lookup the deal-flow AVM uses).
  const activeConfig = await database.evalConfig.findFirst({
    where: { evalType: 'avm_confidence', activatedAt: { not: null } },
    orderBy: { version: 'desc' },
    select: { config: true },
  });
  const offerConfig = mergeOfferConfig(activeConfig?.config);

  // Pull the next chunk of not-yet-processed items.
  const items = await database.propertyBatchItem.findMany({
    where: { batchId, status: 'pending' },
    orderBy: { rowIndex: 'asc' },
    take,
  });

  let done = 0;
  let failed = 0;

  for (const item of items) {
    try {
      if (!item.postcode || !item.mappedType) {
        await database.propertyBatchItem.update({
          where: { id: item.id },
          data: {
            status: 'skipped',
            error: !item.postcode
              ? 'No postcode found in opportunity name'
              : 'Unrecognised property type',
          },
        });
        failed++;
        continue;
      }

      const avm = await runAVM({
        postcode: item.postcode,
        propertyType: item.mappedType as never,
        address: item.address,
        bedrooms: item.bedrooms ?? undefined,
        sellerType: 'standard',
        offerConfig,
      });
      const r = avm.resultJson;

      // Conservative, condition-adjusted market value (pounds), then → pence.
      const emvPounds = conservativeMarketValue(r.avmPointEstimate, item.condition);
      const estimatedMarketValuePence = Math.round(emvPounds * 100);

      const discount = computeDiscount(
        estimatedMarketValuePence,
        item.acceptableTradeOfferPence,
        item.signOffPricePence,
      );

      // Enrich with extra PropertyData signals. fetchBatchSignals is fully
      // defensive (Promise.allSettled + try/catch) so this can never throw and
      // never blocks the item being marked done with its AVM result.
      const signals = await fetchBatchSignals(item.postcode);

      await database.propertyBatchItem.update({
        where: { id: item.id },
        data: {
          estimatedMarketValuePence,
          avmLowPence: Math.round(r.avmLow * 100),
          avmHighPence: Math.round(r.avmHigh * 100),
          avmConfidence: r.confidenceLevel,
          comparableCount: r.comparableCount,
          avmSources: r.avmSources,
          discountPercent: discount.discountPercent,
          benchmarkUsed: discount.benchmarkUsed,
          floodRisk: signals.floodRisk,
          demandRating: signals.demandRating,
          grossYieldPct: signals.grossYieldPct,
          signalsJson: signals.signalsJson,
          status: 'done',
          error: null,
          resultJson: {
            avmPointEstimatePounds: r.avmPointEstimate,
            conservativeEmvPounds: emvPounds,
            condition: item.condition,
            confidenceLevel: r.confidenceLevel,
            comparableCount: r.comparableCount,
            sources: r.avmSources,
          },
        },
      });
      done++;
    } catch (error) {
      await database.propertyBatchItem.update({
        where: { id: item.id },
        data: { status: 'error', error: (error as Error).message },
      });
      failed++;
    }
  }

  // Recount and advance batch status.
  const processedItems = await database.propertyBatchItem.count({
    where: { batchId, status: { in: ['done', 'error', 'skipped'] } },
  });
  const remaining = await database.propertyBatchItem.count({
    where: { batchId, status: 'pending' },
  });
  await database.propertyBatch.update({
    where: { id: batchId },
    data: {
      processedItems,
      status: remaining === 0 ? 'complete' : 'processing',
    },
  });

  return NextResponse.json({
    ok: true,
    batchId,
    processedThisCall: items.length,
    done,
    failed,
    processedItems,
    totalItems: batch.totalItems,
    remaining,
  });
}

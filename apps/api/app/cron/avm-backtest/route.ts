import { env } from '@/env';
import { type Prisma, database } from '@repo/database';
import { getPricePaidWithAddresses } from '@repo/property-data/src/hmlr';
import { normaliseUkAddress } from '@repo/scouting/src/address-normalise';
import { NextResponse } from 'next/server';
import {
  HMLR_CALL_SPACING_MS,
  MAX_POSTCODES_PER_RUN,
  type MatchedRow,
  RECHECK_AFTER_DAYS,
  buildBacktestActionCopy,
  pickOutcomeSale,
  summariseMatched,
} from '../_lib/avm-backtest';
import { recordCronHeartbeat } from '../_lib/heartbeat';

/**
 * /cron/avm-backtest — monthly: judge frozen appraisals against reality.
 *
 * Every runAVM call site freezes an AvmSnapshot at decision time. This cron
 * (monthly, after HM Land Registry publishes the previous month's Price Paid
 * Data) does three things, in order:
 *
 *   1. EXCLUDE snapshots for properties we bought. Our purchase price is a
 *      discounted deal, not market value, so it cannot judge the AVM. (The
 *      resale-based test for deals we DID buy is scripts/avm-backtest.mts.)
 *   2. MATCH every pending snapshot to the property's first HMLR sale AFTER
 *      the appraisal, one free HMLR call per postcode, confident address
 *      matches only. Rows past the 18-month window are written off.
 *   3. REPORT: roll the whole matched cohort up (overall + by confidence,
 *      source, type, comps path, price band, engine version), store it as an
 *      AgentEvent, and refresh one deduped founder card for the month.
 *
 * Nothing here edits a snapshot's frozen appraisal fields — only the outcome
 * columns are appended. The AVM itself is NOT changed by this cron: the
 * decision (Sep 2026) is that the engine stays put until this has run.
 *
 * Auth: Bearer CRON_SECRET. Manual trigger: POST the same URL.
 */
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const propertyKey = (address: string, postcode: string): string => {
  const n = normaliseUkAddress(`${address}, ${postcode}`);
  return `${n.houseNumber ?? ''}|${n.street ?? ''}|${n.postcode ?? postcode.toUpperCase().trim()}`;
};

async function handle(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runId = `avm-backtest_${Date.now()}`;
  const now = new Date();
  const monthLabel = now.toISOString().slice(0, 7);

  // ── 1. Exclude properties we bought ──────────────────────────────────
  // A deal that exchanged or completed is ours; its price is not an outcome.
  const bought = await database.deal.findMany({
    where: { status: { in: ['exchanged', 'completed'] } },
    select: { id: true, address: true, postcode: true },
  });
  const boughtKeys = new Set(bought.map((d) => propertyKey(d.address, d.postcode)));
  const boughtDealIds = new Set(bought.map((d) => d.id));

  const pendingAll = await database.avmSnapshot.findMany({
    where: { matchStatus: 'pending' },
    orderBy: { appraisedAt: 'asc' },
    select: {
      id: true,
      source: true,
      sourceId: true,
      address: true,
      postcode: true,
      appraisedAt: true,
      lastCheckedAt: true,
    },
  });

  let excluded = 0;
  const stillPending: typeof pendingAll = [];
  for (const s of pendingAll) {
    const ours =
      (s.source === 'deal' && s.sourceId && boughtDealIds.has(s.sourceId)) ||
      boughtKeys.has(propertyKey(s.address, s.postcode));
    if (ours) {
      await database.avmSnapshot.update({
        where: { id: s.id },
        data: {
          matchStatus: 'excluded',
          exclusionReason: 'bought',
          lastCheckedAt: now,
        },
      });
      excluded++;
    } else {
      stillPending.push(s);
    }
  }

  // ── 2. Match against HMLR, one call per postcode ─────────────────────
  const recheckBefore = new Date(
    now.getTime() - RECHECK_AFTER_DAYS * 24 * 60 * 60 * 1000
  );
  const due = stillPending.filter(
    (s) => !s.lastCheckedAt || s.lastCheckedAt < recheckBefore
  );
  const byPostcode = new Map<string, typeof due>();
  for (const s of due) {
    const key = s.postcode.toUpperCase().trim();
    const list = byPostcode.get(key) ?? [];
    list.push(s);
    byPostcode.set(key, list);
  }
  // Oldest appraisal first: those are the rows most likely to have sold.
  const postcodes = [...byPostcode.keys()].slice(0, MAX_POSTCODES_PER_RUN);

  let matched = 0;
  let expired = 0;
  let checked = 0;
  let hmlrErrors = 0;
  for (const postcode of postcodes) {
    const rows = byPostcode.get(postcode) ?? [];
    let sales: Awaited<ReturnType<typeof getPricePaidWithAddresses>> = [];
    try {
      sales = await getPricePaidWithAddresses(postcode, 100);
    } catch {
      hmlrErrors++;
    }
    for (const s of rows) {
      checked++;
      // The adapter returns [] on failure; a row is only marked checked when
      // we actually saw the postcode's sales, so a bad month is retried.
      if (sales.length === 0 && hmlrErrors > 0) continue;
      const outcome = pickOutcomeSale(s, sales, now);
      if (outcome.status === 'matched') {
        await database.avmSnapshot.update({
          where: { id: s.id },
          data: {
            matchStatus: 'matched',
            matchedAt: now,
            lastCheckedAt: now,
            soldPricePence: Math.round(outcome.sale.price * 100),
            soldDate: new Date(outcome.sale.date),
            soldAddress: outcome.sale.address,
            matchScore: outcome.score,
            matchConfidence: outcome.confidence,
          },
        });
        matched++;
      } else if (outcome.status === 'expired') {
        await database.avmSnapshot.update({
          where: { id: s.id },
          data: {
            matchStatus: 'expired',
            lastCheckedAt: now,
            matchScore: outcome.bestScore,
          },
        });
        expired++;
      } else {
        await database.avmSnapshot.update({
          where: { id: s.id },
          data: { lastCheckedAt: now, matchScore: outcome.bestScore },
        });
      }
    }
    await sleep(HMLR_CALL_SPACING_MS);
  }

  // ── 3. Report over the WHOLE matched cohort ──────────────────────────
  const matchedRows = await database.avmSnapshot.findMany({
    where: { matchStatus: 'matched' },
    select: {
      pointEstimatePence: true,
      lowPence: true,
      highPence: true,
      soldPricePence: true,
      confidenceLevel: true,
      source: true,
      propertyType: true,
      csaSource: true,
      engineVersion: true,
    },
  });
  const cohort: MatchedRow[] = matchedRows
    .filter((r) => r.soldPricePence != null)
    .map((r) => ({ ...r, soldPricePence: r.soldPricePence as number }));
  const summary = summariseMatched(cohort);

  const counts = await database.avmSnapshot.groupBy({
    by: ['matchStatus'],
    _count: { _all: true },
  });
  const countOf = (status: string) =>
    counts.find((c) => c.matchStatus === status)?._count._all ?? 0;
  const cohortCounts = {
    pending: countOf('pending'),
    matched: countOf('matched'),
    excluded: countOf('excluded'),
    expired: countOf('expired'),
  };

  const copy = buildBacktestActionCopy({
    summary,
    pending: cohortCounts.pending,
    excluded: cohortCounts.excluded,
    expired: cohortCounts.expired,
    monthLabel,
  });

  const event = await database.agentEvent.create({
    data: {
      agent: 'appraiser',
      eventType: 'avm_backtest',
      summary: copy.title,
      pipelineRunId: runId,
      payload: {
        runId,
        monthLabel,
        thisRun: {
          checked,
          matched,
          expired,
          excluded,
          postcodesQueried: postcodes.length,
          postcodesDeferred: Math.max(0, byPostcode.size - postcodes.length),
          hmlrErrors,
        },
        cohort: cohortCounts,
        summary,
      } as unknown as Prisma.InputJsonObject,
    },
  });

  const dedupKey = `avm-backtest:${monthLabel}`;
  const actionData = {
    priority: copy.priority,
    title: copy.title,
    description: copy.description,
    metadata: {
      cohort: cohortCounts,
      overall: summary.overall,
    } as unknown as Prisma.InputJsonObject,
    expiresAt: new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000),
  };
  await database.founderAction.upsert({
    where: { dedupKey },
    create: {
      type: 'general',
      agent: 'appraiser',
      status: 'pending',
      dedupKey,
      agentEventId: event.id,
      ...actionData,
    },
    update: { agentEventId: event.id, ...actionData },
  });

  await recordCronHeartbeat('avm-backtest', {
    runId,
    note: `${matched} matched this run, ${summary.n} in cohort`,
  });

  return NextResponse.json({
    ok: true,
    runId,
    thisRun: { checked, matched, expired, excluded, postcodesQueried: postcodes.length, hmlrErrors },
    cohort: cohortCounts,
    overall: summary.overall,
  });
}

export const GET = handle;
export const POST = handle;

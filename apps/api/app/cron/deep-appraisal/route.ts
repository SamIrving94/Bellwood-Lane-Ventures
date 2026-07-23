import { env } from '@/env';
import { recordCronHeartbeat } from '../_lib/heartbeat';
import { database, Prisma } from '@repo/database';
import { checkListingLiveness } from '@repo/scouting';
import { runDeepAppraisal, type DeepAppraisal } from '@repo/valuation';
import { NextResponse } from 'next/server';

// Pipeline takes ~15-25s per appraisal (HMLR + EPC + HPI + LLM). Allow
// generous headroom for the per-run batch.
export const maxDuration = 800;

/**
 * /cron/deep-appraisal — daily at 08:30 (after pipeline-appraise)
 *
 * Produces decision-grade structured appraisals for the highest-leverage
 * properties surfaced overnight. Matches the multi-section format
 * Paperclip's Appraiser was producing manually:
 *   - Property summary, comparables (with cleanest match + outlier reasoning)
 *   - ARV with 50% + 80% confidence intervals
 *   - Environmental risk scoring (coal / radon / flood / knotweed / noise / construction)
 *   - Risk-adjusted bid cap with discount stack (auctions)
 *   - Recommendation, pre-action checklist, confidence, escalations
 *
 * Selection logic per run:
 *   1. STRONG ScoutLeads from last 24h that don't have an appraisal yet
 *   2. AuctionLots within the next 14 days that don't have an appraisal yet
 *
 * Cap: MAX_APPRAISALS_PER_RUN — guards spend (~£0.06 per appraisal at
 * Sonnet 4.5 with caching). At 10/day, ~£18/month worst case.
 *
 * Output: one FounderAction(type='review_appraisal', priority='high', agent='appraiser')
 * per appraisal, with the full structured payload in metadata. Renders on
 * /appraisals and on /leads/[id] detail.
 *
 * Idempotency: dedupKey = `appraisal:${entity}:${id}` so a re-fire over the
 * same window creates zero duplicates.
 */

const MAX_APPRAISALS_PER_RUN = 10;

async function handle(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const auctionHorizon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  // ── Candidate selection ─────────────────────────────────────────────
  const [strongLeads, upcomingLots] = await Promise.all([
    database.scoutLead.findMany({
      where: {
        verdict: 'STRONG',
        createdAt: { gte: since },
        // Passed leads are out — that's where lead-appraise parks listings it
        // found dead (SSTC/withdrawn), and where the founder puts rejects.
        status: { not: 'passed' },
      },
      orderBy: { leadScore: 'desc' },
      take: MAX_APPRAISALS_PER_RUN,
      select: {
        id: true,
        address: true,
        postcode: true,
        leadType: true,
        estimatedEquityPence: true,
        rawPayload: true,
      },
    }),
    database.auctionLot.findMany({
      where: {
        auctionDate: { gte: startedAt, lte: auctionHorizon },
      },
      orderBy: { auctionDate: 'asc' },
      take: MAX_APPRAISALS_PER_RUN,
      select: {
        id: true,
        address: true,
        postcode: true,
        auctionDate: true,
        propertyType: true,
        guidePriceMinPence: true,
        guidePriceMaxPence: true,
        lotUrl: true,
        sourceHouse: true,
      },
    }),
  ]);

  // Build a unified candidate list (interleave by leverage — STRONG leads
  // first, then auctions). Cap total at the per-run guard.
  type Candidate =
    | { kind: 'lead'; lead: (typeof strongLeads)[number] }
    | { kind: 'auction'; lot: (typeof upcomingLots)[number] };

  const candidates: Candidate[] = [
    ...strongLeads.map((lead) => ({ kind: 'lead' as const, lead })),
    ...upcomingLots.map((lot) => ({ kind: 'auction' as const, lot })),
  ].slice(0, MAX_APPRAISALS_PER_RUN);

  let produced = 0;
  let skippedDuplicate = 0;
  let skippedDead = 0;
  let failed = 0;
  const sample: Array<{ kind: string; ref: string; verdict?: string }> = [];

  for (const cand of candidates) {
    const dedupKey =
      cand.kind === 'lead'
        ? `appraisal:lead:${cand.lead.id}`
        : `appraisal:auction:${cand.lot.id}`;

    // Skip if already produced — idempotent over replays.
    const existing = await database.founderAction.findUnique({
      where: { dedupKey },
      select: { id: true },
    });
    if (existing) {
      skippedDuplicate++;
      continue;
    }

    // Build input + run.
    let appraisal: DeepAppraisal | null;
    let ref: string;
    let listingUrl: string | undefined;

    if (cand.kind === 'lead') {
      const lead = cand.lead;
      ref = `${lead.address}, ${lead.postcode}`;
      const raw = (lead.rawPayload ?? {}) as Record<string, unknown>;
      const pd = raw.propertyData as Record<string, unknown> | undefined;

      // Zero-credit gate before the LLM spend: reuse the liveness verdict
      // lead-appraise stored earlier this morning, or check the listing page
      // fresh. Fail-open — only a positive SSTC/withdrawn signal skips, and
      // the lead is parked as 'passed' (Passed tab), never deleted.
      const storedCheck = raw.listingCheck as { result?: string } | undefined;
      let liveness = storedCheck?.result ?? null;
      const leadListingUrl =
        typeof pd?.listingUrl === 'string' ? (pd.listingUrl as string) : null;
      if (!liveness && leadListingUrl) {
        const check = await checkListingLiveness(leadListingUrl);
        liveness = check.status;
        if (check.status === 'sstc' || check.status === 'removed') {
          try {
            await database.scoutLead.update({
              where: { id: lead.id },
              data: {
                status: 'passed',
                rawPayload: {
                  ...raw,
                  listingCheck: {
                    result: check.status,
                    marker: check.marker,
                    url: leadListingUrl,
                    checkedAt: new Date().toISOString(),
                  },
                } as Prisma.InputJsonValue,
              },
            });
          } catch (err) {
            console.warn('[deep-appraisal] failed to park dead lead', err);
          }
        }
      }
      if (liveness === 'sstc' || liveness === 'removed') {
        skippedDead++;
        continue;
      }

      appraisal = await runDeepAppraisal({
        address: lead.address,
        postcode: lead.postcode,
        propertyTypeHint:
          typeof pd?.propertyType === 'string' ? (pd.propertyType as string) : undefined,
        bedroomsHint:
          typeof pd?.bedrooms === 'number' ? (pd.bedrooms as number) : undefined,
        refurbishmentNotes:
          typeof pd?.summary === 'string' ? (pd.summary as string) : undefined,
        isAuction: false,
        sellerType: (() => {
          const t = (lead.leadType ?? '').toLowerCase();
          if (t.includes('probate')) return 'probate';
          if (t.includes('chain')) return 'chain_break';
          if (t.includes('repos')) return 'repossession';
          if (t.includes('short_lease') || t.includes('lease')) return 'short_lease';
          return 'standard';
        })(),
        estateValuePence: lead.estimatedEquityPence ?? undefined,
      });
    } else {
      const lot = cand.lot;
      ref = `${lot.address}, ${lot.postcode} (${lot.sourceHouse})`;
      listingUrl = lot.lotUrl ?? undefined;
      appraisal = await runDeepAppraisal({
        address: lot.address,
        postcode: lot.postcode,
        propertyTypeHint: lot.propertyType,
        isAuction: true,
        auctionDate: lot.auctionDate.toISOString().slice(0, 10),
        guidePricePence: lot.guidePriceMinPence ?? undefined,
        listingUrl,
      });
    }

    if (!appraisal) {
      failed++;
      continue;
    }

    // Persist as FounderAction(review_appraisal).
    const verdict = appraisal.recommendation.verdict;
    const priority =
      verdict === 'bid' || verdict === 'walk'
        ? 'high'
        : verdict === 'bid_with_caveats'
          ? 'high'
          : 'medium';

    const arvDisplay = `£${Math.round(appraisal.arv.pointEstimatePence / 100).toLocaleString('en-GB')}`;
    const bidCapDisplay = appraisal.bidCap
      ? ` · Hard cap £${Math.round(appraisal.bidCap.hardCapPence / 100).toLocaleString('en-GB')}`
      : '';

    const title = `${verdict.replace(/_/g, ' ').toUpperCase()}: ${ref} — ARV ${arvDisplay}${bidCapDisplay}`;
    const description = [
      appraisal.recommendation.headline,
      '',
      appraisal.recommendation.rationale,
      '',
      `Confidence: ${appraisal.confidence.level} (±${appraisal.confidence.estimatedErrorPercent.toFixed(1)}%)`,
      appraisal.escalations.length
        ? `\nEscalations: ${appraisal.escalations.join('; ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await database.founderAction.create({
        data: {
          type: 'review_appraisal',
          priority,
          status: 'pending',
          agent: 'appraiser',
          title: title.slice(0, 280),
          description,
          dedupKey,
          metadata: JSON.parse(
            JSON.stringify({
              kind: cand.kind,
              entityId: cand.kind === 'lead' ? cand.lead.id : cand.lot.id,
              listingUrl: listingUrl ?? null,
              appraisal,
              link:
                cand.kind === 'lead'
                  ? `/leads/${cand.lead.id}`
                  : `/appraisals`,
            }),
          ),
        },
      });
      produced++;
      sample.push({ kind: cand.kind, ref, verdict });
    } catch (err) {
      console.warn('[deep-appraisal] founderAction.create failed', err);
      failed++;
    }
  }

  // Telemetry.
  try {
    await database.agentEvent.create({
      data: {
        agent: 'appraiser',
        eventType: 'deep_appraisal_run',
        summary: `Produced ${produced} deep appraisals (${skippedDuplicate} dedup, ${skippedDead} dead listings, ${failed} failed) from ${candidates.length} candidates`,
        count: produced,
        payload: {
          candidates: candidates.length,
          produced,
          skippedDuplicate,
          skippedDead,
          failed,
          strongLeadsConsidered: strongLeads.length,
          auctionLotsConsidered: upcomingLots.length,
        },
      },
    });
  } catch (err) {
    console.warn('[deep-appraisal] AgentEvent create failed', err);
  }

  await recordCronHeartbeat('deep-appraisal', {
    note: `${produced} produced, ${failed} failed`,
  });

  return NextResponse.json({
    success: true,
    runDate: startedAt.toISOString(),
    candidates: candidates.length,
    produced,
    skippedDuplicate,
    skippedDead,
    failed,
    sample,
  });
}

export const POST = handle;
export const GET = handle;

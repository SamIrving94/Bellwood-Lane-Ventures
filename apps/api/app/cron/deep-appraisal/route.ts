import { env } from '@/env';
import { database } from '@repo/database';
import {
  type AvmCrossCheckInput,
  type DeepAppraisal,
  runDeepAppraisal,
} from '@repo/valuation';
import { NextResponse } from 'next/server';
import { recordCronHeartbeat } from '../_lib/heartbeat';

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
 *   1. ScoutLeads from last 24h without an appraisal: every prime/block
 *      lead (their volume-scorer verdict understates them by construction,
 *      so verdict is not a gate on those tracks — same rule as
 *      /cron/lead-appraise), then STRONG volume leads
 *   2. AuctionLots within the next 14 days that don't have an appraisal yet
 *
 * Cap: MAX_APPRAISALS_PER_RUN — guards spend (~£0.06 per appraisal on the
 * Sonnet default with caching; open-weights routes are far cheaper). At
 * 10/day, ~£18/month worst case. The model is picked on Settings → AI
 * models under feature 'deep_appraisal' — see @repo/valuation deep-appraisal.
 *
 * AVM second opinion: leads that /cron/lead-appraise (07:50) already ran the
 * in-house AVM on carry `rawPayload.avmFull`. We hand that figure to the
 * appraisal so the model agrees with or challenges it, and the verdict lands
 * in `appraisal.avmCrossCheck` + the action description.
 *
 * Output: one FounderAction(type='review_appraisal', priority='high', agent='appraiser')
 * per appraisal, with the full structured payload in metadata. Renders on
 * /appraisals and on /leads/[id] detail.
 *
 * Idempotency: dedupKey = `appraisal:${entity}:${id}` so a re-fire over the
 * same window creates zero duplicates.
 */

const MAX_APPRAISALS_PER_RUN = 10;

/**
 * Lift the deterministic AVM out of the lead's rawPayload (written by
 * /cron/lead-appraise) into the deep-appraisal input. Undefined when the
 * AVM hasn't run — the prompt then asks for verdict 'no_avm'.
 */
function avmCrossCheckFromRaw(
  raw: Record<string, unknown>
): AvmCrossCheckInput | undefined {
  const avm = raw.avmFull as Record<string, unknown> | undefined;
  if (!avm || typeof avm.pointEstimatePence !== 'number') {
    return undefined;
  }
  const num = (v: unknown) => (typeof v === 'number' ? v : null);
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  return {
    pointEstimatePence: avm.pointEstimatePence,
    lowPence: num(avm.lowPence),
    highPence: num(avm.highPence),
    finalOfferPence: num(avm.finalOfferPence),
    confidenceLevel: str(avm.confidenceLevel),
    comparableCount: num(avm.comparableCount),
    riskScore: num(avm.riskScore),
    refurbEstimatePence: num(avm.refurbEstimatePence),
    conditionVisual: str(avm.conditionVisual),
    conditionFlags: Array.isArray(avm.conditionFlags)
      ? avm.conditionFlags.filter((f): f is string => typeof f === 'string')
      : null,
  };
}

async function handle(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const auctionHorizon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  // ── Candidate selection ─────────────────────────────────────────────
  const [leadCandidates, upcomingLots] = await Promise.all([
    database.scoutLead.findMany({
      where: {
        createdAt: { gte: since },
        // Passed leads are out — the founder's rejects, plus anything the
        // scout parked on a recorded dealbreaker. Deep appraisal is the most
        // expensive step in the pipeline; don't spend it on a lead already
        // ruled out.
        status: { not: 'passed' },
        // Volume leads must have earned STRONG. Prime/block leads qualify
        // regardless of verdict: the volume scorer is structurally hostile
        // to them, and gating the deepest (most decision-grade) appraisal
        // on that verdict meant prime stock never received one — the exact
        // partial-edit failure the SW3 incident warns about.
        OR: [{ verdict: 'STRONG' }, { track: { in: ['prime', 'block'] } }],
      },
      orderBy: { leadScore: 'desc' },
      // Over-fetch so prime/block leads survive even when a busy day
      // produces more STRONG volume leads than the per-run cap.
      take: MAX_APPRAISALS_PER_RUN * 2,
      select: {
        id: true,
        address: true,
        postcode: true,
        leadType: true,
        track: true,
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

  // Build a unified candidate list by leverage: prime/block leads first
  // (scarce, time-sensitive, and their leadScore understates them), then
  // STRONG volume leads, then auctions. Sort is stable, so within each group
  // the leadScore-desc DB order holds. Cap total at the per-run guard.
  const rankedLeads = [...leadCandidates].sort(
    (a, b) => (a.track !== 'volume' ? 0 : 1) - (b.track !== 'volume' ? 0 : 1)
  );

  type Candidate =
    | { kind: 'lead'; lead: (typeof leadCandidates)[number] }
    | { kind: 'auction'; lot: (typeof upcomingLots)[number] };

  const candidates: Candidate[] = [
    ...rankedLeads.map((lead) => ({ kind: 'lead' as const, lead })),
    ...upcomingLots.map((lot) => ({ kind: 'auction' as const, lot })),
  ].slice(0, MAX_APPRAISALS_PER_RUN);

  let produced = 0;
  let skippedDuplicate = 0;
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

      appraisal = await runDeepAppraisal({
        address: lead.address,
        postcode: lead.postcode,
        propertyTypeHint:
          typeof pd?.propertyType === 'string'
            ? (pd.propertyType as string)
            : undefined,
        bedroomsHint:
          typeof pd?.bedrooms === 'number'
            ? (pd.bedrooms as number)
            : undefined,
        refurbishmentNotes:
          typeof pd?.summary === 'string' ? (pd.summary as string) : undefined,
        isAuction: false,
        sellerType: (() => {
          const t = (lead.leadType ?? '').toLowerCase();
          if (t.includes('probate')) return 'probate';
          if (t.includes('chain')) return 'chain_break';
          if (t.includes('repos')) return 'repossession';
          if (t.includes('short_lease') || t.includes('lease'))
            return 'short_lease';
          return 'standard';
        })(),
        estateValuePence: lead.estimatedEquityPence ?? undefined,
        avmCrossCheck: avmCrossCheckFromRaw(raw),
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
      // Older appraisals (pre cross-check) have no avmCrossCheck; guard.
      appraisal.avmCrossCheck &&
      appraisal.avmCrossCheck.verdict !== 'no_avm' &&
      appraisal.avmCrossCheck.avmPointEstimatePence != null
        ? `vs in-house AVM £${Math.round(appraisal.avmCrossCheck.avmPointEstimatePence / 100).toLocaleString('en-GB')}: ${appraisal.avmCrossCheck.verdict.replace(/_/g, ' ')}${
            appraisal.avmCrossCheck.deltaPercent != null
              ? ` (${appraisal.avmCrossCheck.deltaPercent > 0 ? '+' : ''}${appraisal.avmCrossCheck.deltaPercent.toFixed(1)}%)`
              : ''
          }`
        : '',
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
                cand.kind === 'lead' ? `/leads/${cand.lead.id}` : `/appraisals`,
            })
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
        summary: `Produced ${produced} deep appraisals (${skippedDuplicate} dedup, ${failed} failed) from ${candidates.length} candidates`,
        count: produced,
        payload: {
          candidates: candidates.length,
          produced,
          skippedDuplicate,
          failed,
          leadsConsidered: leadCandidates.length,
          primeLeadsConsidered: rankedLeads.filter((l) => l.track !== 'volume')
            .length,
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
    failed,
    sample,
  });
}

export const POST = handle;
export const GET = handle;

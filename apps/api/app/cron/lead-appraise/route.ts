import { env } from '@/env';
import { screenPropertyCondition } from '@repo/auctions';
import { type Prisma, database } from '@repo/database';
import { getPropertySnapshot } from '@repo/property-data/src/propertydata';
import {
  type ScoreFactor,
  type ScorerConfig,
  type Verdict,
  combineScore,
  isEnteringHighPropensityWindow,
  mergeScorerConfig,
} from '@repo/scouting';
import {
  type ConditionLevel,
  appraiseDealFromAvm,
  estimateRefurb,
  mapVisualConditionToLevel,
  mergeOfferConfig,
  mergeValuationConfig,
  runAVM,
} from '@repo/valuation';
import { NextResponse } from 'next/server';
import { recordCronHeartbeat } from '../_lib/heartbeat';

// Auto-appraise cron — runs the in-house AVM + photo-condition vision on the
// strongest un-appraised leads so the numbers are ready on the Leads page
// without the founder clicking "Appraise" on each one. Bounded per run so it
// stays well inside the function budget and PropertyData/Claude spend stays
// predictable. Runs after the scouting cron (which lands new leads at 7am).
export const maxDuration = 800;

// How many leads to appraise per run. Each is ~1 AVM + 1 snapshot (~22 PD
// credits) + 1 vision call, so this bounds both time and spend.
const MAX_APPRAISALS_PER_RUN = 8;

type PropertyType =
  | 'detached'
  | 'semi-detached'
  | 'terraced'
  | 'flat'
  | 'bungalow';

function normalisePropertyType(raw: unknown): PropertyType | undefined {
  if (typeof raw !== 'string') return undefined;
  const lower = raw.toLowerCase();
  if (lower.includes('detached') && lower.includes('semi'))
    return 'semi-detached';
  if (lower.includes('detached')) return 'detached';
  if (lower.includes('terraced') || lower.includes('terrace'))
    return 'terraced';
  if (
    lower.includes('flat') ||
    lower.includes('apartment') ||
    lower.includes('studio')
  )
    return 'flat';
  if (lower.includes('bungalow')) return 'bungalow';
  return undefined;
}

// ---------------------------------------------------------------------------
// Propensity-window resurfacing
// ---------------------------------------------------------------------------

/**
 * Days since a lead's t=0 signal (Gazette notice / insolvency filing /
 * receiver appointment), TODAY. The signal date lives in rawPayload only:
 * prefer the ISO `grantDate` every source stamps; fall back to the captured
 * `daysSinceGrant` aged forward by the row's own age. Null when neither
 * exists — a lead with no signal date has no clock to read.
 */
function daysSinceSignalFor(lead: {
  createdAt: Date;
  rawPayload: unknown;
}): number | null {
  const raw = (lead.rawPayload ?? {}) as Record<string, unknown>;
  if (typeof raw.grantDate === 'string') {
    const ms = new Date(raw.grantDate).getTime();
    if (Number.isFinite(ms)) {
      return Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
    }
  }
  if (typeof raw.daysSinceGrant === 'number') {
    const rowAgeDays = Math.max(
      0,
      Math.floor((Date.now() - lead.createdAt.getTime()) / 86_400_000)
    );
    return Math.max(0, raw.daysSinceGrant) + rowAgeDays;
  }
  return null;
}

/** Founder-facing window name per lead type (Beth Sims: plain, precise). */
function windowName(leadType: string): string {
  if (leadType.startsWith('probate')) return 'the grant window';
  if (leadType === 'insolvency') return 'the statutory proposal window';
  return 'their high-propensity window';
}

/**
 * The resurfacing mechanism for leads captured weeks ago: find live leads
 * whose statutory clock crossed into the high-propensity window within the
 * last 7 days (probate leads entering the Grant of Probate window, insolvency
 * leads hitting the proposal deadline) and raise ONE deduped FounderAction
 * per lead type per week. Capture happened at t=0 as always — this is the
 * moment the timeline says those leads deserve attention again.
 *
 * DB-only (no credits), best-effort: a failure here never blocks appraisals.
 */
async function resurfacePropensityWindows(
  scorerConfig: ScorerConfig
): Promise<{ entering: number; actions: number }> {
  const curveTypes = Object.keys(scorerConfig.propensityCurves);
  if (curveTypes.length === 0) return { entering: 0, actions: 0 };

  // Live, unconverted leads young enough for any curve to still move
  // (18 months comfortably covers every default curve's active range).
  const leads = await database.scoutLead.findMany({
    where: {
      status: { in: ['new', 'shortlisted', 'watching'] },
      convertedDealId: null,
      leadType: { in: curveTypes },
      createdAt: { gte: new Date(Date.now() - 548 * 86_400_000) },
    },
    select: {
      id: true,
      address: true,
      postcode: true,
      leadType: true,
      leadScore: true,
      createdAt: true,
      rawPayload: true,
    },
  });

  const enteringByType = new Map<string, typeof leads>();
  for (const lead of leads) {
    const days = daysSinceSignalFor(lead);
    if (days === null) continue;
    if (isEnteringHighPropensityWindow(lead.leadType, days, 7, scorerConfig)) {
      const group = enteringByType.get(lead.leadType) ?? [];
      group.push(lead);
      enteringByType.set(lead.leadType, group);
    }
  }

  // One action per lead type, deduped per ISO week (Monday-keyed) so the
  // daily run refreshes the same card as more leads cross during the week
  // instead of stacking a new one every morning.
  const monday = new Date();
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const weekBucket = monday.toISOString().slice(0, 10);

  let actions = 0;
  let entering = 0;
  for (const [leadType, group] of enteringByType) {
    entering += group.length;
    const n = group.length;
    const plural = n === 1 ? 'lead' : 'leads';
    const typeLabel = leadType.replace(/_/g, ' ');
    const title = `${n} ${typeLabel} ${plural} entering ${windowName(leadType)} this week`;
    const description = leadType.startsWith('probate')
      ? `Captured at notice and held while the executor couldn't sell. The statutory timeline now puts ${n === 1 ? 'this estate' : 'these estates'} in the Grant of Probate window — they can transact. Review and queue outreach drafts (drafts stay held for your approval).`
      : `The statutory timeline puts ${n === 1 ? 'this lead' : 'these leads'} in ${windowName(leadType)} — the point where disposal decisions get made. Review and queue outreach drafts (drafts stay held for your approval).`;
    const dedupKey = `propensity-window:${leadType}:${weekBucket}`;
    const actionData = {
      type: 'golden_window' as const,
      priority: 'high' as const,
      agent: 'scout' as const,
      title,
      description,
      metadata: JSON.parse(
        JSON.stringify({
          source: 'cron_lead-appraise',
          leadType,
          weekBucket,
          leadCount: n,
          leadIds: group.slice(0, 20).map((l) => l.id),
          leadSample: group
            .slice(0, 3)
            .map((l) => `${l.address}, ${l.postcode}`),
          link: '/pipeline?tab=leads',
        })
      ) as Prisma.InputJsonValue,
    };
    await database.founderAction.upsert({
      where: { dedupKey },
      create: { ...actionData, status: 'pending', dedupKey },
      // No `status` in update: as more leads cross during the week the card's
      // count refreshes, but a card the founder already dismissed or completed
      // stays that way — the cron must not resurrect it every morning.
      update: actionData,
    });
    actions++;
  }
  return { entering, actions };
}

// Mirror the manual appraise action's seller-type resolver so the cron AVM and
// the button AVM classify the same lead identically.
function resolveSellerType(leadType: string | null | undefined): string {
  const t = (leadType ?? '').toLowerCase();
  if (t.includes('probate')) return 'probate';
  if (t.includes('chain')) return 'chain_break';
  if (t.includes('repos')) return 'repossession';
  if (t.includes('lease')) return 'short_lease';
  if (t.includes('reloc')) return 'relocation';
  return 'standard';
}

export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Candidate pool: worth-pursuing leads that are still live. Shortlisted and
  // watching leads (founder triage) stay in the pool — a shortlisted lead
  // needs its appraisal MORE, not less. Passed/converted drop out. We pull a
  // generous batch ordered by score and filter in code to those not yet
  // appraised (avmFull absent), since Prisma can't easily query JSON-key
  // absence.
  //
  // Prime/block leads are fetched SEPARATELY and put at the FRONT of the
  // queue. Two reasons, both learned the hard way: (1) the volume scorer is
  // structurally hostile to them, so a single score-ordered window let a
  // backlog of STRONG volume leads push every prime lead outside the take
  // and it never got appraised at all; (2) prime stock is scarce and founder
  // decisions on it are time-sensitive — its numbers must be ready the same
  // day it is sourced, not whenever the volume queue drains.
  const [primeCandidates, volumeCandidates] = await Promise.all([
    database.scoutLead.findMany({
      where: {
        status: { in: ['new', 'shortlisted', 'watching'] },
        track: { in: ['prime', 'block'] },
      },
      orderBy: { leadScore: 'desc' },
      take: 30,
    }),
    database.scoutLead.findMany({
      where: {
        status: { in: ['new', 'shortlisted', 'watching'] },
        track: 'volume',
        // Volume leads must have earned STRONG/VIABLE; prime and block are
        // appraised regardless — verdict is not a meaningful gate on those
        // tracks (see above).
        verdict: { in: ['STRONG', 'VIABLE'] },
      },
      orderBy: { leadScore: 'desc' },
      take: 60,
    }),
  ]);
  const candidates = [...primeCandidates, ...volumeCandidates];

  const pending = candidates.filter((lead) => {
    const raw = (lead.rawPayload ?? {}) as Record<string, unknown>;
    const avm = raw.avmFull as { pointEstimatePence?: unknown } | undefined;
    return typeof avm?.pointEstimatePence !== 'number';
  });

  // Founder-tuned offer policy (highest active avm_confidence EvalConfig).
  const activeConfig = await database.evalConfig.findFirst({
    where: { evalType: 'avm_confidence', activatedAt: { not: null } },
    orderBy: { version: 'desc' },
    select: { config: true },
  });
  const offerConfig = mergeOfferConfig(activeConfig?.config);

  // Founder-tuned valuation levers (refurb £/m² + defect costs).
  const valuationRow = await database.setting.findUnique({
    where: { key: 'valuation.config' },
  });
  const valuationConfig = mergeValuationConfig(valuationRow?.value ?? null);

  let appraised = 0;
  const errors: string[] = [];

  for (const lead of pending) {
    if (appraised >= MAX_APPRAISALS_PER_RUN) break;
    const raw = (lead.rawPayload ?? {}) as Record<string, unknown>;
    const pd = raw.propertyData as Record<string, unknown> | undefined;

    try {
      const normalised = normalisePropertyType(pd?.propertyType);
      const avmPropertyType =
        normalised === 'bungalow' ? 'detached' : (normalised ?? 'terraced');
      const bedrooms =
        typeof pd?.bedrooms === 'number' ? (pd.bedrooms as number) : undefined;

      // Snapshot (skip refetch if recent — same 7-day rule as the manual path).
      const existing = raw.snapshot as { fetchedAt?: string } | undefined;
      const snapshotFresh =
        existing?.fetchedAt &&
        Date.now() - new Date(existing.fetchedAt).getTime() <
          7 * 24 * 60 * 60 * 1000;
      const snapshot = snapshotFresh
        ? (raw.snapshot as unknown)
        : await getPropertySnapshot({
            postcode: lead.postcode,
            address: lead.address,
            propertyType: normalised,
            bedrooms,
          });

      // Prefer a precise (house-numbered) address when the listing gave one —
      // it lets the AVM match the exact EPC floor-area record for this house.
      const preciseAddress =
        typeof pd?.preciseAddress === 'string'
          ? (pd.preciseAddress as string)
          : null;
      const avm = await runAVM({
        postcode: lead.postcode,
        propertyType: avmPropertyType as never,
        address: preciseAddress ?? lead.address,
        bedrooms,
        sellerType: resolveSellerType(lead.leadType) as never,
        offerConfig,
      });
      const r = avm.resultJson;
      const point = r.avmPointEstimate;
      const offerDiscountPct =
        point > 0 ? ((point - r.finalOffer) / point) * 100 : null;

      const avmFull: Record<string, unknown> = {
        pointEstimatePence: Math.round(point * 100),
        lowPence: r.avmLow != null ? Math.round(r.avmLow * 100) : null,
        highPence: r.avmHigh != null ? Math.round(r.avmHigh * 100) : null,
        finalOfferPence: Math.round(r.finalOffer * 100),
        offerDiscountPct,
        confidenceLevel: r.confidenceLevel ?? null,
        comparableCount: r.comparableCount ?? null,
        comparables: r.comparables ?? [],
        requiresReview: Boolean(r.requiresCeoEscalation || r.discountCapped),
        riskScore: avm.riskScore,
        assumedPropertyType: normalised ? null : avmPropertyType,
        floorAreaSqm: r.floorAreaSqm ?? null,
        floorAreaSource: r.floorAreaSource ?? null,
        resolvedAddress: r.resolvedAddress ?? null,
        // Flag likely HMO/multi-let (5+ beds) so the UI can caveat the AVM and
        // scoring can withhold ROI credit — a house AVM under-values these.
        hmoLikely: (bedrooms ?? 0) >= 5,
        fetchedAt: new Date().toISOString(),
      };

      // Photo-condition vision (reuses the auction screener). Graceful: leaves
      // condition manual on no photo / no key / error.
      const photoUrls = [
        typeof pd?.imageUrl === 'string' ? (pd.imageUrl as string) : null,
      ].filter((u): u is string => !!u);
      if (photoUrls.length > 0) {
        const assessment = await screenPropertyCondition({
          ref: lead.id,
          address: lead.address,
          photoUrls,
        });
        if (assessment) {
          avmFull.inferredCondition = mapVisualConditionToLevel(
            assessment.condition
          );
          avmFull.conditionVisual = assessment.condition;
          avmFull.conditionFlags = assessment.flags;
          avmFull.conditionRationale = assessment.rationale;
          avmFull.conditionConfidence = assessment.confidence;
        }
      }

      // Transparent refurb estimate from the photo read + EPC floor area.
      const refurb = estimateRefurb(
        {
          condition: (avmFull.conditionVisual as string | undefined) ?? null,
          flags: (avmFull.conditionFlags as string[] | undefined) ?? null,
          floorAreaSqm:
            (avmFull.floorAreaSqm as number | null | undefined) ?? null,
        },
        {
          perSqm: valuationConfig.refurbPerSqm,
          flagCost: valuationConfig.refurbFlagCosts,
          defaultFloorAreaSqm: valuationConfig.defaultFloorAreaSqm,
        }
      );
      avmFull.refurbEstimatePence = refurb.totalPence;
      avmFull.refurbLines = refurb.lines;
      avmFull.refurbBasis = refurb.basis;
      avmFull.refurbAssumedFloorArea = refurb.assumedFloorArea;

      // ── Stage-2 scoring: fold the appraisal's ROI into the lead score ──
      // The scout pipeline set the sourcing score (acquisition + market + risk)
      // with a provisional ROI proxy. Now that we have an AVM we replace that
      // with the REAL ROI pillar: BMV discount (asking vs AVM) + deal-model cash
      // ROI. Factor labels carry the underlying inputs so the founder can trace
      // every point (transparency). Best-effort: a failure leaves the sourcing
      // score untouched.
      const scoreUpdate: { leadScore?: number; verdict?: Verdict } = {};
      try {
        const askingPence =
          typeof pd?.pricePence === 'number' ? (pd.pricePence as number) : null;
        const avmPoint = avmFull.pointEstimatePence as number;
        const bmvDiscountPct =
          askingPence && avmPoint > 0
            ? ((avmPoint - askingPence) / avmPoint) * 100
            : null;

        const deal = appraiseDealFromAvm({
          avmPointEstimatePence: avmPoint,
          conditionLevel:
            (avmFull.inferredCondition as ConditionLevel | null) ?? undefined,
          refurbPence: (avmFull.refurbEstimatePence as number) ?? 0,
          offerPence: (avmFull.finalOfferPence as number) ?? undefined,
        });
        const cashRoiPct = deal.appraisal
          ? deal.appraisal.cash.roi * 100
          : null;

        const baseFactors =
          (raw.scoreFactors as ScoreFactor[] | undefined) ?? [];
        if (baseFactors.length > 0) {
          const combined = combineScore(
            baseFactors,
            {
              bmvDiscountPct,
              cashRoiPct,
              avmConfidence:
                (avmFull.confidenceLevel as 'high' | 'medium' | 'low' | null) ??
                null,
              comparableCount:
                (avmFull.comparableCount as number | null) ?? null,
              // 5+ beds ⇒ likely HMO/multi-let: a house AVM can't value it.
              // Except on the prime track — a 6-bed prime house is exactly
              // what that track exists for, and damping its ROI to zero
              // buried every prime lead. Blocks stay unreliable regardless:
              // a house AVM genuinely cannot value a multi-unit freehold.
              avmUnreliable:
                lead.track === 'block' ||
                (lead.track !== 'prime' && (bedrooms ?? 0) >= 5),
            },
            {
              hasCriticalData: true,
              marketTrendLabel: lead.marketTrend ?? 'unknown',
              riskFlags: (raw.riskFlags as string[] | undefined) ?? [],
            }
          );
          raw.scoreFactors = combined.factors;
          raw.rationale = combined.rationale;
          raw.leadingIndicator = combined.leadingIndicator;
          raw.scoreBreakdown = {
            acquisition: combined.acquisition,
            roi: combined.roi,
            marketTrend: combined.marketTrend,
            risk: combined.risk,
            total: combined.total,
            appraised: true,
          };
          scoreUpdate.leadScore = combined.total;
          scoreUpdate.verdict = combined.verdict;
        }
      } catch (err) {
        console.warn(
          '[cron/lead-appraise] stage-2 scoring failed',
          lead.id,
          err
        );
      }

      await database.scoutLead.update({
        where: { id: lead.id },
        data: {
          ...scoreUpdate,
          rawPayload: { ...raw, snapshot, avmFull } as Prisma.InputJsonValue,
        },
      });
      appraised++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${lead.id}: ${msg.slice(0, 120)}`);
      console.warn('[cron/lead-appraise] failed for', lead.id, err);
    }
  }

  // ── Propensity-window pass — resurface leads whose statutory clock just
  // opened (see resurfacePropensityWindows). Uses the same founder-tunable
  // lead_scoring EvalConfig as the scouting cron so retuned curve breakpoints
  // take effect here without a deploy. Best-effort: never blocks appraisals.
  let propensity = { entering: 0, actions: 0 };
  try {
    let scorerConfig = mergeScorerConfig(null);
    const activeScoring = await database.evalConfig.findFirst({
      where: { evalType: 'lead_scoring', activatedAt: { not: null } },
      orderBy: { version: 'desc' },
      select: { config: true },
    });
    if (activeScoring) {
      scorerConfig = mergeScorerConfig(activeScoring.config);
    }
    propensity = await resurfacePropensityWindows(scorerConfig);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`propensity-pass: ${msg.slice(0, 120)}`);
    console.warn('[cron/lead-appraise] propensity-window pass failed', err);
  }

  await recordCronHeartbeat('lead-appraise', {
    note: `appraised ${appraised}/${pending.length}; propensity: ${propensity.entering} entering window`,
  });

  return NextResponse.json({
    success: true,
    candidates: candidates.length,
    pending: pending.length,
    appraised,
    propensity,
    errors,
  });
};

// Vercel cron sends GET by default.
export const GET = POST;

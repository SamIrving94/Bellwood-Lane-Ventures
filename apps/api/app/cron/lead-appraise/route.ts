import { env } from '@/env';
import { screenPropertyCondition } from '@repo/auctions';
import { type Prisma, database } from '@repo/database';
import { getPropertySnapshot } from '@repo/property-data/src/propertydata';
import {
  type ConditionLevel,
  appraiseDealFromAvm,
  estimateRefurb,
  mapVisualConditionToLevel,
  mergeOfferConfig,
  mergeValuationConfig,
  runAVM,
} from '@repo/valuation';
import { type ScoreFactor, type Verdict, combineScore } from '@repo/scouting';
import { NextResponse } from 'next/server';
import { recordCronHeartbeat } from '../_lib/heartbeat';

// Auto-appraise cron — runs the in-house AVM + photo-condition vision on the
// strongest un-appraised leads so the numbers are ready on the Leads page
// without the founder clicking "Appraise" on each one. Bounded per run so it
// stays well inside the function budget and PropertyData/Claude spend stays
// predictable. Runs after the scouting cron (which lands new leads at 7am).
export const maxDuration = 300;

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

  // Candidate pool: new, worth-pursuing leads. We pull a generous batch ordered
  // by score and filter in code to those not yet appraised (avmFull absent),
  // since Prisma can't easily query JSON-key absence.
  const candidates = await database.scoutLead.findMany({
    where: { status: 'new', verdict: { in: ['STRONG', 'VIABLE'] } },
    orderBy: { leadScore: 'desc' },
    take: 60,
  });

  const pending = candidates
    .filter((lead) => {
      const raw = (lead.rawPayload ?? {}) as Record<string, unknown>;
      const avm = raw.avmFull as { pointEstimatePence?: unknown } | undefined;
      return typeof avm?.pointEstimatePence !== 'number';
    })
    .slice(0, MAX_APPRAISALS_PER_RUN);

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
    try {
      const raw = (lead.rawPayload ?? {}) as Record<string, unknown>;
      const pd = raw.propertyData as Record<string, unknown> | undefined;
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
        typeof pd?.preciseAddress === 'string' ? (pd.preciseAddress as string) : null;
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
        },
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
              comparableCount: (avmFull.comparableCount as number | null) ?? null,
              // 5+ beds ⇒ likely HMO/multi-let: a house AVM can't value it.
              avmUnreliable: (bedrooms ?? 0) >= 5,
            },
            {
              hasCriticalData: true,
              marketTrendLabel: lead.marketTrend ?? 'unknown',
              riskFlags: (raw.riskFlags as string[] | undefined) ?? [],
            },
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
        console.warn('[cron/lead-appraise] stage-2 scoring failed', lead.id, err);
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

  await recordCronHeartbeat('lead-appraise', {
    note: `appraised ${appraised}/${pending.length}`,
  });

  return NextResponse.json({
    success: true,
    candidates: candidates.length,
    pending: pending.length,
    appraised,
    errors,
  });
};

// Vercel cron sends GET by default.
export const GET = POST;

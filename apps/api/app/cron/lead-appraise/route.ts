import { env } from '@/env';
import { screenPropertyCondition } from '@repo/auctions';
import { type Prisma, database } from '@repo/database';
import { getPropertySnapshot } from '@repo/property-data/src/propertydata';
import {
  mapVisualConditionToLevel,
  mergeOfferConfig,
  runAVM,
} from '@repo/valuation';
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

      const avm = await runAVM({
        postcode: lead.postcode,
        propertyType: avmPropertyType as never,
        address: lead.address,
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
        requiresReview: Boolean(r.requiresCeoEscalation || r.discountCapped),
        riskScore: avm.riskScore,
        assumedPropertyType: normalised ? null : avmPropertyType,
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
          avmFull.conditionRationale = assessment.rationale;
          avmFull.conditionConfidence = assessment.confidence;
        }
      }

      await database.scoutLead.update({
        where: { id: lead.id },
        data: {
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

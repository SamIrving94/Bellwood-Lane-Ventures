'use server';

import { auth } from '@repo/auth/server';
import { database, Prisma } from '@repo/database';
import { getPropertySnapshot } from '@repo/property-data/src/propertydata';
import { mergeOfferConfig, runAVM } from '@repo/valuation';
import { revalidatePath } from 'next/cache';

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
  if (lower.includes('flat') || lower.includes('apartment') || lower.includes('studio'))
    return 'flat';
  if (lower.includes('bungalow')) return 'bungalow';
  return undefined;
}

// Resolve the AVM's SellerType from a lead's free-text leadType so the
// risk-adjusted offer reflects the seller situation. Uses substring matching
// (not exact keys) to match the values leads actually carry — listing/source
// categories like "repossessed-properties" or "short-lease-properties", not
// the clean enum. Mirrors the deep-appraisal cron's resolver so the lead AVM,
// the deep appraisal, and the deal offer all classify the same lead alike.
function resolveSellerType(leadType: string | null | undefined): string {
  const t = (leadType ?? '').toLowerCase();
  if (t.includes('probate')) return 'probate';
  if (t.includes('chain')) return 'chain_break';
  if (t.includes('repos')) return 'repossession';
  if (t.includes('lease')) return 'short_lease';
  if (t.includes('reloc')) return 'relocation';
  return 'standard';
}

/**
 * On-demand appraisal for a single lead. Fetches the full property snapshot
 * (sold comps + yields + EPC + tenure + council tax + flood + demand/growth)
 * AND runs the canonical in-house AVM (`runAVM`) to produce a defensible
 * market value, a risk-adjusted offer, a confidence level and comparable
 * count. Both are merged into the lead's rawPayload so the deal sheet can show
 * the buy-vs-share decision without converting the lead to a deal first.
 *
 * Idempotent and cacheable: skips the credit-spending snapshot refetch if it
 * ran in the last 7 days, but always (re)runs the AVM, which is cheap once the
 * snapshot's HMLR comps are warm.
 */
export async function enrichLeadById(leadId: string): Promise<{
  ok: boolean;
  fetched?: boolean;
  error?: string;
}> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Unauthorized' };

  const lead = await database.scoutLead.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false, error: 'Lead not found' };

  const raw = (lead.rawPayload ?? {}) as Record<string, unknown>;
  const pd = raw.propertyData as Record<string, unknown> | undefined;

  // AVM accepts detached | semi-detached | terraced | flat. Default a missing
  // type to terraced (the modal UK stock) rather than skipping valuation —
  // distressed sourced leads frequently have no type, and a typeless lead
  // should still get a usable number, matching generate-offer's behaviour.
  const normalised = normalisePropertyType(pd?.propertyType);
  const avmPropertyType = normalised === 'bungalow' ? 'detached' : (normalised ?? 'terraced');
  const bedrooms =
    typeof pd?.bedrooms === 'number' ? (pd.bedrooms as number) : undefined;
  const avmSellerType = resolveSellerType(lead.leadType);

  // ── Snapshot (facts/lens/comps). Skip the refetch if recent. ───────────
  const existing = raw.snapshot as { fetchedAt?: string } | undefined;
  const snapshotFresh =
    existing?.fetchedAt &&
    Date.now() - new Date(existing.fetchedAt).getTime() < 7 * 24 * 60 * 60 * 1000;

  const snapshot = snapshotFresh
    ? (raw.snapshot as unknown)
    : await getPropertySnapshot({
        postcode: lead.postcode,
        address: lead.address,
        propertyType: normalised,
        bedrooms,
      });

  // ── Strong AVM: market value + risk-adjusted offer + confidence. ───────
  // Founder-tuned offer policy (highest active avm_confidence EvalConfig).
  const activeConfig = await database.evalConfig.findFirst({
    where: { evalType: 'avm_confidence', activatedAt: { not: null } },
    orderBy: { version: 'desc' },
    select: { config: true },
  });
  const offerConfig = mergeOfferConfig(activeConfig?.config);

  let avmFull: Record<string, unknown> | null = null;
  try {
    const avm = await runAVM({
      postcode: lead.postcode,
      propertyType: avmPropertyType as never,
      address: lead.address,
      bedrooms,
      sellerType: avmSellerType as never,
      offerConfig,
    });
    const r = avm.resultJson;
    const point = r.avmPointEstimate;
    // Discount-to-market of OUR offer = how far below market we'd buy.
    const offerDiscountPct =
      point > 0 ? ((point - r.finalOffer) / point) * 100 : null;
    avmFull = {
      pointEstimatePence: Math.round(point * 100),
      lowPence: r.avmLow != null ? Math.round(r.avmLow * 100) : null,
      highPence: r.avmHigh != null ? Math.round(r.avmHigh * 100) : null,
      finalOfferPence: Math.round(r.finalOffer * 100),
      offerDiscountPct,
      confidenceLevel: r.confidenceLevel ?? null,
      comparableCount: r.comparableCount ?? null,
      requiresReview: Boolean(r.requiresCeoEscalation || r.discountCapped),
      riskScore: avm.riskScore,
      assumedPropertyType: normalised ? null : avmPropertyType, // flag a guess
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    // AVM failure must not block snapshot enrichment — leave avmFull null and
    // keep whatever was there before.
    avmFull = (raw.avmFull as Record<string, unknown> | undefined) ?? null;
  }

  const updatedRaw = {
    ...raw,
    snapshot,
    avmFull,
  };

  await database.scoutLead.update({
    where: { id: leadId },
    data: { rawPayload: updatedRaw as Prisma.InputJsonValue },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/leads');
  return { ok: true, fetched: !snapshotFresh };
}

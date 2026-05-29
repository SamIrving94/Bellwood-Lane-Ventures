'use server';

import { auth } from '@repo/auth/server';
import { database, Prisma } from '@repo/database';
import { getPropertySnapshot } from '@repo/property-data/src/propertydata';
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

/**
 * On-demand enrichment for a single lead. Fetches the full property
 * snapshot (AVM + sold comps + yields + facts) and merges it into the
 * lead's rawPayload. Idempotent and cacheable.
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
  // Skip if already enriched within last 7 days
  const existing = raw.snapshot as { fetchedAt?: string } | undefined;
  if (existing?.fetchedAt) {
    const ageMs = Date.now() - new Date(existing.fetchedAt).getTime();
    if (ageMs < 7 * 24 * 60 * 60 * 1000) {
      return { ok: true, fetched: false };
    }
  }

  const pd = raw.propertyData as Record<string, unknown> | undefined;
  const propertyType = normalisePropertyType(pd?.propertyType);
  const bedrooms =
    typeof pd?.bedrooms === 'number' ? (pd.bedrooms as number) : undefined;

  const snapshot = await getPropertySnapshot({
    postcode: lead.postcode,
    address: lead.address,
    propertyType,
    bedrooms,
  });

  const updatedRaw = {
    ...raw,
    snapshot,
  };

  await database.scoutLead.update({
    where: { id: leadId },
    data: { rawPayload: updatedRaw as Prisma.InputJsonValue },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/leads');
  return { ok: true, fetched: true };
}

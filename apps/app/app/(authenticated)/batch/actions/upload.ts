'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';
import { mapPropertyType } from '../../../../lib/batch/property-type';
import { parseSheet } from '../../../../lib/batch/parse-sheet';

export type UploadResult =
  | { ok: true; batchId: string; totalItems: number; unmappedHeaders: string[] }
  | { ok: false; error: string };

/**
 * Founder uploads a bi-weekly pipeline spreadsheet. We parse every row, create
 * a PropertyBatch + PropertyBatchItem records (status 'pending'), and diff
 * against the previous batch by dedupeKey so the review page can show what's
 * new vs carried over (and what fell out — computed on the review page from the
 * prior batch). The file itself is parsed in-memory and discarded; only the
 * structured rows are stored.
 */
export async function uploadBatch(formData: FormData): Promise<UploadResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Unauthorized' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Pick a spreadsheet (.xls or .xlsx) first.' };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: 'File must be under 10MB.' };
  }

  let parsed;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    parsed = parseSheet(buf);
  } catch (e) {
    return { ok: false, error: `Could not read the spreadsheet: ${(e as Error).message}` };
  }

  if (parsed.rows.length === 0) {
    return { ok: false, error: 'No property rows found. Is "Opportunity Name" the first column?' };
  }

  // Prior batch for week-over-week diffing.
  const priorBatch = await database.propertyBatch.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  const priorItems = priorBatch
    ? await database.propertyBatchItem.findMany({
        where: { batchId: priorBatch.id },
        select: { dedupeKey: true, acceptableTradeOfferPence: true },
      })
    : [];
  const priorByKey = new Map(
    priorItems.map((p) => [p.dedupeKey, p.acceptableTradeOfferPence]),
  );

  const label = file.name.replace(/\.(xlsx?|csv)$/i, '').trim() || 'Pipeline batch';

  const batch = await database.propertyBatch.create({
    data: {
      label,
      sourceFile: file.name,
      uploadedBy: userId,
      status: 'pending',
      totalItems: parsed.rows.length,
      processedItems: 0,
      priorBatchId: priorBatch?.id ?? null,
    },
    select: { id: true },
  });

  await database.propertyBatchItem.createMany({
    data: parsed.rows.map((row) => {
      const priorTradeOffer = priorByKey.get(row.dedupeKey);
      return {
        batchId: batch.id,
        rowIndex: row.rowIndex,
        opportunityName: row.opportunityName,
        address: row.address,
        postcode: row.postcode,
        dedupeKey: row.dedupeKey,
        propertyType: row.propertyType,
        mappedType: mapPropertyType(row.propertyType),
        occupancy: row.occupancy,
        condition: row.condition,
        bedrooms: row.bedrooms,
        bathrooms: row.bathrooms,
        acceptableTradeOfferPence: row.acceptableTradeOfferPence,
        signOffPricePence: row.signOffPricePence,
        status: 'pending',
        changeStatus: priorByKey.has(row.dedupeKey) ? 'carried' : 'new',
        priorTradeOfferPence: priorTradeOffer ?? null,
      };
    }),
  });

  revalidatePath('/batch');
  return {
    ok: true,
    batchId: batch.id,
    totalItems: parsed.rows.length,
    unmappedHeaders: parsed.unmappedHeaders,
  };
}

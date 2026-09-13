'use server';

import { getFounderSession } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';
import { parseSheet } from '../../../../lib/batch/parse-sheet';
import { mapPropertyType } from '../../../../lib/batch/property-type';

export type UploadResult =
  | {
      ok: true;
      batchId: string;
      totalItems: number;
      unmappedHeaders: string[];
      /** Cells we had to blank (e.g. out-of-range money) — see parseSheet. */
      warnings: string[];
    }
  | { ok: false; error: string };

/**
 * Founder uploads a bi-weekly pipeline spreadsheet. We parse every row, create
 * a PropertyBatch + PropertyBatchItem records (status 'pending'), and diff
 * against the previous batch by dedupeKey so the review page can show what's
 * new vs carried over (and what fell out — computed on the review page from the
 * prior batch). We also persist the raw uploaded bytes (originalFile/originalMime)
 * so the export can hand back the founder's exact spreadsheet plus our columns.
 */
export async function uploadBatch(formData: FormData): Promise<UploadResult> {
  const userId = (await getFounderSession())?.userId;
  if (!userId) return { ok: false, error: 'Unauthorized' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Pick a spreadsheet (.xls or .xlsx) first.' };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: 'File must be under 10MB.' };
  }

  let parsed;
  let buf: Buffer;
  try {
    buf = Buffer.from(await file.arrayBuffer());
    parsed = parseSheet(buf);
  } catch (e) {
    return {
      ok: false,
      error: `Could not read the spreadsheet: ${(e as Error).message}`,
    };
  }

  if (parsed.rows.length === 0) {
    return {
      ok: false,
      error: 'No property rows found. Is "Opportunity Name" the first column?',
    };
  }
  // Logged so a blanked cell is findable in Vercel logs even though the form
  // navigates straight to the review page (where the row shows as flagged).
  for (const w of parsed.warnings)
    console.warn(`[batch/upload] ${file.name}: ${w}`);

  // Everything below touches the database. It used to run unguarded, so any
  // failure here (a missing column after a schema change, a dropped Neon
  // connection, an over-sized row) escaped the action and surfaced to the
  // founder as the generic "something went wrong" page with nothing to act on
  // and nothing in the response to diagnose from.
  let batchId: string;
  try {
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
      priorItems.map((p) => [p.dedupeKey, p.acceptableTradeOfferPence])
    );

    const label =
      file.name.replace(/\.(xlsx?|csv)$/i, '').trim() || 'Pipeline batch';

    const batch = await database.propertyBatch.create({
      data: {
        label,
        sourceFile: file.name,
        uploadedBy: userId,
        status: 'pending',
        totalItems: parsed.rows.length,
        processedItems: 0,
        priorBatchId: priorBatch?.id ?? null,
        originalFile: buf,
        originalMime: file.type || '',
      },
      select: { id: true },
    });
    batchId = batch.id;

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
  } catch (e) {
    const message = (e as Error)?.message ?? String(e);
    console.error('[batch/upload] failed to save batch', e);
    return {
      ok: false,
      error: `Parsed ${parsed.rows.length} rows, but saving them failed: ${message.slice(0, 200)}`,
    };
  }

  revalidatePath('/batch');
  return {
    ok: true,
    batchId,
    totalItems: parsed.rows.length,
    unmappedHeaders: parsed.unmappedHeaders,
    warnings: parsed.warnings,
  };
}

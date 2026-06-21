import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

/**
 * Download the batch as an .xlsx — the original columns, in the original row
 * order, with two columns added on the right:
 *   - Estimated Market Value (Bellwood AVM)
 *   - % Discount vs Underwriting
 *
 * We rebuild the sheet from the stored parsed rows (the upload itself isn't
 * retained), preserving the canonical column set so the founder gets the same
 * spreadsheet back plus our two columns — nothing else changed.
 */

export const dynamic = 'force-dynamic';

const penceToPounds = (p?: number | null): number | string =>
  p == null ? '' : Math.round(p / 100);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const batch = await database.propertyBatch.findUnique({
    where: { id },
    select: { id: true, label: true },
  });
  if (!batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }

  const items = await database.propertyBatchItem.findMany({
    where: { batchId: id },
    orderBy: { rowIndex: 'asc' }, // original sheet order
  });

  const header = [
    'Opportunity Name',
    'Property Type',
    'Who lives in the property',
    'Condition',
    'Number of bedrooms',
    'Number of Bathrooms',
    'Underwriting Entry: Acceptable Trade Offer Level',
    // --- added columns ---
    'Estimated Market Value (Bellwood AVM)',
    '% Discount vs Underwriting',
  ];

  const rows = items.map((i) => [
    i.opportunityName,
    i.propertyType,
    i.occupancy ?? '',
    i.condition ?? '',
    i.bedrooms ?? '',
    i.bathrooms ?? '',
    penceToPounds(i.acceptableTradeOfferPence),
    penceToPounds(i.estimatedMarketValuePence),
    i.discountPercent ?? '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Appraised');
  const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const safeName = batch.label.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'batch';
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeName} - appraised.xlsx"`,
    },
  });
}

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

/**
 * Download the batch as an .xlsx — the founder's exact original spreadsheet
 * (all columns, sheets and data preserved), with two columns added on the right:
 *   - Estimated Market Value (Bellwood AVM)
 *   - % Discount vs Underwriting
 *
 * When we have the stored original upload (originalFile) we round-trip it through
 * SheetJS, appending the two columns to the first sheet's used range and leaving
 * everything else untouched. Older batches without a stored original fall back to
 * rebuilding the sheet from the parsed rows.
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
    select: { id: true, label: true, originalFile: true, originalMime: true },
  });
  if (!batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }

  const items = await database.propertyBatchItem.findMany({
    where: { batchId: id },
    orderBy: { rowIndex: 'asc' }, // original sheet order
  });

  const safeName = batch.label.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'batch';
  const downloadHeaders = {
    'Content-Type':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${safeName} - appraised.xlsx"`,
  };

  const EMV_HEADER = 'Estimated Market Value (Bellwood AVM)';
  const DISCOUNT_HEADER = '% Discount vs Underwriting';

  // Preferred path: round-trip the founder's exact original spreadsheet,
  // appending our two columns to the first sheet and leaving the rest intact.
  if (batch.originalFile) {
    const wb = XLSX.read(batch.originalFile, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');

    const headerRow = range.s.r;
    const emvCol = range.e.c + 1;
    const discountCol = range.e.c + 2;

    // Map sheet data rows to items by position (item.rowIndex is 0-based among
    // data rows; sheet row = headerRow + 1 + rowIndex).
    const itemByRowIndex = new Map(items.map((i) => [i.rowIndex, i]));

    // Header cells for the two new columns.
    ws[XLSX.utils.encode_cell({ r: headerRow, c: emvCol })] = {
      t: 's',
      v: EMV_HEADER,
    };
    ws[XLSX.utils.encode_cell({ r: headerRow, c: discountCol })] = {
      t: 's',
      v: DISCOUNT_HEADER,
    };

    for (let r = headerRow + 1; r <= range.e.r; r++) {
      const item = itemByRowIndex.get(r - headerRow - 1);
      const emv = penceToPounds(item?.estimatedMarketValuePence);
      const discount = item?.discountPercent ?? '';

      ws[XLSX.utils.encode_cell({ r, c: emvCol })] =
        emv === '' ? { t: 's', v: '' } : { t: 'n', v: emv };
      ws[XLSX.utils.encode_cell({ r, c: discountCol })] =
        discount === '' ? { t: 's', v: '' } : { t: 'n', v: discount };
    }

    // Grow the used range to include the two new columns.
    ws['!ref'] = XLSX.utils.encode_range({
      s: range.s,
      e: { r: range.e.r, c: discountCol },
    });

    const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(buf, { status: 200, headers: downloadHeaders });
  }

  // Fallback for older batches with no stored original file: rebuild the sheet
  // from the parsed rows.
  const header = [
    'Opportunity Name',
    'Property Type',
    'Who lives in the property',
    'Condition',
    'Number of bedrooms',
    'Number of Bathrooms',
    'Underwriting Entry: Acceptable Trade Offer Level',
    // --- added columns ---
    EMV_HEADER,
    DISCOUNT_HEADER,
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

  return new NextResponse(buf, { status: 200, headers: downloadHeaders });
}

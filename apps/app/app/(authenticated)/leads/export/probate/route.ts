import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';

/**
 * Probate lead CSV export.
 *
 * Streams the probate leads (Gazette deceased-estate notices matched to HM Land
 * Registry) as a spreadsheet the founder can work from for direct-to-vendor
 * letters. Columns:
 *   address, postcode, deceased name, notice date, executor/solicitor,
 *   last sale price, last sale date, match confidence.
 *
 * Sorted most-recent notice first. Optional `?area=SK4` filters by postcode
 * prefix (case-insensitive) — the CSV analogue of the pipeline's area scan.
 *
 * Auth: logged-in founder (Clerk) OR `Authorization: Bearer <CRON_SECRET>`.
 * GET /leads/export/probate?area=<postcode-prefix>&limit=<n>
 */
export const dynamic = 'force-dynamic';

async function isAuthorised(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader === `Bearer ${secret}`) return true;
  const { userId } = await auth();
  return Boolean(userId);
}

/** RFC-4180 CSV field escaping. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export async function GET(request: Request) {
  if (!(await isAuthorised(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const area = (url.searchParams.get('area') ?? '')
    .toUpperCase()
    .replace(/\s+/g, '');
  const limit = Math.min(
    5000,
    Math.max(1, Number(url.searchParams.get('limit') ?? 2000) || 2000),
  );

  const leads = await database.scoutLead.findMany({
    where: {
      leadType: 'probate',
      ...(area ? { postcode: { startsWith: area, mode: 'insensitive' } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { address: true, postcode: true, rawPayload: true },
  });

  type ProbateMatch = {
    lastSalePricePence?: number | null;
    lastSaleDate?: string | null;
    confidence?: string | null;
  };

  // Shape each lead into an export row, reading the probate fields + the HMLR
  // match out of rawPayload. `executorName` carries the deceased's name for
  // Gazette notices (see scouting/gazette.ts).
  const rows = leads.map((l) => {
    const raw = (l.rawPayload ?? {}) as Record<string, unknown>;
    const match = (raw.probateMatch ?? {}) as ProbateMatch;
    const noticeDate = str(raw.grantDate);
    const lastSale =
      typeof match.lastSalePricePence === 'number'
        ? Math.round(match.lastSalePricePence / 100)
        : null;
    return {
      address: l.address,
      postcode: l.postcode,
      deceasedName: str(raw.executorName) ?? '',
      noticeDate: noticeDate ?? '',
      executorSolicitor: str(raw.solicitorFirm) ?? '',
      lastSalePrice: lastSale ?? '',
      lastSaleDate: str(match.lastSaleDate) ?? '',
      matchConfidence: str(match.confidence) ?? 'none',
      _sortKey: noticeDate ?? '',
    };
  });

  // Most-recent notice first (grantDate is in rawPayload, so sort in memory).
  rows.sort((a, b) => b._sortKey.localeCompare(a._sortKey));

  const header = [
    'address',
    'postcode',
    'deceased_name',
    'notice_date',
    'executor_or_solicitor',
    'last_sale_price_gbp',
    'last_sale_date',
    'match_confidence',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.address,
        r.postcode,
        r.deceasedName,
        r.noticeDate,
        r.executorSolicitor,
        r.lastSalePrice,
        r.lastSaleDate,
        r.matchConfidence,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  const csv = lines.join('\r\n');
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `probate-leads${area ? `-${area}` : ''}-${stamp}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

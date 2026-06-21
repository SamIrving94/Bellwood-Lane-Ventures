/**
 * Parse a founder pipeline spreadsheet (.xls or .xlsx) into structured rows.
 *
 * Columns are matched by header *name* (case/space-insensitive, substring), not
 * position, so a re-ordered or slightly-renamed weekly export still parses. The
 * canonical sheet looks like:
 *
 *   Opportunity Name | Property Type | Who lives in the property |
 *   Condition | Number of bedrooms | Number of Bathrooms |
 *   Underwriting Entry: Acceptable Trade Offer Level
 *
 * "Opportunity Name" is a full address with a " - Purchase" suffix, e.g.
 *   "34A, NORTH GREEN, STAINDROP, DARLINGTON, DL2 3JP - Purchase"
 * We split off the trailing UK postcode for the AVM and keep the rest as the
 * display address. A "Sign off sale price" column is honoured if present even
 * though the sample sheet doesn't include one.
 */

import * as XLSX from 'xlsx';

export interface ParsedRow {
  rowIndex: number;
  opportunityName: string;
  address: string;
  postcode: string | null;
  dedupeKey: string;
  propertyType: string;
  occupancy: string | null;
  condition: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  acceptableTradeOfferPence: number | null;
  signOffPricePence: number | null;
}

export interface ParsedSheet {
  /** The original header row, verbatim, for faithful re-export. */
  headers: string[];
  rows: ParsedRow[];
  /** Headers we couldn't map to a known field — surfaced as a warning. */
  unmappedHeaders: string[];
}

// UK postcode, tolerant of missing space. Anchored to the *end* of the string
// (after stripping the " - Purchase" suffix) since the address trails into it.
const UK_POSTCODE =
  /([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\s*$/i;

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Find the first header whose normalised form contains every needle token. */
function findColumn(headers: string[], needles: string[]): number {
  const norm = headers.map(normaliseHeader);
  for (let i = 0; i < norm.length; i++) {
    if (needles.every((n) => norm[i]?.includes(n))) return i;
  }
  return -1;
}

/** Parse "£225,000" / "225000.0" / 225000 → integer pence; null if empty/0. */
export function parseMoneyToPence(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const num =
    typeof raw === 'number'
      ? raw
      : Number(String(raw).replace(/[£,\s]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

function parseIntCell(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const num = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
}

/** Split an "Opportunity Name" into a clean address + trailing postcode. */
export function extractAddress(opportunityName: string): {
  address: string;
  postcode: string | null;
} {
  // Drop a trailing " - Purchase" / " - Sale" style suffix.
  let cleaned = opportunityName.replace(/\s*[-–]\s*(purchase|sale|let)\s*$/i, '').trim();
  const match = cleaned.match(UK_POSTCODE);
  let postcode: string | null = null;
  if (match) {
    postcode = `${match[1]} ${match[2]}`.toUpperCase();
    // Remove the postcode (and any trailing comma/space) from the address tail.
    cleaned = cleaned.slice(0, match.index).replace(/[,\s]+$/, '').trim();
  }
  return { address: cleaned || opportunityName.trim(), postcode };
}

/** Stable key for week-over-week diffing: postcode + first address token. */
export function makeDedupeKey(address: string, postcode: string | null): string {
  const pc = (postcode ?? '').toUpperCase().replace(/\s+/g, '');
  const head = address
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 24);
  return `${pc}:${head}`;
}

export function parseSheet(buffer: ArrayBuffer | Buffer): ParsedSheet {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    return { headers: [], rows: [], unmappedHeaders: [] };
  }
  const sheet = wb.Sheets[firstSheetName];
  if (!sheet) {
    return { headers: [], rows: [], unmappedHeaders: [] };
  }

  // Array-of-arrays so we keep the raw header row verbatim.
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
  });
  if (matrix.length === 0) return { headers: [], rows: [], unmappedHeaders: [] };

  const headers = (matrix[0] as unknown[]).map((h) => String(h ?? '').trim());

  const col = {
    opportunity: findColumn(headers, ['opportunity']),
    type: findColumn(headers, ['property', 'type']),
    occupancy: findColumn(headers, ['who', 'lives']),
    condition: findColumn(headers, ['condition']),
    bedrooms: findColumn(headers, ['bedroom']),
    bathrooms: findColumn(headers, ['bathroom']),
    tradeOffer: findColumn(headers, ['acceptable', 'trade']),
    signOff: findColumn(headers, ['sign', 'off']),
  };

  const mappedIdx = new Set(Object.values(col).filter((i) => i >= 0));
  const unmappedHeaders = headers.filter((_, i) => !mappedIdx.has(i) && headers[i]);

  const rows: ParsedRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r] as unknown[];
    const cell = (i: number): unknown => (i >= 0 ? cells[i] : undefined);

    const opportunityName = String(cell(col.opportunity) ?? '').trim();
    if (!opportunityName) continue; // skip blank rows

    const { address, postcode } = extractAddress(opportunityName);

    rows.push({
      rowIndex: r - 1, // 0-based among data rows
      opportunityName,
      address,
      postcode,
      dedupeKey: makeDedupeKey(address, postcode),
      propertyType: String(cell(col.type) ?? '').trim(),
      occupancy: (String(cell(col.occupancy) ?? '').trim() || null),
      condition: (String(cell(col.condition) ?? '').trim() || null),
      bedrooms: parseIntCell(cell(col.bedrooms)),
      bathrooms: parseIntCell(cell(col.bathrooms)),
      acceptableTradeOfferPence: parseMoneyToPence(cell(col.tradeOffer)),
      signOffPricePence: parseMoneyToPence(cell(col.signOff)),
    });
  }

  return { headers, rows, unmappedHeaders };
}

/**
 * HM Land Registry Price Paid Data (PPD) client
 *
 * Fetches historical sold prices by postcode from the HMLR linked-data API.
 * No API key required. Falls back to synthetic data when the live call fails.
 *
 * Endpoint: https://landregistry.data.gov.uk/linked-data/transaction-history.json
 */

import { z } from 'zod';

// HMLR Price Paid linked-data endpoint. Returns paginated transaction
// records; we use _pageSize / _page rather than _limit.
const PPD_BASE =
  'https://landregistry.data.gov.uk/data/ppi/transaction-record.json';

const REQUEST_TIMEOUT_MS = 8_000;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/**
 * Where a single sale came from. This rides on EVERY transaction row, not
 * just the PricePaid wrapper, so a fabricated comp stays identifiable after
 * it is separated from its wrapper (spread into a comps array, formatted
 * into an LLM prompt, persisted). A future caller cannot forget to check the
 * wrapper's `source` because the marker is on the row itself.
 */
export const PPD_PROVENANCE = ['hmlr_ppd', 'synthetic'] as const;
export type PpdProvenance = (typeof PPD_PROVENANCE)[number];

const PpdTransactionSchema = z.object({
  price: z.number(),
  date: z.string(),
  propertyType: z.string(),
  newBuild: z.boolean(),
  tenure: z.string(),
  /**
   * 'hmlr_ppd' = a real Land Registry sale.
   * 'synthetic' = an invented placeholder. NEVER a comparable, never shown
   * to a vendor, never fed to a valuation model as evidence.
   */
  provenance: z.enum(PPD_PROVENANCE),
});

export const PricePaidSchema = z.object({
  postcode: z.string(),
  transactions: z.array(PpdTransactionSchema),
  avgPrice: z.number().nullable(),
  lastSalePrice: z.number().nullable(),
  lastSaleDate: z.string().nullable(),
  source: z.string(),
});

export type PricePaid = z.infer<typeof PricePaidSchema>;
export type PpdTransaction = z.infer<typeof PpdTransactionSchema>;

/**
 * A single Price Paid sale WITH its property address. The postcode-aggregate
 * `getPricePaid` discards the address; this richer record keeps it so a caller
 * (e.g. the probate → sale matcher) can pin a sale to a specific house.
 */
export interface PpdAddressRecord {
  /** Sale price in pounds (HMLR reports whole pounds). */
  price: number;
  /** Transaction date, ISO YYYY-MM-DD. */
  date: string;
  /** Reconstructed single-line address (PAON + street + town). */
  address: string;
  /** Postcode as returned by HMLR. */
  postcode: string | null;
  propertyType: string;
}

// ---------------------------------------------------------------------------
// Synthetic fallback
// ---------------------------------------------------------------------------

// Deterministic hash so the same postcode always yields the same fallback.
// A random fallback (the old behaviour) meant a property could value
// differently on every run — the source of "the AVM drifted" complaints.
// This output is still flagged source: 'synthetic' so callers treat it as
// low-confidence, but at least it is stable and reproducible.
function hashPostcode(postcode: string): number {
  let h = 0;
  const s = postcode.toUpperCase();
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function syntheticPricePaid(postcode: string): PricePaid {
  const hash = hashPostcode(postcode);
  const base = 200_000 + (hash % 300_000);
  const types = ['D', 'S', 'T', 'F'];
  const transactions: PpdTransaction[] = Array.from({ length: 5 }, (_, i) => ({
    // Deterministic spread around the base from the hash + index.
    price: Math.round(base * (0.85 + (((hash >> (i + 1)) % 31) / 100))),
    date: new Date(Date.now() - (i + 1) * 18 * 30 * 86_400_000)
      .toISOString()
      .slice(0, 10),
    propertyType: types[(hash + i) % 4] ?? 'S',
    newBuild: false,
    tenure: 'F',
    provenance: 'synthetic',
  }));

  const avgPrice = calcAvgPrice(transactions);
  const sorted = [...transactions].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  return {
    postcode,
    transactions,
    avgPrice,
    lastSalePrice: sorted[0]?.price ?? null,
    lastSaleDate: sorted[0]?.date ?? null,
    source: 'synthetic',
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise any parseable date string to ISO YYYY-MM-DD. HMLR's linked-data
 * `transactionDate` can arrive as an RFC string ("Fri, 15 Nov 2024"); this
 * keeps every stored/displayed comp date in a clean, sortable ISO form.
 */
export function toIsoDate(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) return '';
  const t = Date.parse(raw);
  return Number.isNaN(t) ? raw : new Date(t).toISOString().slice(0, 10);
}

export function calcAvgPrice(transactions: PpdTransaction[]): number | null {
  if (!transactions.length) return null;
  return Math.round(
    transactions.reduce((s, t) => s + t.price, 0) / transactions.length
  );
}

// ---------------------------------------------------------------------------
// Linked-data helpers
// ---------------------------------------------------------------------------

/**
 * HMLR's linked-data API returns enums as either:
 *   - a string (older endpoints)
 *   - { prefLabel: 'Leasehold' }
 *   - { prefLabel: [{ _value: 'Leasehold', _lang: 'en' }] }
 * This normaliser handles all three, returning a lower-case string.
 */
function extractLinkedDataValue(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string') return raw.toLowerCase();

  const obj = raw as Record<string, unknown>;
  const label = obj.prefLabel ?? obj.label;
  if (typeof label === 'string') return label.toLowerCase();
  if (Array.isArray(label)) {
    for (const entry of label) {
      if (entry && typeof entry === 'object') {
        const v = (entry as Record<string, unknown>)._value;
        if (typeof v === 'string') return v.toLowerCase();
      }
      if (typeof entry === 'string') return entry.toLowerCase();
    }
  }
  if (typeof obj._value === 'string') return (obj._value as string).toLowerCase();
  return null;
}

// ---------------------------------------------------------------------------
// Live fetch
// ---------------------------------------------------------------------------

async function fetchPricePaidLive(
  postcode: string,
  limit = 10
): Promise<PricePaid> {
  const url = new URL(PPD_BASE);
  url.searchParams.set(
    'propertyAddress.postcode',
    postcode.toUpperCase().trim()
  );
  url.searchParams.set('_pageSize', String(limit));
  url.searchParams.set('_sort', '-transactionDate');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let data: unknown;
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HMLR PPD API ${res.status}`);
    }
    data = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const raw = data as Record<string, unknown>;
  const items = (
    (raw.result as Record<string, unknown> | undefined)?.items ??
    raw.items ??
    []
  ) as Record<string, unknown>[];

  const transactions: PpdTransaction[] = items.map((t) => ({
    price: (t.pricePaid as number | undefined) ?? (t.price as number) ?? 0,
    date: toIsoDate(t.transactionDate ?? t.date),
    propertyType: extractLinkedDataValue(t.propertyType) ?? 'unknown',
    newBuild: t.newBuild === 'Y' || t.newBuild === true,
    tenure:
      extractLinkedDataValue(t.estateType) ??
      extractLinkedDataValue(t.tenure) ??
      'unknown',
    provenance: 'hmlr_ppd',
  }));

  const avgPrice = calcAvgPrice(transactions);
  const sorted = [...transactions].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  return {
    postcode,
    transactions,
    avgPrice,
    lastSalePrice: sorted[0]?.price ?? null,
    lastSaleDate: sorted[0]?.date ?? null,
    source: 'hmlr_ppd',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * True when this record is fabricated placeholder data rather than HMLR data.
 *
 * Checks BOTH the wrapper's `source` and the per-row provenance, so a record
 * assembled from mixed rows is still caught.
 */
export function isSyntheticPricePaid(
  pricePaid: Pick<PricePaid, 'source' | 'transactions'> | null | undefined
): boolean {
  if (!pricePaid) return false;
  if (pricePaid.source === 'synthetic') return true;
  // Defensive: partial records reach this from test stubs and cached payloads
  // written before `provenance` existed.
  if (!Array.isArray(pricePaid.transactions)) return false;
  return pricePaid.transactions.some((t) => t?.provenance === 'synthetic');
}

/**
 * Drop every fabricated row, keeping only real Land Registry sales.
 *
 * Use this at the point where transactions become comparables, a prompt, or
 * anything a human reads as evidence.
 */
export function realTransactions(
  transactions: PpdTransaction[]
): PpdTransaction[] {
  return transactions.filter((t) => t.provenance === 'hmlr_ppd');
}

/**
 * Fetch historical sold prices for a postcode from HMLR Price Paid Data.
 *
 * Falls back to synthetic data if the live call fails. The fallback is
 * flagged BOTH on the wrapper (`source: 'synthetic'`) and on every
 * transaction row (`provenance: 'synthetic'`). Callers that present these
 * rows as evidence MUST filter with {@link realTransactions} or reject the
 * whole record with {@link isSyntheticPricePaid}.
 */
export async function getPricePaid(
  postcode: string,
  limit = 10
): Promise<PricePaid> {
  try {
    return await fetchPricePaidLive(postcode, limit);
  } catch (err) {
    console.warn(
      `[property-data/hmlr-ppd] live fetch failed (${(err as Error).message}), using synthetic`
    );
    return syntheticPricePaid(postcode);
  }
}

// ---------------------------------------------------------------------------
// Address-level records (for per-property matching)
// ---------------------------------------------------------------------------

/** Build a single-line address from the HMLR linked-data propertyAddress. */
function buildAddress(propertyAddress: unknown): {
  address: string;
  postcode: string | null;
} {
  const a = (propertyAddress ?? {}) as Record<string, unknown>;
  const str = (k: string): string | null =>
    typeof a[k] === 'string' && (a[k] as string).trim()
      ? (a[k] as string).trim()
      : null;
  // PAON = house number/name, SAON = flat/sub-unit.
  const parts = [str('saon'), str('paon'), str('street'), str('locality'), str('town')]
    .filter(Boolean)
    .join(', ');
  return { address: parts, postcode: str('postcode') };
}

/**
 * Fetch Price Paid sales for a postcode WITH addresses, REAL DATA ONLY.
 *
 * Unlike getPricePaid, this never falls back to synthetic — a per-address match
 * against fabricated sales would be meaningless. Returns an empty array on any
 * failure so the caller shows "no match" rather than a made-up sale.
 */
export async function getPricePaidWithAddresses(
  postcode: string,
  limit = 100
): Promise<PpdAddressRecord[]> {
  const url = new URL(PPD_BASE);
  url.searchParams.set('propertyAddress.postcode', postcode.toUpperCase().trim());
  url.searchParams.set('_pageSize', String(limit));
  url.searchParams.set('_sort', '-transactionDate');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HMLR PPD API ${res.status}`);
    const raw = (await res.json()) as Record<string, unknown>;
    const items = ((raw.result as Record<string, unknown> | undefined)?.items ??
      raw.items ??
      []) as Record<string, unknown>[];

    return items.map((t) => {
      const { address, postcode: pc } = buildAddress(t.propertyAddress);
      return {
        price: (t.pricePaid as number | undefined) ?? (t.price as number) ?? 0,
        date: toIsoDate(t.transactionDate ?? t.date),
        address,
        postcode: pc,
        propertyType: extractLinkedDataValue(t.propertyType) ?? 'unknown',
      };
    });
  } catch (err) {
    console.warn(
      `[property-data/hmlr-ppd] address fetch failed for ${postcode} (${(err as Error).message}) — returning [] (no synthetic)`
    );
    return [];
  } finally {
    clearTimeout(timer);
  }
}

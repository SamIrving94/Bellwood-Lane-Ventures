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

const PpdTransactionSchema = z.object({
  price: z.number(),
  date: z.string(),
  propertyType: z.string(),
  newBuild: z.boolean(),
  tenure: z.string(),
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

// ---------------------------------------------------------------------------
// Synthetic fallback
// ---------------------------------------------------------------------------

function syntheticPricePaid(postcode: string): PricePaid {
  const base = 200_000 + Math.floor(Math.random() * 300_000);
  const transactions: PpdTransaction[] = Array.from({ length: 5 }, (_, i) => ({
    price: Math.round(base * (0.85 + Math.random() * 0.3)),
    date: new Date(Date.now() - (i + 1) * 18 * 30 * 86_400_000)
      .toISOString()
      .slice(0, 10),
    propertyType: ['D', 'S', 'T', 'F'][Math.floor(Math.random() * 4)] ?? 'S',
    newBuild: false,
    tenure: 'F',
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
    date:
      (t.transactionDate as string | undefined) ??
      (t.date as string | undefined) ??
      '',
    propertyType: extractLinkedDataValue(t.propertyType) ?? 'unknown',
    newBuild: t.newBuild === 'Y' || t.newBuild === true,
    tenure:
      extractLinkedDataValue(t.estateType) ??
      extractLinkedDataValue(t.tenure) ??
      'unknown',
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
 * Fetch historical sold prices for a postcode from HMLR Price Paid Data.
 * Falls back to synthetic data if the live call fails.
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

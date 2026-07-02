import { z } from 'zod';
import { fetchPropertyData } from '../client';

// ---------------------------------------------------------------------------
// Endpoint: /demographics — local age + household composition
// Used for pre-probate signal: postcodes with high >65 population are
// where probate grants will land in the coming years.
// ---------------------------------------------------------------------------

const DemographicsSchema = z.object({
  status: z.string().optional(),
  // Permissive — different plans return different keys
  data: z.record(z.string(), z.unknown()).optional(),
  result: z.record(z.string(), z.unknown()).optional(),
  age_bands: z.record(z.string(), z.unknown()).optional(),
});

export type DemographicsReading = {
  /** Estimated % of population aged 65+. Null when unavailable. */
  percentOver65: number | null;
  /** Estimated % aged 75+. Null when unavailable. */
  percentOver75: number | null;
  raw: Record<string, unknown> | null;
};

/**
 * Demographics for a postcode area. ~2 credits, 90-day cache (census
 * data updates rarely).
 *
 * We're permissive about response shape since PropertyData has been
 * known to vary the keys by plan. We walk the response looking for
 * any "age" / "65" / "75" markers.
 */
export async function getDemographics(
  postcode: string,
): Promise<DemographicsReading | null> {
  const data = await fetchPropertyData(
    '/demographics',
    { postcode: postcode.replace(/\s/g, '') },
    {
      ttlMs: 90 * 24 * 60 * 60 * 1000,
      estimatedCredits: 2,
      schema: DemographicsSchema,
    },
  );
  if (!data) return null;
  const raw = (data as Record<string, unknown>) ?? null;

  // Walk the tree looking for numeric percentages under age-65/75 keys.
  // We store in single-element arrays so closure-mutation doesn't confuse
  // TypeScript's narrowing (it would otherwise infer `never` after assignment).
  const over65: number[] = [];
  const over75: number[] = [];
  const walk = (v: unknown, path: string): void => {
    if (v === null || v === undefined) return;
    if (typeof v === 'number') {
      const k = path.toLowerCase();
      if (
        over65.length === 0 &&
        /(65|over_?65|ages?_65|65\+|sixty_?five)/.test(k)
      ) {
        over65.push(v);
      }
      if (
        over75.length === 0 &&
        /(75|over_?75|ages?_75|75\+|seventy_?five)/.test(k)
      ) {
        over75.push(v);
      }
      return;
    }
    if (typeof v === 'object') {
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        walk(child, `${path}.${k}`);
      }
    }
  };
  walk(raw, '');

  // Heuristic: many endpoints return age share as fractions (0-1). Normalise
  // to percentages.
  const normalise = (v: number): number => (v <= 1 ? v * 100 : v);
  const percentOver65 =
    over65.length > 0 ? normalise(over65[0]!) : null;
  const percentOver75 =
    over75.length > 0 ? normalise(over75[0]!) : null;

  return { percentOver65, percentOver75, raw };
}

// ---------------------------------------------------------------------------
// Endpoint: /sold-prices — recent comparable sales
// ---------------------------------------------------------------------------

const SoldPricesSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      average_price: z.number().optional(),
      median_price: z.number().optional(),
      transactions: z
        .array(
          z
            .object({
              address: z.string().optional(),
              postcode: z.string().optional(),
              price: z.number().optional(),
              date: z.string().optional(),
              property_type: z.string().optional(),
              new_build: z.boolean().optional(),
              tenure: z.string().optional(),
            })
            .partial(),
        )
        .optional(),
    })
    .partial()
    .optional(),
});

export type SoldTransaction = {
  address: string;
  postcode: string | null;
  pricePence: number;
  date: string;
  propertyType: string | null;
  tenure: string | null;
};

export type SoldPrices = {
  averagePricePence: number | null;
  medianPricePence: number | null;
  transactions: SoldTransaction[];
};

export type SoldPricesOptions = {
  /** Sale-age window in months. PropertyData allows 3-84; default 18. */
  maxAgeMonths?: number;
  /** Restrict to a single AVM property type. */
  type?: 'detached' | 'semi-detached' | 'terraced' | 'flat';
  /** Restrict to a bedroom count (0-5). */
  bedrooms?: number;
  /** How many comparable data points to pull (15-100). Higher = wider net. */
  points?: number;
};

export async function getSoldPrices(
  postcode: string,
  opts: SoldPricesOptions = {},
): Promise<SoldPrices | null> {
  // Clamp to PropertyData's documented ranges so a bad caller value can't 4xx.
  const maxAge =
    opts.maxAgeMonths != null
      ? Math.min(84, Math.max(3, Math.round(opts.maxAgeMonths)))
      : undefined;
  const points =
    opts.points != null
      ? Math.min(100, Math.max(15, Math.round(opts.points)))
      : undefined;
  const bedrooms =
    opts.bedrooms != null
      ? Math.min(5, Math.max(0, Math.round(opts.bedrooms)))
      : undefined;

  const data = await fetchPropertyData(
    '/sold-prices',
    {
      postcode: postcode.replace(/\s/g, ''),
      max_age: maxAge,
      type: opts.type,
      bedrooms,
      points,
    },
    {
      ttlMs: 7 * 24 * 60 * 60 * 1000,
      estimatedCredits: 2,
      schema: SoldPricesSchema,
    },
  );
  const r = (data as { result?: Record<string, unknown> } | null)?.result;
  if (!r) return null;
  const transactions: SoldTransaction[] = [];
  for (const raw of (r.transactions as unknown[] | undefined) ?? []) {
    const t = raw as Record<string, unknown>;
    const address = typeof t.address === 'string' ? t.address : null;
    const price = typeof t.price === 'number' ? t.price : null;
    const date = typeof t.date === 'string' ? t.date : null;
    if (!address || !price || !date) continue;
    transactions.push({
      address,
      postcode: typeof t.postcode === 'string' ? t.postcode : null,
      pricePence: Math.round(price * 100),
      date,
      propertyType:
        typeof t.property_type === 'string' ? t.property_type : null,
      tenure: typeof t.tenure === 'string' ? t.tenure : null,
    });
  }
  return {
    averagePricePence:
      typeof r.average_price === 'number'
        ? Math.round(r.average_price * 100)
        : null,
    medianPricePence:
      typeof r.median_price === 'number'
        ? Math.round(r.median_price * 100)
        : null,
    transactions,
  };
}

// ---------------------------------------------------------------------------
// Endpoint: /yields — rental yield for area
// ---------------------------------------------------------------------------

const YieldsSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      yield_average: z.number().optional(),
      gross_yield: z.number().optional(),
      yield_low: z.number().optional(),
      yield_high: z.number().optional(),
    })
    .partial()
    .optional(),
});

export type YieldsReading = {
  averageYieldPct: number | null;
  lowYieldPct: number | null;
  highYieldPct: number | null;
};

export async function getYields(
  postcode: string,
): Promise<YieldsReading | null> {
  const data = await fetchPropertyData(
    '/yields',
    { postcode: postcode.replace(/\s/g, '') },
    {
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      estimatedCredits: 2,
      schema: YieldsSchema,
    },
  );
  const r = (data as { result?: Record<string, unknown> } | null)?.result;
  if (!r) return null;
  const avg =
    typeof r.yield_average === 'number'
      ? r.yield_average
      : typeof r.gross_yield === 'number'
        ? r.gross_yield
        : null;
  return {
    averageYieldPct: avg,
    lowYieldPct:
      typeof r.yield_low === 'number' ? r.yield_low : null,
    highYieldPct:
      typeof r.yield_high === 'number' ? r.yield_high : null,
  };
}

// ---------------------------------------------------------------------------
// Endpoint: /prices-per-sqf — local £/sqft benchmarks
// ---------------------------------------------------------------------------

const PricesPerSqfSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      average: z.number().optional(),
      median: z.number().optional(),
      low: z.number().optional(),
      high: z.number().optional(),
    })
    .partial()
    .optional(),
});

export type PricesPerSqf = {
  averagePerSqft: number | null;
  medianPerSqft: number | null;
};

export async function getPricesPerSqf(
  postcode: string,
): Promise<PricesPerSqf | null> {
  const data = await fetchPropertyData(
    '/prices-per-sqf',
    { postcode: postcode.replace(/\s/g, '') },
    {
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      estimatedCredits: 2,
      schema: PricesPerSqfSchema,
    },
  );
  const r = (data as { result?: Record<string, unknown> } | null)?.result;
  if (!r) return null;
  return {
    averagePerSqft:
      typeof r.average === 'number' ? r.average : null,
    medianPerSqft: typeof r.median === 'number' ? r.median : null,
  };
}

// ---------------------------------------------------------------------------
// Endpoint: /council-tax — average council tax bills
// ---------------------------------------------------------------------------

const CouncilTaxSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      band: z.string().optional(),
      bands: z.record(z.string(), z.unknown()).optional(),
      average_annual_bill: z.number().optional(),
    })
    .partial()
    .optional(),
});

export type CouncilTaxReading = {
  averageAnnualBill: number | null;
  band: string | null;
  /** Map of band letter → annual £ */
  bandsByLetter: Record<string, number>;
};

export async function getCouncilTax(
  postcode: string,
): Promise<CouncilTaxReading | null> {
  const data = await fetchPropertyData(
    '/council-tax',
    { postcode: postcode.replace(/\s/g, '') },
    {
      ttlMs: 90 * 24 * 60 * 60 * 1000,
      estimatedCredits: 2,
      schema: CouncilTaxSchema,
    },
  );
  const r = (data as { result?: Record<string, unknown> } | null)?.result;
  if (!r) return null;
  const bands: Record<string, number> = {};
  const bandsRaw = r.bands as Record<string, unknown> | undefined;
  if (bandsRaw) {
    for (const [letter, val] of Object.entries(bandsRaw)) {
      if (typeof val === 'number') bands[letter.toUpperCase()] = val;
      else if (val && typeof val === 'object') {
        const v = val as Record<string, unknown>;
        const amount =
          (typeof v.amount === 'number' && v.amount) ||
          (typeof v.annual === 'number' && v.annual) ||
          (typeof v.value === 'number' && v.value);
        if (typeof amount === 'number')
          bands[letter.toUpperCase()] = amount;
      }
    }
  }
  return {
    averageAnnualBill:
      typeof r.average_annual_bill === 'number'
        ? r.average_annual_bill
        : null,
    band: typeof r.band === 'string' ? r.band : null,
    bandsByLetter: bands,
  };
}


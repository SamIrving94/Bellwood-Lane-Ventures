import { getMarketDemand } from './market';
import { getGrowth } from './listings';
import {
  getEpcByPostcode,
  getTenureByPostcode,
  type EpcReading,
  type TenureReading,
} from './epc-tenure';

// ---------------------------------------------------------------------------
// Preflight checks — combine EPC + tenure + market temperature
// Used by the quote API path for every new submission. Cached endpoints so
// repeat hits on the same postcode are cheap. ~7 credits net per first-time
// postcode, 0 thereafter for the cache window.
// ---------------------------------------------------------------------------

export type PreflightChecks = {
  postcode: string;
  address?: string;
  epc: {
    rating: string | null;
    isLowEpc: boolean; // E/F/G — meaningful renovation discount
    matchedAddress: string | null;
  };
  tenure: {
    tenure: 'freehold' | 'leasehold' | 'unknown';
    remainingLeaseYears: number | null;
    isShortLease: boolean; // <80 years — surveyor-level concern
    matchedAddress: string | null;
  };
  marketTemperature: {
    demandScore: number | null; // 0-100 from /demand
    daysOnMarketAvg: number | null;
    annualGrowthPct: number | null;
    forecastGrowthPct: number | null;
    /** Single-number heat index combining demand + growth, range -1..+1 */
    temperatureIndex: number | null;
    /** 'hot' | 'warm' | 'neutral' | 'cool' | 'cold' */
    band: 'hot' | 'warm' | 'neutral' | 'cool' | 'cold' | null;
  };
  /** Lines suitable to append to a reasoning array */
  reasoning: string[];
  /** Suggested offer multiplier adjustment (-0.05 to +0.03) on AVM% */
  offerAdjustment: number;
};

function fuzzyMatchAddress<T extends { address: string }>(
  rows: T[],
  needle?: string,
): T | null {
  if (!needle || rows.length === 0) return null;
  const n = needle.toLowerCase().replace(/[^a-z0-9]/g, '');
  let best: { row: T; score: number } | null = null;
  for (const row of rows) {
    const h = row.address.toLowerCase().replace(/[^a-z0-9]/g, '');
    let score = 0;
    if (h === n) score = 100;
    else if (h.startsWith(n) || n.startsWith(h)) score = 80;
    else if (h.includes(n) || n.includes(h)) score = 60;
    else continue;
    if (!best || score > best.score) best = { row, score };
  }
  return best?.row ?? null;
}

function temperatureBand(
  index: number | null,
): PreflightChecks['marketTemperature']['band'] {
  if (index === null) return null;
  if (index >= 0.5) return 'hot';
  if (index >= 0.2) return 'warm';
  if (index >= -0.2) return 'neutral';
  if (index >= -0.5) return 'cool';
  return 'cold';
}

export async function runPreflightChecks(input: {
  postcode: string;
  address?: string;
}): Promise<PreflightChecks> {
  const { postcode, address } = input;
  const [epcs, tenures, demand, growth] = await Promise.all([
    getEpcByPostcode(postcode).catch(() => [] as EpcReading[]),
    getTenureByPostcode(postcode).catch(() => [] as TenureReading[]),
    getMarketDemand(postcode).catch(() => null),
    getGrowth(postcode).catch(() => null),
  ]);

  const matchedEpc = fuzzyMatchAddress(epcs, address);
  const matchedTenure = fuzzyMatchAddress(tenures, address);

  const epcRating = matchedEpc?.rating ?? null;
  const isLowEpc =
    !!epcRating && ['E', 'F', 'G'].includes(epcRating.toUpperCase());

  const tenure = matchedTenure?.tenure ?? 'unknown';
  const remainingLeaseYears = matchedTenure?.remainingLeaseYears ?? null;
  const isShortLease =
    tenure === 'leasehold' &&
    typeof remainingLeaseYears === 'number' &&
    remainingLeaseYears < 80;

  const demandResult = (demand as { result?: Record<string, unknown> } | null)
    ?.result;
  const demandScore =
    typeof demandResult?.sales_demand_score === 'number'
      ? demandResult.sales_demand_score
      : null;
  const daysOnMarketAvg =
    typeof demandResult?.days_on_market_average === 'number'
      ? demandResult.days_on_market_average
      : null;

  const annualGrowthPct = growth?.annualGrowthPct ?? null;
  const forecastGrowthPct = growth?.forecastGrowthPct ?? null;

  // Combined temperature index. Weights chosen so that:
  //   strong demand (score 80+) + positive forecast → +0.5+ (hot)
  //   neutral both → 0
  //   weak demand + falling forecast → -0.5+ (cold)
  let temperatureIndex: number | null = null;
  const components: number[] = [];
  if (typeof demandScore === 'number') {
    // demandScore is 0-100; normalise to -1..+1 around midpoint 50
    components.push((demandScore - 50) / 50);
  }
  if (typeof forecastGrowthPct === 'number') {
    // forecastGrowthPct typical range -10..+10 — normalise
    components.push(Math.max(-1, Math.min(1, forecastGrowthPct / 10)));
  } else if (typeof annualGrowthPct === 'number') {
    components.push(Math.max(-1, Math.min(1, annualGrowthPct / 10)));
  }
  if (components.length > 0) {
    temperatureIndex =
      Math.round(
        (components.reduce((s, x) => s + x, 0) / components.length) * 100,
      ) / 100;
  }

  const band = temperatureBand(temperatureIndex);

  // Offer adjustment:
  //   Hot market →  +0.02 (we can pay closer to AVM and still win)
  //   Warm       →  +0.01
  //   Neutral    →   0
  //   Cool       →  -0.02
  //   Cold       →  -0.04
  const tempAdj =
    band === 'hot' ? 0.02
    : band === 'warm' ? 0.01
    : band === 'cool' ? -0.02
    : band === 'cold' ? -0.04
    : 0;

  // Low EPC: -0.01 (Appraiser already discounts in AVM but we surface it
  // again at the offer% layer for transparency).
  const epcAdj = isLowEpc ? -0.01 : 0;

  // Short lease: surface only — actual discount handled by lease curve in
  // the offer-calc layer. We don't double-count.
  const offerAdjustment = Math.round((tempAdj + epcAdj) * 1000) / 1000;

  const reasoning: string[] = [];
  if (matchedEpc) {
    reasoning.push(
      `EPC ${epcRating ?? '?'} from register (${matchedEpc.address})${isLowEpc ? ' — meaningful renovation cost expected' : ''}`,
    );
  } else {
    reasoning.push('EPC: no certificate matched on this address');
  }
  if (matchedTenure) {
    if (tenure === 'leasehold') {
      reasoning.push(
        `Tenure: leasehold${remainingLeaseYears ? `, ${remainingLeaseYears} years remaining` : ''}${isShortLease ? ' — SHORT LEASE FLAG' : ''}`,
      );
    } else if (tenure === 'freehold') {
      reasoning.push('Tenure: freehold');
    }
  }
  if (band) {
    reasoning.push(
      `Market: ${band}${typeof demandScore === 'number' ? ` (demand ${demandScore}/100)` : ''}${typeof forecastGrowthPct === 'number' ? `, forecast ${forecastGrowthPct > 0 ? '+' : ''}${forecastGrowthPct.toFixed(1)}%` : ''} — offer adjusted ${tempAdj > 0 ? '+' : ''}${(tempAdj * 100).toFixed(1)}%`,
    );
  }

  return {
    postcode,
    address,
    epc: {
      rating: epcRating,
      isLowEpc,
      matchedAddress: matchedEpc?.address ?? null,
    },
    tenure: {
      tenure,
      remainingLeaseYears,
      isShortLease,
      matchedAddress: matchedTenure?.address ?? null,
    },
    marketTemperature: {
      demandScore,
      daysOnMarketAvg,
      annualGrowthPct,
      forecastGrowthPct,
      temperatureIndex,
      band,
    },
    reasoning,
    offerAdjustment,
  };
}


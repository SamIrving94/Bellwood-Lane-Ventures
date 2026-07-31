/**
 * Extra PropertyData signals for batch-appraised properties.
 *
 * After the AVM succeeds for a batch item we enrich it with a few cheap,
 * postcode-level PropertyData signals — flood risk, area sales demand and
 * gross rental yield. These are advisory only: they MUST NEVER cause an item
 * to fail appraisal, so every fetch is wrapped and any rejection/null is
 * treated as "no signal". The underlying wrappers are cached internally, so
 * calling them per item is cheap.
 */

import 'server-only';

import { getFloodRisk, getMarketDemand, getYields } from '@repo/property-data';

export type BatchSignals = {
  /** Short human flood-risk string (e.g. "Rivers/sea: High"), else null. */
  floodRisk: string | null;
  /** Short human demand string (e.g. "Demand 72/100"), else null. */
  demandRating: string | null;
  /** Average gross rental yield %, else null. */
  grossYieldPct: number | null;
  /** Raw-ish values we derived from, kept for future use. */
  signalsJson: {
    flood: { riversAndSea: string | null; surfaceWater: string | null } | null;
    demand: { score: number | null; daysOnMarketAvg: number | null } | null;
    yields: {
      averageYieldPct: number | null;
      lowYieldPct: number | null;
      highYieldPct: number | null;
    } | null;
  };
};

const EMPTY_SIGNALS: BatchSignals = {
  floodRisk: null,
  demandRating: null,
  grossYieldPct: null,
  signalsJson: { flood: null, demand: null, yields: null },
};

/**
 * Fetch the three signals concurrently with Promise.allSettled so a single
 * failing endpoint never breaks the others — and the whole thing is wrapped
 * so a thrown error degrades to empty signals.
 */
export async function fetchBatchSignals(postcode: string): Promise<BatchSignals> {
  try {
    const [floodRes, demandRes, yieldsRes] = await Promise.allSettled([
      getFloodRisk(postcode),
      getMarketDemand(postcode),
      getYields(postcode),
    ]);

    // ── Flood ────────────────────────────────────────────────────────────
    const flood =
      floodRes.status === 'fulfilled' ? floodRes.value?.result ?? null : null;
    const riversAndSea =
      typeof flood?.rivers_and_sea === 'string' ? flood.rivers_and_sea : null;
    const surfaceWater =
      typeof flood?.surface_water === 'string' ? flood.surface_water : null;
    // Prefer the rivers/sea reading; fall back to surface water.
    const floodReading = riversAndSea ?? surfaceWater;
    const floodRisk = floodReading
      ? `${riversAndSea ? 'Rivers/sea' : 'Surface water'}: ${floodReading}`
      : null;

    // ── Demand ───────────────────────────────────────────────────────────
    const demand =
      demandRes.status === 'fulfilled' ? demandRes.value?.result ?? null : null;
    const demandScore =
      typeof demand?.sales_demand_score === 'number'
        ? demand.sales_demand_score
        : null;
    const daysOnMarketAvg =
      typeof demand?.days_on_market_average === 'number'
        ? demand.days_on_market_average
        : null;
    const demandRating =
      demandScore !== null ? `Demand ${demandScore}/100` : null;

    // ── Yields ───────────────────────────────────────────────────────────
    const yields =
      yieldsRes.status === 'fulfilled' ? yieldsRes.value ?? null : null;
    const grossYieldPct =
      typeof yields?.averageYieldPct === 'number'
        ? yields.averageYieldPct
        : null;

    return {
      floodRisk,
      demandRating,
      grossYieldPct,
      signalsJson: {
        flood: floodReading
          ? { riversAndSea, surfaceWater }
          : null,
        demand:
          demandScore !== null || daysOnMarketAvg !== null
            ? { score: demandScore, daysOnMarketAvg }
            : null,
        yields: grossYieldPct !== null
          ? {
              averageYieldPct: grossYieldPct,
              lowYieldPct: yields?.lowYieldPct ?? null,
              highYieldPct: yields?.highYieldPct ?? null,
            }
          : null,
      },
    };
  } catch (error) {
    console.warn('[batch signals] fetch failed', error);
    return EMPTY_SIGNALS;
  }
}

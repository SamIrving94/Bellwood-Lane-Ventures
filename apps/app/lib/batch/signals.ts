/**
 * Extra PropertyData signals for batch-appraised properties.
 *
 * After the AVM succeeds for a batch item we enrich it with a few cheap,
 * postcode-level PropertyData signals — flood risk, area sales demand and
 * gross rental yield. These are advisory only: they MUST NEVER cause an item
 * to fail appraisal, so every fetch is wrapped and any rejection/null is
 * treated as "no signal". The underlying wrappers are cached internally, so
 * calling them per item is cheap.
 *
 * Reads the TYPED readings from @repo/property-data, never the raw response —
 * the raw shape is the package's business (see the Sep 2026 schema fix: this
 * file used to reach into `.result`, which the API never sent).
 */

import 'server-only';

import { getFloodRisk, getMarketDemand, getYields } from '@repo/property-data';

export type BatchSignals = {
  /** PropertyData's flood band for the postcode (e.g. "Very Low"), else null. */
  floodRisk: string | null;
  /** PropertyData's demand rating (e.g. "Balanced market"), else null. */
  demandRating: string | null;
  /** Long-let gross rental yield %, else null. */
  grossYieldPct: number | null;
  /** The readings we derived from, kept for future use. */
  signalsJson: {
    flood: { floodRisk: string } | null;
    demand: {
      rating: string | null;
      daysOnMarket: number | null;
      totalForSale: number | null;
      monthsOfInventory: number | null;
    } | null;
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
export async function fetchBatchSignals(
  postcode: string
): Promise<BatchSignals> {
  try {
    const [floodRes, demandRes, yieldsRes] = await Promise.allSettled([
      getFloodRisk(postcode),
      getMarketDemand(postcode),
      getYields(postcode),
    ]);

    const flood = floodRes.status === 'fulfilled' ? floodRes.value : null;
    const demand = demandRes.status === 'fulfilled' ? demandRes.value : null;
    const yields = yieldsRes.status === 'fulfilled' ? yieldsRes.value : null;

    const floodRisk = flood?.floodRisk ?? null;
    const demandRating = demand?.demandRating ?? null;
    const grossYieldPct =
      typeof yields?.averageYieldPct === 'number'
        ? yields.averageYieldPct
        : null;

    return {
      floodRisk,
      demandRating,
      grossYieldPct,
      signalsJson: {
        flood: floodRisk ? { floodRisk } : null,
        demand: demand
          ? {
              rating: demand.demandRating,
              daysOnMarket: demand.daysOnMarket,
              totalForSale: demand.totalForSale,
              monthsOfInventory: demand.monthsOfInventory,
            }
          : null,
        yields:
          grossYieldPct !== null
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

import { getPropertyDataValuation } from './valuation';
import {
  getAgentsByPostcode,
  getFloodRisk,
  getMarketDemand,
} from './market';
import { getGrowth, type GrowthReading } from './listings';
import { getEpcByPostcode, getTenureByPostcode } from './epc-tenure';
import {
  getCouncilTax,
  getPricesPerSqf,
  getSoldPrices,
  getYields,
  type CouncilTaxReading,
  type PricesPerSqf,
  type SoldPrices,
  type YieldsReading,
} from './market-stats';

// ---------------------------------------------------------------------------
// getPropertySnapshot — Tier 1 + Tier 2 enrichment for a single property
//
// Calls 8 endpoints in serial (throttled to PropertyData's 4-calls/10s
// limit). Designed to be invoked at scout time per UNIQUE POSTCODE, and
// the result attached to every lead in that postcode. Aggressive caching
// in fetchPropertyData means repeated calls on the same postcode are free.
// ---------------------------------------------------------------------------

export type PropertySnapshot = {
  /** AVM result */
  avm: {
    estimatePence: number | null;
    lowPence: number | null;
    highPence: number | null;
    confidence: string | null;
  } | null;
  /** Sold-price comparables for the postcode */
  sold: SoldPrices | null;
  /** Yields */
  yields: YieldsReading | null;
  /** Asking price per sqft benchmark */
  pricesPerSqf: PricesPerSqf | null;
  /** Sales demand 0-100 */
  demandScore: number | null;
  /** Days-on-market average */
  daysOnMarketAvg: number | null;
  /** 5yr forecast growth */
  growth: GrowthReading | null;
  /** Council tax band info */
  councilTax: CouncilTaxReading | null;
  /** Flood-risk band */
  flood: { riversAndSea: string | null; surfaceWater: string | null } | null;
  /** EPC matched to the address (if address provided) — same wrapper we use in preflight */
  epc: { rating: string | null; matchedAddress: string | null } | null;
  /** Tenure matched to address */
  tenure: {
    tenure: 'freehold' | 'leasehold' | 'unknown';
    remainingLeaseYears: number | null;
    matchedAddress: string | null;
  } | null;
  /** Top local agents */
  agents: Array<{
    name: string;
    phone: string | null;
    listings: number | null;
    url: string | null;
  }>;
  /** Errors per source — informational, NOT thrown */
  errors: Record<string, string>;
  fetchedAt: string;
};

export async function getPropertySnapshot(input: {
  postcode: string;
  address?: string;
  propertyType?:
    | 'detached'
    | 'semi-detached'
    | 'terraced'
    | 'flat'
    | 'bungalow';
  bedrooms?: number;
  internalAreaSqft?: number;
}): Promise<PropertySnapshot> {
  const errors: Record<string, string> = {};
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const DELAY = 2700;

  // Helper to wrap each call so we never throw — collect into errors[].
  const safe = async <T>(
    key: string,
    fn: () => Promise<T>,
  ): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      errors[key] = (err as Error)?.message?.slice(0, 150) ?? 'failed';
      return null;
    }
  };

  // ── Phase A — calls that need property-level params (AVM) ─────────────
  // /valuation-sale accepts detached|semi-detached|terraced|flat. Map
  // bungalow → detached as the closest valuation proxy.
  const avmType: 'detached' | 'semi-detached' | 'terraced' | 'flat' | null =
    input.propertyType === 'bungalow'
      ? 'detached'
      : input.propertyType ?? null;
  const avmInput = avmType
    ? {
        postcode: input.postcode,
        propertyType: avmType,
        bedrooms: input.bedrooms,
        internalArea: input.internalAreaSqft,
      }
    : null;
  const avmRaw = avmInput
    ? await safe('avm', () => getPropertyDataValuation(avmInput))
    : null;
  const avm = avmRaw
    ? {
        estimatePence: Math.round(avmRaw.estimate * 100),
        lowPence: Math.round(avmRaw.low * 100),
        highPence: Math.round(avmRaw.high * 100),
        confidence: avmRaw.confidence,
      }
    : null;
  await sleep(DELAY);

  // ── Phase B — postcode-level lookups (sequential, throttled) ─────────
  const sold = await safe('sold', () => getSoldPrices(input.postcode));
  await sleep(DELAY);
  const yieldsRes = await safe('yields', () => getYields(input.postcode));
  await sleep(DELAY);
  const pricesPerSqf = await safe('pricesPerSqf', () =>
    getPricesPerSqf(input.postcode),
  );
  await sleep(DELAY);
  const demandRaw = await safe('demand', () =>
    getMarketDemand(input.postcode),
  );
  const demandScore =
    typeof (demandRaw as { result?: { sales_demand_score?: number } } | null)
      ?.result?.sales_demand_score === 'number'
      ? (demandRaw as { result: { sales_demand_score: number } }).result
          .sales_demand_score
      : null;
  const daysOnMarketAvg =
    typeof (demandRaw as { result?: { days_on_market_average?: number } } | null)
      ?.result?.days_on_market_average === 'number'
      ? (demandRaw as { result: { days_on_market_average: number } }).result
          .days_on_market_average
      : null;
  await sleep(DELAY);
  const growthRes = await safe('growth', () => getGrowth(input.postcode));
  await sleep(DELAY);
  const councilTax = await safe('councilTax', () =>
    getCouncilTax(input.postcode),
  );
  await sleep(DELAY);
  const floodRaw = await safe('flood', () => getFloodRisk(input.postcode));
  const flood = floodRaw
    ? {
        riversAndSea:
          ((floodRaw as { result?: { rivers_and_sea?: string } } | null)
            ?.result?.rivers_and_sea as string | undefined) ?? null,
        surfaceWater:
          ((floodRaw as { result?: { surface_water?: string } } | null)
            ?.result?.surface_water as string | undefined) ?? null,
      }
    : null;
  await sleep(DELAY);
  // EPC + tenure already pulled in preflight per postcode. Re-pull cheaply
  // (cached at 90d/30d respectively).
  const epcRows = await safe('epc', () => getEpcByPostcode(input.postcode));
  let epc: PropertySnapshot['epc'] = null;
  if (epcRows && epcRows.length > 0) {
    const targetAddr = input.address?.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = targetAddr
      ? epcRows.find((r) => {
          const a = r.address.toLowerCase().replace(/[^a-z0-9]/g, '');
          return a.startsWith(targetAddr) || targetAddr.startsWith(a);
        })
      : null;
    const pick = match ?? epcRows[0];
    if (pick) {
      epc = {
        rating: pick.rating,
        matchedAddress: pick.address,
      };
    }
  }
  await sleep(DELAY);
  const tenureRows = await safe('tenure', () =>
    getTenureByPostcode(input.postcode),
  );
  let tenure: PropertySnapshot['tenure'] = null;
  if (tenureRows && tenureRows.length > 0) {
    const targetAddr = input.address?.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = targetAddr
      ? tenureRows.find((r) => {
          const a = r.address.toLowerCase().replace(/[^a-z0-9]/g, '');
          return a.startsWith(targetAddr) || targetAddr.startsWith(a);
        })
      : null;
    const pick = match ?? tenureRows[0];
    if (pick) {
      tenure = {
        tenure: pick.tenure,
        remainingLeaseYears: pick.remainingLeaseYears,
        matchedAddress: pick.address,
      };
    }
  }
  await sleep(DELAY);
  const agentsRaw = await safe('agents', () =>
    getAgentsByPostcode(input.postcode),
  );
  const agents: PropertySnapshot['agents'] = [];
  const agentsList = (agentsRaw as { result?: { agents?: unknown[] } } | null)
    ?.result?.agents;
  if (Array.isArray(agentsList)) {
    for (const raw of agentsList.slice(0, 5)) {
      const a = raw as Record<string, unknown>;
      if (typeof a.name !== 'string') continue;
      agents.push({
        name: a.name,
        phone: typeof a.phone === 'string' ? a.phone : null,
        listings:
          typeof a.number_of_listings === 'number'
            ? a.number_of_listings
            : null,
        url: typeof a.url === 'string' ? a.url : null,
      });
    }
  }

  return {
    avm,
    sold,
    yields: yieldsRes ?? null,
    pricesPerSqf,
    demandScore,
    daysOnMarketAvg,
    growth: growthRes ?? null,
    councilTax,
    flood,
    epc,
    tenure,
    agents,
    errors,
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------

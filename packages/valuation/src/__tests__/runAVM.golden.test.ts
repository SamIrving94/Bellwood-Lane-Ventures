/**
 * Golden tests for runAVM — the AVM orchestrator that underwrites every
 * binding offer Bellwood signs.
 *
 * Three scenarios, locked to current behaviour:
 *   1. Normal terraced sale in M14 — standard seller, healthy comps
 *   2. Chain-break with EPC F      — chain-break seller, EPC penalty
 *   3. Probate with no comps       — fallback path, probate margin, flood
 *
 * @repo/property-data is fully mocked so the math is deterministic and tests
 * don't hit gov.uk APIs. If you change AVM weights, expect these to fail —
 * that is the alarm bell.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SCENARIO_CHAIN_BREAK_EPC_F,
  SCENARIO_NORMAL_TERRACED,
  SCENARIO_PROBATE_NO_COMPS,
  SCENARIO_PROBATE_SECTOR_COMPS,
} from './test-fixtures';

// Stub out the entire property-data package. Each test resets the mocks to
// the scenario it cares about.
vi.mock('@repo/property-data', () => ({
  getPricePaid: vi.fn(),
  getHousepriceIndex: vi.fn(),
  getEpcData: vi.fn(),
  getPropertyDataValuation: vi.fn(),
  getPropertyFloorArea: vi.fn(),
  // Size pillar dependencies — stubbed to "no rows / no benchmark" so the
  // golden math stays the pre-size blend. Failing to stub them would leave
  // the pillar undefined and throw inside the valuation.
  getFloorAreaRows: vi.fn(),
  getPricesPerSqf: vi.fn(),
  // Sector comps (Land Registry SPARQL) — the evidence of last resort.
  // Stubbed dark by default so the golden scenarios keep their comp sets.
  getSectorPricePaid: vi.fn(),
  // Pure provenance filter — keep the REAL implementation. Stubbing it out
  // would let fabricated comps through the very guard we're locking in.
  realTransactions: (txs: Array<{ provenance?: string }>) =>
    txs.filter((t) => t.provenance === 'hmlr_ppd'),
  // Distance-weighted path dependencies. These golden tests lock the
  // Land-Registry fallback math, so we disable the distance path by making
  // the subject ungeocodable (geocodePostcode → null). getSoldPrices is also
  // stubbed so no real network call can leak through.
  geocodePostcode: vi.fn(),
  geocodePostcodes: vi.fn(),
  getSoldPrices: vi.fn(),
  distanceMiles: vi.fn(),
  // Market signals (listing body language) — display-context only, mocked
  // dark so the golden valuation math stays untouched.
  getSubjectMarketSignals: vi.fn(),
}));

// Imported AFTER vi.mock so the mocked module is in scope.
const {
  getPricePaid,
  getHousepriceIndex,
  getEpcData,
  getPropertyDataValuation,
  getPropertyFloorArea,
  getFloorAreaRows,
  getPricesPerSqf,
  getSectorPricePaid,
  geocodePostcode,
  geocodePostcodes,
  getSoldPrices,
  getSubjectMarketSignals,
} = await import('@repo/property-data');
const { runAVM, InsufficientEvidenceError } = await import('../index');

function applyScenario(scn: {
  pricePaid: unknown;
  hpi: unknown;
  epc: unknown;
  externalAvm: unknown;
  sector?: unknown;
}) {
  vi.mocked(getPricePaid).mockResolvedValue(scn.pricePaid as never);
  vi.mocked(getSectorPricePaid).mockResolvedValue(
    (scn.sector ?? {
      sector: 'M14 5',
      transactions: [],
      source: 'hmlr_ppd_sector',
    }) as never
  );
  vi.mocked(getHousepriceIndex).mockResolvedValue(scn.hpi as never);
  vi.mocked(getEpcData).mockResolvedValue(scn.epc as never);
  vi.mocked(getPropertyDataValuation).mockResolvedValue(
    scn.externalAvm as never
  );
  // No verified per-property floor area in the golden scenarios (real-or-null).
  vi.mocked(getPropertyFloorArea).mockResolvedValue(null as never);
  vi.mocked(getFloorAreaRows).mockResolvedValue([] as never);
  vi.mocked(getPricesPerSqf).mockResolvedValue(null as never);
  // Disable the distance path for the golden (HMLR fallback) scenarios.
  vi.mocked(geocodePostcode).mockResolvedValue(null as never);
  vi.mocked(geocodePostcodes).mockResolvedValue(new Map() as never);
  vi.mocked(getSoldPrices).mockResolvedValue(null as never);
  // Signals dark — resultJson.marketSignals must land as null, not blow up.
  vi.mocked(getSubjectMarketSignals).mockRejectedValue(
    new Error('unavailable in golden tests') as never
  );
  // Benchmark dark — the size anchor sits out, original weights apply.
  vi.mocked(getPricesPerSqf).mockResolvedValue(null as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runAVM — Scenario 1: Normal terraced sale in M14', () => {
  beforeEach(() => applyScenario(SCENARIO_NORMAL_TERRACED));

  it('produces a high-confidence offer ~78% of AVM with no escalation', async () => {
    const result = await runAVM({
      postcode: 'M14 5AB',
      propertyType: 'terraced',
      address: '1 Test Street, Manchester',
      sellerType: 'standard',
      bedrooms: 3,
    });

    const r = result.resultJson;

    // AVM should land in the £270k–£310k band for our mock comps
    expect(r.avmPointEstimate).toBeGreaterThan(270_000);
    expect(r.avmPointEstimate).toBeLessThan(310_000);
    expect(r.comparableCount).toBeGreaterThanOrEqual(10);

    // Offer should be 70-82% of AVM (standard 22% margin, no extra risk)
    const offerPct = r.finalOffer / r.avmPointEstimate;
    expect(offerPct).toBeGreaterThan(0.7);
    expect(offerPct).toBeLessThan(0.82);

    // No CEO escalation, no pre-RICS flags
    expect(r.requiresCeoEscalation).toBe(false);
    expect(r.preRicsFlags).toEqual([]);

    // Composite risk score is low
    expect(result.riskScore).toBeLessThan(15);

    // 36-month forecast exists and is sensible
    expect(r.forecast36mValue).toBeGreaterThan(0);
    expect(r.forecast36mHigh).toBeGreaterThan(r.forecast36mLow);
  });
});

describe('runAVM — Scenario 2: Chain-break with EPC F', () => {
  beforeEach(() => applyScenario(SCENARIO_CHAIN_BREAK_EPC_F));

  it('applies the EPC F penalty and surfaces the energy disclosure flag', async () => {
    const result = await runAVM({
      postcode: 'M14 5AB',
      propertyType: 'terraced',
      address: '7 Test Street, Manchester',
      sellerType: 'chain_break',
      bedrooms: 3,
    });

    const r = result.resultJson;

    // EPC F penalty must appear in the discount lines
    expect(r.discountLines.some((d) => d.label.includes('EPC band F'))).toBe(
      true
    );
    expect(r.epcAdjustment).toBeLessThan(0); // negative = penalty
    expect(r.epcRating).toBe('F');

    // Pre-RICS energy disclosure flag must fire
    expect(r.preRicsFlags.some((f) => f.includes('EPC band F'))).toBe(true);

    // Offer falls below 78% (the standard-clean band) because of the EPC pull
    const offerPct = r.finalOffer / r.avmPointEstimate;
    expect(offerPct).toBeLessThan(0.79);
    expect(offerPct).toBeGreaterThan(0.6); // still above the floor
    expect(r.requiresCeoEscalation).toBe(false);
  });
});

describe('runAVM — Scenario 3: Probate with no comps + flood zone 2', () => {
  beforeEach(() => applyScenario(SCENARIO_PROBATE_NO_COMPS));

  it('refuses to value with no sold evidence from any source', async () => {
    // Postcode feed empty, sector feed empty → no number, a typed error.
    // Before Sep 2026 this priced off avgPrice × type discount (~£220k),
    // which is how a placeholder became an offer.
    await expect(
      runAVM({
        postcode: 'M14 5AB',
        propertyType: 'terraced',
        address: '12 Test Street, Manchester',
        sellerType: 'probate',
        floodZone: 'zone_2',
      })
    ).rejects.toBeInstanceOf(InsufficientEvidenceError);

    // The sector source was actually consulted before giving up.
    expect(getSectorPricePaid).toHaveBeenCalledWith('M14 5AB', {
      propertyType: 'terraced',
    });
    // Nothing at all should be frozen for the backtest — there is no number.
  });

  it('names unreachable feeds so "no sales" is not confused with "could not look"', async () => {
    applyScenario({
      ...SCENARIO_PROBATE_NO_COMPS,
      pricePaid: { source: 'synthetic', avgPrice: 260_000, transactions: [] },
      sector: { sector: 'M14 5', transactions: [], source: 'unavailable' },
    });
    const err = await runAVM({
      postcode: 'M14 5AB',
      propertyType: 'terraced',
      address: '12 Test Street, Manchester',
      sellerType: 'probate',
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InsufficientEvidenceError);
    expect((err as InstanceType<typeof InsufficientEvidenceError>).reason).toBe(
      'sources_unavailable'
    );
  });
});

describe('runAVM — Scenario 3b: sector comps rescue a zero-postcode valuation', () => {
  beforeEach(() => applyScenario(SCENARIO_PROBATE_SECTOR_COMPS));

  it('values off the sector sales, capped at low confidence, and says so in the source', async () => {
    const result = await runAVM({
      postcode: 'M14 5AB',
      propertyType: 'terraced',
      address: '12 Test Street, Manchester',
      sellerType: 'probate',
      floodZone: 'zone_2',
    });
    const r = result.resultJson;

    // Three real sector sales at ~£240k drive the CSA; no synthetic input.
    expect(r.comparableCount).toBe(3);
    expect(r.avmPointEstimate).toBeGreaterThan(215_000);
    expect(r.avmPointEstimate).toBeLessThan(275_000);
    expect(r.avmSources).toMatch(/^hmlr_ppd_sector\(3@M14 5\)/);

    // Sector comps carry no distance — never better than low.
    expect(r.confidenceLevel).toBe('low');
    expect(r.comparables.every((c) => c.distanceMiles === null)).toBe(true);
    expect(r.comparables[0]?.address).toBe('14 TEST STREET');

    // Probate seller type → 20% base margin, flood zone 2 still applied.
    expect(r.sellerType).toBe('probate');
    expect(r.baseAcquisitionMargin).toBeCloseTo(0.2, 2);
    expect(r.discountLines.some((d) => d.label.includes('Flood'))).toBe(true);
    expect(r.floodDiscount).toBeCloseTo(0.01, 5);
    expect(r.epcRating).toBeNull();
  });
});

describe('runAVM — confidence is capped by comp volume', () => {
  // The reported bug: a valuation resting on a SINGLE sold comp was reading
  // 'high' because the hedonic and CSA estimates trivially agreed. Confidence
  // must be ceiling-capped by how many nearby sales back the estimate.
  const SINGLE_COMP = {
    ...SCENARIO_NORMAL_TERRACED,
    pricePaid: {
      ...SCENARIO_NORMAL_TERRACED.pricePaid,
      transactions: SCENARIO_NORMAL_TERRACED.pricePaid.transactions.slice(0, 1),
    },
  };
  const THREE_COMPS = {
    ...SCENARIO_NORMAL_TERRACED,
    pricePaid: {
      ...SCENARIO_NORMAL_TERRACED.pricePaid,
      transactions: SCENARIO_NORMAL_TERRACED.pricePaid.transactions.slice(0, 3),
    },
  };

  it('one comp → low confidence, never high', async () => {
    applyScenario(SINGLE_COMP);
    const r = (
      await runAVM({
        postcode: 'M14 5AB',
        propertyType: 'terraced',
        sellerType: 'standard',
      })
    ).resultJson;
    expect(r.comparableCount).toBe(1);
    expect(r.confidenceLevel).toBe('low');
  });

  it('three comps → at most medium', async () => {
    applyScenario(THREE_COMPS);
    const r = (
      await runAVM({
        postcode: 'M14 5AB',
        propertyType: 'terraced',
        sellerType: 'standard',
      })
    ).resultJson;
    expect(r.comparableCount).toBe(3);
    expect(r.confidenceLevel).toBe('medium');
  });

  it('a full comp set (12) can reach high', async () => {
    applyScenario(SCENARIO_NORMAL_TERRACED);
    const r = (
      await runAVM({
        postcode: 'M14 5AB',
        propertyType: 'terraced',
        sellerType: 'standard',
      })
    ).resultJson;
    expect(r.comparableCount).toBeGreaterThanOrEqual(4);
    expect(r.confidenceLevel).toBe('high');
  });
});

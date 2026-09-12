/**
 * Golden tests for the SIZE ANCHOR — area £/sqft × verified floor area as a
 * triangulation pillar (founder request, Sept 2026: "show the sq footage
 * from the EPC, price it against nearby £/sqft, and feed the AVM").
 *
 * The runAVM goldens lock the original three-pillar weights with the
 * benchmark dark; these lock the anchor's behaviour:
 *   - exact anchor arithmetic (£/sqft × m² × 10.7639)
 *   - the anchor's 25% weight on the HMLR/no-external path, verified
 *     algebraically from two runs (comps identical, benchmark varied)
 *   - the 40% deviation guard: a wild benchmark is recorded, never blended
 *   - no verified size ⇒ no anchor, estimate identical to a dark benchmark
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCENARIO_NORMAL_TERRACED } from './test-fixtures';

vi.mock('@repo/property-data', () => ({
  getPricePaid: vi.fn(),
  getHousepriceIndex: vi.fn(),
  getEpcData: vi.fn(),
  getPropertyDataValuation: vi.fn(),
  getPropertyFloorArea: vi.fn(),
  realTransactions: (txs: Array<{ provenance?: string }>) =>
    txs.filter((t) => t.provenance === 'hmlr_ppd'),
  geocodePostcode: vi.fn(),
  geocodePostcodes: vi.fn(),
  getSoldPrices: vi.fn(),
  distanceMiles: vi.fn(),
  getSubjectMarketSignals: vi.fn(),
  getPricesPerSqf: vi.fn(),
}));

const {
  getPricePaid,
  getHousepriceIndex,
  getEpcData,
  getPropertyDataValuation,
  getPropertyFloorArea,
  geocodePostcode,
  geocodePostcodes,
  getSoldPrices,
  getSubjectMarketSignals,
  getPricesPerSqf,
} = await import('@repo/property-data');
const { runAVM } = await import('../index');

const SQFT_PER_SQM = 10.7639;
const FLOOR_AREA_SQM = 100;

function applyBase(opts: {
  medianPerSqft: number | null;
  floorArea?: boolean;
}) {
  vi.mocked(getPricePaid).mockResolvedValue(
    SCENARIO_NORMAL_TERRACED.pricePaid as never
  );
  vi.mocked(getHousepriceIndex).mockResolvedValue(
    SCENARIO_NORMAL_TERRACED.hpi as never
  );
  vi.mocked(getEpcData).mockResolvedValue(
    SCENARIO_NORMAL_TERRACED.epc as never
  );
  // No external cross-check: isolates the HMLR/no-external weight row.
  vi.mocked(getPropertyDataValuation).mockResolvedValue(null as never);
  vi.mocked(getPropertyFloorArea).mockResolvedValue(
    (opts.floorArea === false
      ? null
      : {
          floorAreaSqm: FLOOR_AREA_SQM,
          matchedAddress: '12 Test Street',
        }) as never
  );
  vi.mocked(geocodePostcode).mockResolvedValue(null as never);
  vi.mocked(geocodePostcodes).mockResolvedValue(new Map() as never);
  vi.mocked(getSoldPrices).mockResolvedValue(null as never);
  vi.mocked(getSubjectMarketSignals).mockRejectedValue(
    new Error('dark') as never
  );
  vi.mocked(getPricesPerSqf).mockResolvedValue(
    (opts.medianPerSqft === null
      ? null
      : { medianPerSqft: opts.medianPerSqft, averagePerSqft: null }) as never
  );
}

async function run() {
  const result = await runAVM({
    postcode: 'M14 5AB',
    propertyType: 'terraced',
    address: '12 Test Street',
    sellerType: 'standard',
  });
  return result.resultJson;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('size anchor — verified size priced at the area £/sqft', () => {
  it('computes the anchor exactly and advertises +ppsf in the source', async () => {
    applyBase({ medianPerSqft: 320 });
    const r = await run();

    const expectedAnchor = Math.round(320 * FLOOR_AREA_SQM * SQFT_PER_SQM);
    expect(r.sizeAnchorValue).toBe(expectedAnchor);
    expect(r.sizeAnchorUsed).toBe(true);
    expect(r.areaPricePerSqft).toBe(320);
    expect(r.floorAreaSqm).toBe(FLOOR_AREA_SQM);
    expect(r.pricePerSqm).toBe(Math.round(r.avmPointEstimate / FLOOR_AREA_SQM));
    expect(r.avmSources).toContain('+ppsf');
  });

  it('gives the anchor EXACTLY its 25% weight (HMLR, no external)', async () => {
    // Comps identical between runs, only the benchmark moves — so the
    // difference in point estimates must be 25% of the anchor difference,
    // whatever the comp-side values are. ±1 for double rounding.
    applyBase({ medianPerSqft: 320 });
    const high = await run();
    applyBase({ medianPerSqft: 280 });
    const low = await run();

    expect(high.sizeAnchorUsed).toBe(true);
    expect(low.sizeAnchorUsed).toBe(true);
    const anchorDelta =
      (high.sizeAnchorValue ?? 0) - (low.sizeAnchorValue ?? 0);
    expect(
      Math.abs(
        high.avmPointEstimate - low.avmPointEstimate - 0.25 * anchorDelta
      )
    ).toBeLessThanOrEqual(1);
  });

  it('anchor pulls the estimate the right way', async () => {
    applyBase({ medianPerSqft: null });
    const dark = await run();
    applyBase({ medianPerSqft: 320 }); // anchor ≈ £344k, comps ≈ £290k
    const anchored = await run();

    expect(anchored.avmPointEstimate).toBeGreaterThan(dark.avmPointEstimate);
  });

  it('deviation guard: a wild benchmark is recorded but never blended', async () => {
    applyBase({ medianPerSqft: null });
    const dark = await run();
    // £600/sqft on ~£290k comps ⇒ anchor ≈ £646k, ~120% off the CSA.
    applyBase({ medianPerSqft: 600 });
    const guarded = await run();

    expect(guarded.sizeAnchorValue).toBe(
      Math.round(600 * FLOOR_AREA_SQM * SQFT_PER_SQM)
    );
    expect(guarded.sizeAnchorUsed).toBe(false);
    expect(guarded.avmSources).not.toContain('+ppsf');
    expect(guarded.avmPointEstimate).toBe(dark.avmPointEstimate);
  });

  it('no verified size ⇒ no anchor, even with a benchmark present', async () => {
    applyBase({ medianPerSqft: null, floorArea: false });
    const dark = await run();
    applyBase({ medianPerSqft: 320, floorArea: false });
    const withBenchmark = await run();

    expect(withBenchmark.sizeAnchorValue).toBeNull();
    expect(withBenchmark.sizeAnchorUsed).toBe(false);
    expect(withBenchmark.pricePerSqm).toBeNull();
    // The benchmark is still reported for display…
    expect(withBenchmark.areaPricePerSqft).toBe(320);
    // …but the estimate is untouched.
    expect(withBenchmark.avmPointEstimate).toBe(dark.avmPointEstimate);
  });
});

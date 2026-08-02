/**
 * Lead scoring must not band equity against fabricated HMLR data.
 *
 * `getPricePaid` (packages/property-data/src/hmlr.ts) falls back to
 * `syntheticPricePaid()` on ANY failure — a record whose avgPrice is derived
 * from a hash of the postcode. The equity proxy used to take that number at
 * face value, so a lead whose HMLR call simply failed scored an equity band
 * off an invented area average and showed the founder a factor that read as
 * real evidence.
 *
 * packages/valuation/src/base-valuation.ts already rejects synthetic
 * price-paid records; this pins the same guard in the scorer.
 *
 * Money note: estateValuePence is PENCE, PricePaid.avgPrice is POUNDS.
 */

import type { PricePaid } from '@repo/property-data/src/hmlr';
import { describe, expect, it } from 'vitest';
import type { EnrichedLead } from '../enrichment';
import { scoreLead } from '../scorer';
import { DEFAULT_SCORER_CONFIG } from '../scorer-config';

function lead(overrides: Partial<EnrichedLead> = {}): EnrichedLead {
  return {
    probateRef: 'gazette-1',
    address: '12 Sevenoaks Avenue',
    postcode: 'SK4 4AP',
    leadType: 'probate',
    grantDate: '2026-06-01',
    grantType: 'probate',
    daysSinceGrant: 5,
    goldenWindowLabel: 'hot',
    solicitorFirm: null,
    estateValuePence: 20_000_000,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    enrichmentTier: 3,
    sourceTrail: 'gazette → tier3/manual',
    ...overrides,
  };
}

/** avgPrice in POUNDS, as HMLR reports it. */
function pricePaid(source: string): PricePaid {
  return {
    postcode: 'SK4 4AP',
    transactions: [],
    avgPrice: 200_000,
    lastSalePrice: 200_000,
    lastSaleDate: '2026-01-15',
    source,
  } as PricePaid;
}

const roiFactors = (result: ReturnType<typeof scoreLead>) =>
  result.factors.filter((f) => f.dimension === 'roi');

describe('equity proxy vs synthetic price-paid data', () => {
  it('scores a REAL comparable as a comparable', () => {
    const result = scoreLead(lead(), pricePaid('hmlr_ppd'), null, {});
    const roi = roiFactors(result);

    expect(roi).toHaveLength(1);
    expect(roi[0]?.label).not.toMatch(/no area comp|fallback/i);
    expect(roi[0]?.points).toBeGreaterThan(
      DEFAULT_SCORER_CONFIG.equityNoComparable
    );
  });

  it('treats a SYNTHETIC comparable as no comparable', () => {
    const synthetic = scoreLead(lead(), pricePaid('synthetic'), null, {});
    const none = scoreLead(lead(), null, null, {});

    // Same points, same ceiling, same achievable denominator as no data.
    expect(roiFactors(synthetic)[0]?.points).toBe(
      DEFAULT_SCORER_CONFIG.equityNoComparable
    );
    expect(synthetic.achievablePoints).toBe(none.achievablePoints);
    expect(synthetic.sourcingScore).toBe(none.sourcingScore);
  });

  it('does not claim real equity in the founder-visible factor label', () => {
    const roi = roiFactors(scoreLead(lead(), pricePaid('synthetic'), null, {}));

    expect(roi).toHaveLength(1);
    expect(roi[0]?.label).toMatch(/fallback data/i);
    expect(roi[0]?.provisional).toBe(true);
  });

  it('catches synthetic rows even when the wrapper source looks clean', () => {
    // A record assembled from fabricated rows is still fabricated.
    const mixed = {
      ...pricePaid('hmlr_ppd'),
      transactions: [
        {
          price: 200_000,
          date: '2026-01-15',
          propertyType: 'S',
          newBuild: false,
          tenure: 'F',
          provenance: 'synthetic',
        },
      ],
    } as unknown as PricePaid;

    const roi = roiFactors(scoreLead(lead(), mixed, null, {}));
    expect(roi[0]?.points).toBe(DEFAULT_SCORER_CONFIG.equityNoComparable);
  });
});

/**
 * Two-sided equity proxy tests (6 Sep 2026 rewrite).
 *
 * The old monotonic bands gave 15 points for being priced 1.5× ABOVE the
 * street and 3 for being 40% under it — five-to-one against the business's
 * own thesis. These tests pin the corrected shape:
 *
 *   discount + condition evidence  → the TOP of the proxy range
 *   discount, no evidence          → low + the honest "check why" label
 *   under 40% of the street        → token points (likely a flat/plot)
 *   above the street               → modest equity credit, no thesis
 *
 * The proxy is provisional by contract: real BMV/ROI bands replace it after
 * appraisal, unchanged by this rewrite.
 */

import type { PricePaid } from '@repo/property-data/src/hmlr';
import { describe, expect, it } from 'vitest';
import type { EnrichedLead } from '../enrichment';
import { DEFAULT_SCORER_CONFIG, type LeadSignals, scoreLead } from '../scorer';

const AREA_AVG_POUNDS = 1_000_000;

function lead(valuePounds: number): EnrichedLead {
  return {
    probateRef: 'test-ref',
    address: '12 Acacia Road',
    postcode: 'SE22 8EW',
    leadType: 'probate',
    estateValuePence: valuePounds * 100,
    sourceTrail: 'test',
  } as unknown as EnrichedLead;
}

function pricePaid(): PricePaid {
  return {
    postcode: 'SE22 8EW',
    transactions: [
      {
        price: AREA_AVG_POUNDS,
        date: '2026-01-15',
        propertyType: 'terraced',
        newBuild: false,
        tenure: 'freehold',
        provenance: 'hmlr_ppd',
      },
    ],
    avgPrice: AREA_AVG_POUNDS,
    lastSalePrice: AREA_AVG_POUNDS,
    lastSaleDate: '2026-01-15',
    source: 'hmlr_ppd',
  };
}

const EVIDENCE: LeadSignals = {
  modernisation: {
    points: 6,
    reasons: ['EPC F: heating and insulation untouched'],
  },
};

function roiFactor(valuePounds: number, signals?: LeadSignals) {
  const breakdown = scoreLead(
    lead(valuePounds),
    pricePaid(),
    null,
    signals,
    DEFAULT_SCORER_CONFIG
  );
  const factor = breakdown.factors.find((f) => f.dimension === 'roi');
  if (!factor) throw new Error('no roi factor produced');
  return factor;
}

const ep = DEFAULT_SCORER_CONFIG.equityProxy;

describe('scoreEquityProxy — the discount side, with evidence', () => {
  it('scores a deep explained discount at the top of the proxy range', () => {
    // £600k on a £1M street = 40% under, house-shaped, EPC-F evidence.
    const f = roiFactor(600_000, EVIDENCE);
    expect(f.points).toBe(ep.discountDeep);
    expect(f.label).toContain('Discounted 40% vs area');
    expect(f.label).toContain('condition explains it');
    expect(f.tone).toBe('positive');
  });

  it('grades shallower explained discounts down the range', () => {
    expect(roiFactor(800_000, EVIDENCE).points).toBe(ep.discountSolid);
    expect(roiFactor(920_000, EVIDENCE).points).toBe(ep.discountEdge);
  });

  it('accepts a condition BADGE as evidence when no modernisation signal exists', () => {
    const f = roiFactor(700_000, { listingType: 'unmodernised-properties' });
    expect(f.points).toBe(ep.discountDeep);
    expect(f.tone).toBe('positive');
  });

  it('now outranks the premium-priced house it used to lose to', () => {
    // The exact inversion the founder called wild: under the old bands the
    // £1.5M listing scored 15 and the discounted house 3.
    const discounted = roiFactor(600_000, EVIDENCE);
    const premium = roiFactor(1_500_000, EVIDENCE);
    expect(discounted.points).toBeGreaterThan(premium.points);
  });
});

describe('scoreEquityProxy — the guards', () => {
  it('keeps the check-why treatment for an unexplained discount', () => {
    const f = roiFactor(700_000, {});
    expect(f.points).toBe(ep.discountNoReason);
    expect(f.label).toContain('check why');
    expect(f.tone).toBe('neutral');
  });

  it('gives only a token to a price under 40% of the street, evidence or not', () => {
    const f = roiFactor(300_000, EVIDENCE);
    expect(f.points).toBe(ep.notComparableFloor);
    expect(f.label).toContain('may not be comparable stock');
  });
});

describe('scoreEquityProxy — above the street', () => {
  it('keeps modest equity credit above the area average', () => {
    expect(roiFactor(1_500_000, {}).points).toBe(ep.aboveAreaHigh);
    expect(roiFactor(1_050_000, {}).points).toBe(ep.aboveArea);
  });

  it('marks parity as neutral', () => {
    const f = roiFactor(970_000, {});
    expect(f.points).toBe(ep.nearArea);
    expect(f.tone).toBe('neutral');
  });
});

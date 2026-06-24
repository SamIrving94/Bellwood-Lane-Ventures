import { describe, expect, it } from 'vitest';
import type { EnrichedLead } from '../enrichment';
import { type LeadSignals, scoreLead } from '../scorer';

// A short-lease lead typically arrives with no contact and no estate value —
// the *opportunity* is the lease defect, not estate equity. These tests prove
// the marriage-value motivation bonus surfaces such a lead instead of letting
// it fall below the THIN floor, while leaving non-lease leads untouched.

function leaseExpiryLead(overrides: Partial<EnrichedLead> = {}): EnrichedLead {
  return {
    probateRef: 'lease-NW1-flat5',
    address: 'Flat 5, Milton Court',
    postcode: 'NW1 1AA',
    leadType: 'lease_expiry',
    grantDate: '2026-06-24',
    grantType: 'unknown',
    daysSinceGrant: 0,
    goldenWindowLabel: 'cold',
    solicitorFirm: null,
    estateValuePence: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    enrichmentTier: 3,
    sourceTrail: 'short_lease_marriage_value → tier3/manual',
    ...overrides,
  };
}

const shortLeaseSignals: LeadSignals = {
  listingType: 'short-lease-properties',
  tenure: 'leasehold',
  remainingLeaseYears: 72,
  marriageValueLease: true,
  leaseUrgency: 0.7,
};

describe('scorer — short-lease marriage-value motivation', () => {
  it('adds a marriage-value motivation factor for a flagged lease', () => {
    const b = scoreLead(leaseExpiryLead(), null, null, shortLeaseSignals);
    const factor = b.factors.find((f) =>
      f.label.includes('Short lease motivates sale')
    );
    expect(factor).toBeDefined();
    expect(factor?.dimension).toBe('motivation');
    expect(factor?.points).toBeGreaterThan(0);
  });

  it('lifts a contactless short-lease lead above the THIN floor', () => {
    const b = scoreLead(leaseExpiryLead(), null, null, shortLeaseSignals);
    // lease_expiry type (18) + marriage-value bonus + market-unknown (7),
    // minus the short-lease risk penalty, should still clear 30 (THIN+).
    expect(b.total).toBeGreaterThanOrEqual(30);
    expect(b.verdict).not.toBe('PASS');
  });

  it('scales the bonus with lease urgency', () => {
    const low = scoreLead(leaseExpiryLead(), null, null, {
      ...shortLeaseSignals,
      leaseUrgency: 0,
    });
    const high = scoreLead(leaseExpiryLead(), null, null, {
      ...shortLeaseSignals,
      leaseUrgency: 1,
    });
    expect(high.motivation).toBeGreaterThan(low.motivation);
  });

  it('does NOT add the bonus for an ordinary lead without the flag', () => {
    const ordinary: LeadSignals = {
      tenure: 'leasehold',
      remainingLeaseYears: 72,
    };
    const b = scoreLead(leaseExpiryLead(), null, null, ordinary);
    expect(
      b.factors.some((f) => f.label.includes('Short lease motivates sale'))
    ).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import type { EnrichedLead } from '../enrichment';
import { type LeadSignals, scoreLead } from '../scorer';
import { DEFAULT_SCORER_CONFIG, mergeScorerConfig } from '../scorer-config';

function listingLead(overrides: Partial<EnrichedLead> = {}): EnrichedLead {
  return {
    probateRef: 'pd-1',
    address: '4 Reduced Road',
    postcode: 'M14 5LL',
    leadType: 'unknown',
    grantDate: '2026-09-01',
    grantType: 'unknown',
    daysSinceGrant: 30,
    goldenWindowLabel: 'cold',
    solicitorFirm: null,
    estateValuePence: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    enrichmentTier: 3,
    sourceTrail: 'propertydata_reduced-properties',
    ...overrides,
  };
}

describe('scorer — listing-text motivation factor', () => {
  it('adds a labelled acquisition factor for a strong read', () => {
    const signals: LeadSignals = {
      listingType: 'reduced-properties',
      motivation: {
        level: 'strong',
        signals: ['executor_sale', 'cash_buyers_only'],
      },
    };
    const without = scoreLead(listingLead(), null, null, {
      listingType: 'reduced-properties',
    });
    const withRead = scoreLead(listingLead(), null, null, signals);

    const factor = withRead.factors.find((f) =>
      f.label.startsWith('Listing text:')
    );
    expect(factor).toBeDefined();
    expect(factor?.dimension).toBe('acquisition');
    expect(factor?.points).toBe(
      DEFAULT_SCORER_CONFIG.motivationSignalPoints.strong
    );
    expect(factor?.label).toContain('executor sale');
    expect(factor?.label).toContain('cash buyers only');
    expect(withRead.acquisition - without.acquisition).toBe(
      DEFAULT_SCORER_CONFIG.motivationSignalPoints.strong
    );
  });

  it('pays the smaller amount for a soft read', () => {
    const b = scoreLead(listingLead(), null, null, {
      motivation: { level: 'some', signals: ['no_onward_chain'] },
    });
    const factor = b.factors.find((f) => f.label.startsWith('Listing text:'));
    expect(factor?.points).toBe(
      DEFAULT_SCORER_CONFIG.motivationSignalPoints.some
    );
  });

  it('adds nothing for a null read', () => {
    const b = scoreLead(listingLead(), null, null, { motivation: null });
    expect(b.factors.some((f) => f.label.startsWith('Listing text:'))).toBe(
      false
    );
  });

  it('is founder-tunable and can be switched off from config', () => {
    const off = mergeScorerConfig({
      motivationSignalPoints: { strong: 0, some: 0 },
    });
    const b = scoreLead(
      listingLead(),
      null,
      null,
      { motivation: { level: 'strong', signals: ['executor_sale'] } },
      off
    );
    expect(b.factors.some((f) => f.label.startsWith('Listing text:'))).toBe(
      false
    );

    const partial = mergeScorerConfig({
      motivationSignalPoints: { strong: 12 },
    });
    expect(partial.motivationSignalPoints).toEqual({ strong: 12, some: 3 });
    expect(
      mergeScorerConfig({ motivationSignalPoints: 'junk' })
        .motivationSignalPoints
    ).toEqual(DEFAULT_SCORER_CONFIG.motivationSignalPoints);
  });
});

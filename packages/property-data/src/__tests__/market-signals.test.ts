/**
 * Market signals — subject matching must never guess.
 *
 * A matched listing pins price cuts and days-on-market on a specific house,
 * so the matcher follows the repo's no-fabrication rule: same postcode plus
 * unambiguous house-number evidence, or no match at all.
 */

import { describe, expect, it } from 'vitest';
import {
  NEARBY_CAP,
  buildMarketSignals,
  houseNumber,
  matchSubjectListing,
} from '../market-signals';
import type { SourcedProperty } from '../propertydata';

function listing(overrides: Partial<SourcedProperty>): SourcedProperty {
  return {
    id: null,
    address: '1 Test Street',
    preciseAddress: null,
    postcode: 'E11 3AD',
    pricePence: 50_000_000,
    bedrooms: 3,
    propertyType: 'Terraced house',
    listingType: 'reduced-properties',
    listingUrl: null,
    daysOnMarket: 90,
    daysSincePriceChange: 10,
    originalPricePence: null,
    discountPercent: null,
    reductionCount: 0,
    velocityScore: 0,
    summary: null,
    imageUrl: null,
    source: 'propertydata_reduced-properties',
    sstc: null,
    listingSqft: null,
    ...overrides,
  };
}

describe('houseNumber', () => {
  it('finds plain and lettered numbers, ignores street words', () => {
    expect(houseNumber('12 Mornington Road')).toBe('12');
    expect(houseNumber('Flat 8a, Hermon Hill')).toBe('8a');
    expect(houseNumber('Mornington Road')).toBeNull();
    expect(houseNumber(null)).toBeNull();
  });
});

describe('matchSubjectListing', () => {
  const subject = { address: '12 Mornington Road', postcode: 'E11 3AD' };

  it('matches on same postcode + unique house number', () => {
    const hit = listing({ address: '12 Mornington Road, London' });
    const other = listing({ address: '8 Mornington Road, London' });
    expect(matchSubjectListing(subject, [other, hit])).toBe(hit);
  });

  it('requires the postcode to match exactly (compact compare)', () => {
    const wrongPc = listing({
      address: '12 Mornington Road',
      postcode: 'E18 2BD',
    });
    expect(matchSubjectListing(subject, [wrongPc])).toBeNull();
    const spaced = listing({
      address: '12 Mornington Road',
      postcode: 'e113ad',
    });
    expect(matchSubjectListing(subject, [spaced])).toBe(spaced);
  });

  it('refuses ambiguous number matches — two candidates carry "12"', () => {
    const a = listing({ address: '12 Mornington Road' });
    const b = listing({ address: '12a Mornington Road, Flat 12' });
    expect(matchSubjectListing(subject, [a, b])).toBeNull();
  });

  it('without a subject house number, only a whole-address match counts', () => {
    const noNumber = { address: 'Mornington Lodge', postcode: 'E11 3AD' };
    const exact = listing({ address: 'Mornington Lodge' });
    const near = listing({ address: 'Mornington Lodge Annex' });
    expect(matchSubjectListing(noNumber, [exact])).toBe(exact);
    expect(matchSubjectListing(noNumber, [near])).toBeNull();
    expect(matchSubjectListing(noNumber, [exact, exact])).toBeNull();
  });

  it('prefers preciseAddress for the number evidence when present', () => {
    const precise = listing({
      address: 'Mornington Road',
      preciseAddress: '12 Mornington Road',
    });
    expect(matchSubjectListing(subject, [precise])).toBe(precise);
  });
});

describe('buildMarketSignals', () => {
  const subject = { address: '12 Mornington Road', postcode: 'E11 3AD' };

  it('carries the matched listing and excludes it from nearby', () => {
    const hit = listing({
      address: '12 Mornington Road',
      daysOnMarket: 120,
      reductionCount: 2,
      discountPercent: 8,
    });
    const other = listing({ address: '8 Elm Grove', discountPercent: 15 });
    const signals = buildMarketSignals({
      subject,
      listings: [hit, other],
      radiusMiles: 0.25,
    });
    expect(signals.distressListed).toBe(true);
    expect(signals.daysOnMarket).toBe(120);
    expect(signals.reductionCount).toBe(2);
    expect(signals.nearby).toHaveLength(1);
    expect(signals.nearby[0]?.address).toBe('8 Elm Grove');
    expect(signals.nearbyDistressCount).toBe(1);
  });

  it('no match ⇒ distressListed false, all listings become nearby', () => {
    const listings = [
      listing({ address: '8 Elm Grove', discountPercent: 5 }),
      listing({ address: '3 Oak Way', discountPercent: 20 }),
    ];
    const signals = buildMarketSignals({
      subject,
      listings,
      radiusMiles: 0.25,
    });
    expect(signals.distressListed).toBe(false);
    expect(signals.matchedAddress).toBeNull();
    // Deepest cut first.
    expect(signals.nearby[0]?.address).toBe('3 Oak Way');
    expect(signals.nearbyDistressCount).toBe(2);
  });

  it('caps nearby at NEARBY_CAP but reports the true count', () => {
    const many = Array.from({ length: NEARBY_CAP + 5 }, (_, i) =>
      listing({ address: `${i + 100} Long Road`, postcode: 'E11 4XX' })
    );
    const signals = buildMarketSignals({
      subject,
      listings: many,
      radiusMiles: 0.25,
    });
    expect(signals.nearby).toHaveLength(NEARBY_CAP);
    expect(signals.nearbyDistressCount).toBe(NEARBY_CAP + 5);
  });
});

import { describe, expect, test } from 'vitest';
import { planLead, rightmoveListingUrl } from '../app/cron/_lib/uprn-plan';

// Shapes from prod leads (Oct 2026): a street-only Rightmove listing, a
// Zoopla one, and a listing PropertyData resolved to a home.
const streetOnly = {
  address: 'Balham High Road, London, SW17',
  postcode: 'SW17',
  uprnCheckedAt: null,
};

describe('rightmoveListingUrl', () => {
  test('R ids are Rightmove listings', () => {
    expect(rightmoveListingUrl('R169827281')).toBe(
      'https://www.rightmove.co.uk/properties/169827281'
    );
  });

  test('Zoopla and anything else cannot be looked up', () => {
    expect(rightmoveListingUrl('Z70668769')).toBeNull();
    expect(rightmoveListingUrl(null)).toBeNull();
    expect(rightmoveListingUrl('R')).toBeNull();
  });
});

describe('planLead', () => {
  test('a house-numbered precise address goes straight to the matcher', () => {
    expect(
      planLead(
        {
          address: 'Hardy Avenue, Chorlton',
          postcode: 'M21 9ER',
          uprnCheckedAt: null,
          propertyData: {
            id: 'R1',
            preciseAddress: '2, HARDY AVENUE, MANCHESTER, M21 9ER',
          },
        },
        true
      )
    ).toEqual({
      kind: 'match',
      address: '2, HARDY AVENUE, MANCHESTER, M21 9ER',
      postcode: 'M21 9ER',
    });
  });

  test('a street-only Rightmove listing is looked up once', () => {
    expect(
      planLead({ ...streetOnly, propertyData: { id: 'R167470340' } }, true)
    ).toEqual({
      kind: 'lookup',
      url: 'https://www.rightmove.co.uk/properties/167470340',
    });
  });

  test('a resolved listing brings the full address AND the full postcode', () => {
    expect(
      planLead(
        {
          ...streetOnly,
          propertyData: {
            id: 'R167470340',
            listingLookup: {
              checkedAt: '2026-10-18T09:00:00Z',
              resolved: true,
              uprn: '121019801',
              address: 'FLAT 3, 12 BALHAM HIGH ROAD, LONDON, SW17 7JU',
              postcode: 'SW17 7JU',
            },
          },
        },
        true
      )
    ).toEqual({
      kind: 'match',
      address: 'FLAT 3, 12 BALHAM HIGH ROAD, LONDON, SW17 7JU',
      postcode: 'SW17 7JU',
    });
  });

  test('an unresolved listing is never asked about again', () => {
    const lookedUp = {
      ...streetOnly,
      propertyData: {
        id: 'R167470340',
        listingLookup: { checkedAt: '2026-10-18T09:00:00Z', resolved: false },
      },
    };
    // First time through it is stamped street-only so a person sees why…
    expect(planLead(lookedUp, true)).toEqual({
      kind: 'match',
      address: streetOnly.address,
      postcode: 'SW17',
    });
    // …and after that it is left alone: no write, no credits.
    expect(planLead({ ...lookedUp, uprnCheckedAt: new Date() }, true)).toEqual({
      kind: 'skip',
    });
  });

  test('over the per-run lookup budget, a street-only lead waits', () => {
    expect(
      planLead(
        {
          ...streetOnly,
          uprnCheckedAt: new Date(),
          propertyData: { id: 'R167470340' },
        },
        false
      )
    ).toEqual({ kind: 'skip' });
  });

  test('a street-only Zoopla listing is stamped once, then left', () => {
    const zoopla = { ...streetOnly, propertyData: { id: 'Z70668769' } };
    expect(planLead(zoopla, true).kind).toBe('match');
    expect(planLead({ ...zoopla, uprnCheckedAt: new Date() }, true)).toEqual({
      kind: 'skip',
    });
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('@repo/property-data', () => ({
  getEpcData: vi.fn(async () => ({
    source: 'live',
    epcRating: 'E',
    epcScore: 48,
    propertyType: 'House',
    floorAreaSqm: 90,
    constructionAgeBand: '1930-1949',
    heatingType: 'Gas boiler',
    inspectionDate: '2019-03-01',
  })),
  getPricePaidWithAddresses: vi.fn(async () => [
    {
      address: '12 ELM ROAD, MANCHESTER',
      date: '2024-05-01',
      price: 240000,
      propertyType: 'semi-detached',
    },
    {
      address: '14 ELM ROAD, MANCHESTER',
      date: '2023-02-01',
      price: 225000,
      propertyType: 'semi-detached',
    },
    {
      address: '3 ELM ROAD, MANCHESTER',
      date: '2025-01-10',
      price: 260000,
      propertyType: 'terraced',
    },
    {
      address: '9 ELM ROAD, MANCHESTER',
      date: '2025-06-10',
      price: 0,
      propertyType: 'terraced',
    },
  ]),
}));

import { buildKeyholeReport, isSameAddress } from '../property-facts';

describe('buildKeyholeReport', () => {
  it('returns open-data facts, newest sale first, and never a value', async () => {
    const r = await buildKeyholeReport({
      addressLine: '12 Elm Road',
      postcode: 'm14 5ab',
    });
    expect(r.postcode).toBe('M14 5AB');
    expect(r.epc.rating).toBe('E');
    expect(r.streetSales.map((s) => s.pricePounds)).toEqual([
      260000, 240000, 225000,
    ]);
    expect(r.streetSales.find((s) => s.sameAddress)?.address).toMatch(
      /^12 ELM/
    );
    expect(r.streetContext?.medianPricePounds).toBe(240000);
    expect(r.refurb.floorAreaSqm).toBe(90);
    expect(JSON.stringify(r)).not.toMatch(/valuation|estimatedValue|offer/i);
  });
});

describe('isSameAddress', () => {
  it('matches the house number strictly', () => {
    expect(isSameAddress('12 Elm Road', '12 ELM ROAD')).toBe(true);
    expect(isSameAddress('12 Elm Road', '112 ELM ROAD')).toBe(false);
    expect(isSameAddress('Rose Cottage', 'ROSE COTTAGE, HIGH STREET')).toBe(
      true
    );
  });
});

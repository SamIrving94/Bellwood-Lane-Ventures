/**
 * Lead → deal conversion: the deal must inherit the PROPERTY type, never the
 * seller type. Every converted deal used to say "probate"/"chain_break" in
 * its type column and was valued as a terraced house.
 */
import { describe, expect, it } from 'vitest';
import { propertyFromLead } from '../lib/lead-to-deal';

describe('propertyFromLead', () => {
  it('a flat lead converts to a flat deal, with its bedrooms', () => {
    expect(
      propertyFromLead({ propertyData: { propertyType: 'Flat', bedrooms: 2 } })
    ).toEqual({ propertyType: 'flat', bedrooms: 2 });
  });

  it('reads listing phrasing as our types', () => {
    const t = (raw: string) =>
      propertyFromLead({ propertyData: { propertyType: raw } }).propertyType;
    expect(t('Semi-Detached House')).toBe('semi-detached');
    expect(t('End of Terrace')).toBe('terraced');
    expect(t('Detached bungalow')).toBe('bungalow');
    expect(t('Maisonette')).toBe('flat');
    expect(t('Block of flats')).toBe('flat');
  });

  it('says unknown when the listing gave no type — never the seller type', () => {
    expect(propertyFromLead({}).propertyType).toBe('unknown');
    expect(propertyFromLead(null).propertyType).toBe('unknown');
    expect(
      propertyFromLead({ propertyData: { propertyType: 'probate' } })
        .propertyType
    ).toBe('unknown');
    expect(
      propertyFromLead({ propertyData: { propertyType: 'House' } }).propertyType
    ).toBe('unknown');
  });

  it('drops bedroom counts that are not a real count', () => {
    for (const bedrooms of [0, -1, 2.5, '3', null]) {
      expect(propertyFromLead({ propertyData: { bedrooms } }).bedrooms).toBe(
        null
      );
    }
  });
});

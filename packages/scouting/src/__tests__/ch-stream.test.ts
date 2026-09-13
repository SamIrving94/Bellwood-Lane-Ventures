import { describe, expect, it } from 'vitest';
import {
  companyNumberFromResourceUri,
  filterToDistricts,
  isPropertyCompany,
  leadTypeForInsolvencyCase,
  minePropertiesFromParticulars,
  parseChargeItem,
  parseStreamLine,
} from '../ch-stream';

describe('parseStreamLine', () => {
  const chargeLine = JSON.stringify({
    resource_kind: 'company-charges',
    resource_uri: '/company/12345678/charges/AbC123',
    resource_id: 'AbC123',
    data: {
      charge_code: '123456780001',
      particulars: { description: 'Land at 12 Elm Road, London SE13 5AB' },
      persons_entitled: [{ name: 'Big Lender Ltd' }],
      created_on: '2026-08-20',
      status: 'outstanding',
    },
    event: {
      timepoint: 4711,
      published_at: '2026-08-22T10:00:00',
      type: 'changed',
    },
  });

  it('parses a charge event with timepoint and company number', () => {
    const event = parseStreamLine(chargeLine);
    expect(event).not.toBeNull();
    expect(event?.companyNumber).toBe('12345678');
    expect(event?.timepoint).toBe(4711);
    expect(event?.resourceKind).toBe('company-charges');
    expect(event?.eventType).toBe('changed');
  });

  it('returns null for heartbeats and malformed lines', () => {
    expect(parseStreamLine('')).toBeNull();
    expect(parseStreamLine('   ')).toBeNull();
    expect(parseStreamLine('not json')).toBeNull();
    expect(parseStreamLine('42')).toBeNull();
  });

  it('returns null when the timepoint is missing — an event we cannot resume past is unusable', () => {
    expect(
      parseStreamLine(
        JSON.stringify({
          resource_uri: '/company/12345678/charges/x',
          event: { published_at: '2026-08-22T10:00:00' },
        })
      )
    ).toBeNull();
  });
});

describe('companyNumberFromResourceUri', () => {
  it('extracts and zero-pads from charge and insolvency URIs', () => {
    expect(companyNumberFromResourceUri('/company/1234567/charges/x')).toBe(
      '01234567'
    );
    expect(companyNumberFromResourceUri('/company/SC123456/insolvency')).toBe(
      'SC123456'
    );
  });

  it('returns null rather than guessing on unrecognised shapes', () => {
    expect(companyNumberFromResourceUri('/filing-history/xyz')).toBeNull();
    expect(companyNumberFromResourceUri('')).toBeNull();
  });
});

describe('isPropertyCompany', () => {
  it('matches the property SIC codes and nothing else', () => {
    expect(isPropertyCompany(['68100'])).toBe(true);
    expect(isPropertyCompany(['62012', '68209'])).toBe(true);
    expect(isPropertyCompany(['62012'])).toBe(false);
    expect(isPropertyCompany([])).toBe(false);
  });
});

describe('minePropertiesFromParticulars', () => {
  it('mines one property per postcode with the preceding address text', () => {
    const mined = minePropertiesFromParticulars(
      'Fixed charge over land at 12 Elm Road, London SE13 5AB; also 4 Oak Way, Leeds LS1 4AP',
      'Fallback Co Ltd'
    );
    expect(mined).toHaveLength(2);
    expect(mined[0].postcode).toBe('SE13 5AB');
    expect(mined[0].address).toContain('12 Elm Road');
    expect(mined[1].postcode).toBe('LS1 4AP');
  });

  it('falls back to the company name when no address text precedes the postcode', () => {
    const mined = minePropertiesFromParticulars('SE13 5AB', 'Fallback Co Ltd');
    expect(mined).toHaveLength(1);
    expect(mined[0].address).toBe('Fallback Co Ltd, SE13 5AB');
  });

  it('returns empty for particulars with no postcode — drop, never guess', () => {
    expect(
      minePropertiesFromParticulars('a floating charge over all assets', 'X')
    ).toHaveLength(0);
  });
});

describe('filterToDistricts', () => {
  const props = [
    { postcode: 'SE13 5AB', address: 'a' },
    { postcode: 'M14 5LL', address: 'b' },
    { postcode: 'LS1 4AP', address: 'c' },
  ];

  it('keeps only properties inside the founder districts', () => {
    const kept = filterToDistricts(props, new Set(['SE13', 'M14']));
    expect(kept.map((p) => p.postcode)).toEqual(['SE13 5AB', 'M14 5LL']);
  });

  it('keeps nothing when no districts are configured — firehose events need a patch to land in', () => {
    expect(filterToDistricts(props, new Set())).toHaveLength(0);
  });
});

describe('leadTypeForInsolvencyCase', () => {
  it('maps office-holder appointments to receivership', () => {
    expect(leadTypeForInsolvencyCase('receivership')).toBe('receivership');
    expect(leadTypeForInsolvencyCase('in-administration')).toBe('receivership');
    expect(leadTypeForInsolvencyCase('liquidation')).toBe('receivership');
  });

  it('maps everything else (and unknown) to distressed_sale', () => {
    expect(leadTypeForInsolvencyCase('voluntary-arrangement')).toBe(
      'distressed_sale'
    );
    expect(leadTypeForInsolvencyCase(null)).toBe('distressed_sale');
  });
});

describe('parseChargeItem', () => {
  it('extracts ref, particulars, lender and dates from a REST/stream charge object', () => {
    const item = parseChargeItem({
      charge_code: '123456780001',
      particulars: { description: 'Land at 1 High St, AB1 2CD' },
      persons_entitled: [{ name: 'Lender Plc' }],
      created_on: '2026-08-01',
      status: 'outstanding',
    });
    expect(item.chargeRef).toBe('123456780001');
    expect(item.particulars).toContain('High St');
    expect(item.lender).toBe('Lender Plc');
    expect(item.status).toBe('outstanding');
  });

  it('tolerates missing fields without fabricating values', () => {
    const item = parseChargeItem({});
    expect(item.chargeRef).toBe('');
    expect(item.particulars).toBeNull();
    expect(item.lender).toBeNull();
  });
});

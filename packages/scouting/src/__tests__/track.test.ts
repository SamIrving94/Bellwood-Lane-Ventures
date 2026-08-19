import { describe, expect, it } from 'vitest';
import {
  PRIME_MIN_VALUE_PENCE,
  assessPrimeOpportunity,
  classifyTrack,
  isBlockText,
  outwardCode,
  primeOpportunityForTrack,
} from '../track';

describe('classifyTrack', () => {
  it('classifies £700k+ values as prime', () => {
    expect(
      classifyTrack({ valuePence: PRIME_MIN_VALUE_PENCE, text: '12 Elm Road' })
    ).toBe('prime');
    expect(
      classifyTrack({ valuePence: 1_200_000_00, text: '4 Cheyne Walk, SW3' })
    ).toBe('prime');
  });

  it('classifies below-threshold values as volume', () => {
    expect(classifyTrack({ valuePence: 250_000_00, text: '9 Mill Lane' })).toBe(
      'volume'
    );
    expect(classifyTrack({ valuePence: null, text: '9 Mill Lane' })).toBe(
      'volume'
    );
  });

  it('block language wins over value', () => {
    expect(
      classifyTrack({
        valuePence: 300_000_00,
        text: 'Block of 6 flats, Lewisham High Street',
      })
    ).toBe('block');
    expect(
      classifyTrack({
        valuePence: 2_000_000_00,
        text: 'Freehold block with 8 self-contained flats',
      })
    ).toBe('block');
  });

  it('detects portfolio and whole-building language', () => {
    expect(isBlockText('Property portfolio of 4 houses')).toBe(true);
    expect(isBlockText('Entire building arranged as 3 maisonettes')).toBe(true);
    expect(isBlockText('6 x flats with vacant possession')).toBe(true);
    expect(isBlockText('Licensed HMO, 7 lettable rooms')).toBe(true);
  });

  it('does NOT flag a single flat or ordinary listings', () => {
    expect(isBlockText('Two bedroom flat, Flat 3, 12 Station Road')).toBe(
      false
    );
    expect(isBlockText('A well presented apartment close to the station')).toBe(
      false
    );
    expect(
      classifyTrack({ valuePence: 180_000_00, text: 'Flat 2, 1 High St' })
    ).toBe('volume');
  });
});

// ── Prime is geographic, and the street can stand in for a missing value ──
//
// These cover the two structural faults that made the prime track fire almost
// never: probate leads carry no value at all, and the £700k floor was
// calibrated for London while the scout only scanned the North.

describe('classifyTrack — geography', () => {
  it('promotes a high-value lead inside a prime London district', () => {
    expect(
      classifyTrack({
        valuePence: 900_000_00,
        postcode: 'SE22 8HP',
        text: '14 Melbourne Grove',
      })
    ).toBe('prime');
  });

  it('does NOT promote the same value outside a prime district', () => {
    // £900k in Stockport is an expensive volume lead. We have no refurb
    // thesis there and nobody to send to view it.
    expect(
      classifyTrack({
        valuePence: 900_000_00,
        postcode: 'SK7 2AB',
        text: '14 Bramhall Lane',
      })
    ).toBe('volume');
  });

  it('falls back to the value test when the postcode is unreadable', () => {
    // A false `volume` silently buries a £1M opportunity, so an unknown
    // location must never be the reason a lead is demoted.
    expect(
      classifyTrack({ valuePence: 900_000_00, postcode: 'not-a-postcode' })
    ).toBe('prime');
    expect(classifyTrack({ valuePence: 900_000_00, postcode: null })).toBe(
      'prime'
    );
  });
});

describe('classifyTrack — the street stands in for a missing value', () => {
  it('promotes a valueless probate lead in an expensive district', () => {
    // This is THE fix. gazette.ts hard-codes estateValuePence: null, so
    // before this every probate notice was structurally incapable of ever
    // being prime, however valuable the house.
    expect(
      classifyTrack({
        valuePence: null,
        postcode: 'N10 3SH',
        areaAvgPence: 1_400_000_00,
        text: '22 Fortis Green',
      })
    ).toBe('prime');
  });

  it('leaves a valueless lead as volume when the street is ordinary', () => {
    expect(
      classifyTrack({
        valuePence: null,
        postcode: 'SE15 4TT',
        areaAvgPence: 420_000_00,
      })
    ).toBe('volume');
  });

  it('never lets the street override a real value that is too low', () => {
    // A £300k flat on a £1.4M street is a flat, not a prime opportunity.
    expect(
      classifyTrack({
        valuePence: 300_000_00,
        postcode: 'N10 3SH',
        areaAvgPence: 1_400_000_00,
      })
    ).toBe('volume');
  });

  it('block language still wins over everything', () => {
    expect(
      classifyTrack({
        valuePence: null,
        postcode: 'N10 3SH',
        areaAvgPence: 1_400_000_00,
        text: 'Freehold block of 6 flats',
      })
    ).toBe('block');
  });
});

describe('outwardCode', () => {
  it('reads the shapes our sources actually emit', () => {
    expect(outwardCode('SW11 3AB')).toBe('SW11');
    expect(outwardCode('sw113ab')).toBe('SW11');
    expect(outwardCode('N1 9GU')).toBe('N1');
    expect(outwardCode('SE22')).toBe('SE22');
    expect(outwardCode('EC1A 1BB')).toBe('EC1A');
  });

  it('returns null rather than guessing', () => {
    expect(outwardCode('')).toBeNull();
    expect(outwardCode(null)).toBeNull();
    expect(outwardCode('not a postcode')).toBeNull();
  });
});

describe('assessPrimeOpportunity', () => {
  it('flags the thesis: below the street AND needing work', () => {
    const r = assessPrimeOpportunity({
      valuePence: 800_000_00,
      areaAvgPence: 1_100_000_00,
      listingType: 'unmodernised-properties',
    });
    expect(r.isOpportunity).toBe(true);
    expect(r.isRefurbCandidate).toBe(true);
    expect(Math.round((r.discountToArea ?? 0) * 100)).toBe(27);
  });

  it('does not call a discount an opportunity with no condition reason', () => {
    // Cheap with nothing fixable wrong is usually cheap for a reason we
    // cannot fix — a bad plot, a railway, a short lease.
    const r = assessPrimeOpportunity({
      valuePence: 800_000_00,
      areaAvgPence: 1_100_000_00,
      listingType: null,
    });
    expect(r.isOpportunity).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/no condition reason/i);
  });

  it('does not call an at-market refurb an opportunity', () => {
    const r = assessPrimeOpportunity({
      valuePence: 1_080_000_00,
      areaAvgPence: 1_100_000_00,
      listingType: 'unmodernised-properties',
    });
    expect(r.isOpportunity).toBe(false);
    expect(r.isRefurbCandidate).toBe(true);
  });

  it('reads condition from listing text when there is no badge', () => {
    const r = assessPrimeOpportunity({
      valuePence: 700_000_00,
      areaAvgPence: 1_000_000_00,
      text: 'A substantial Victorian terrace in need of full modernisation',
    });
    expect(r.isRefurbCandidate).toBe(true);
    expect(r.isOpportunity).toBe(true);
  });

  it('says so plainly when there is no comparable to measure against', () => {
    const r = assessPrimeOpportunity({
      valuePence: 800_000_00,
      areaAvgPence: null,
    });
    expect(r.discountToArea).toBeNull();
    expect(r.isOpportunity).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/not measurable/i);
  });
});

describe('primeOpportunityForTrack — who gets the thesis applied', () => {
  it('assesses every prime lead, and finds the opportunity when it is there', () => {
    const r = primeOpportunityForTrack({
      track: 'prime',
      postcode: 'SE22 9EL',
      valuePence: 800_000_00,
      areaAvgPence: 1_100_000_00,
      listingType: 'unmodernised-properties',
    });
    expect(r?.isOpportunity).toBe(true);
  });

  it('never assesses volume — a cheap flat on an expensive street is a flat', () => {
    expect(
      primeOpportunityForTrack({
        track: 'volume',
        postcode: 'N10 3SH',
        valuePence: 300_000_00,
        areaAvgPence: 1_400_000_00,
      })
    ).toBeNull();
  });

  it('assesses a block inside a prime district, not outside one', () => {
    const base = {
      track: 'block' as const,
      valuePence: 1_200_000_00,
      areaAvgPence: 1_600_000_00,
      listingType: 'unmodernised-properties',
    };
    expect(
      primeOpportunityForTrack({ ...base, postcode: 'E8 3DR' })
    ).not.toBeNull();
    expect(
      primeOpportunityForTrack({ ...base, postcode: 'SK7 2AB' })
    ).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { PRIME_MIN_VALUE_PENCE, classifyTrack, isBlockText } from '../track';

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
    expect(
      classifyTrack({ valuePence: 250_000_00, text: '9 Mill Lane' })
    ).toBe('volume');
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
    expect(classifyTrack({ valuePence: 180_000_00, text: 'Flat 2, 1 High St' })).toBe(
      'volume'
    );
  });
});

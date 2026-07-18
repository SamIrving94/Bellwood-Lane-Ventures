import { describe, expect, it } from 'vitest';
import { toPropertyDataType } from '../property-type';

describe('toPropertyDataType', () => {
  it('maps our internal bare values to PropertyData _house values', () => {
    expect(toPropertyDataType('detached')).toBe('detached_house');
    expect(toPropertyDataType('semi-detached')).toBe('semi-detached_house');
    expect(toPropertyDataType('terraced')).toBe('terraced_house');
    expect(toPropertyDataType('flat')).toBe('flat');
    expect(toPropertyDataType('bungalow')).toBe('detached_house');
  });

  it('checks semi before detached (semi-detached contains detached)', () => {
    expect(toPropertyDataType('Semi-Detached House')).toBe('semi-detached_house');
  });

  it('passes already-correct API values through unchanged', () => {
    expect(toPropertyDataType('detached_house')).toBe('detached_house');
    expect(toPropertyDataType('house')).toBe('house');
  });

  it('handles synonyms and empties', () => {
    expect(toPropertyDataType('apartment')).toBe('flat');
    expect(toPropertyDataType(null)).toBeUndefined();
    expect(toPropertyDataType(undefined)).toBeUndefined();
    expect(toPropertyDataType('')).toBeUndefined();
  });

  it('never returns an invalid filter value for unknown input', () => {
    expect(toPropertyDataType('maisonette')).toBe('house');
  });
});

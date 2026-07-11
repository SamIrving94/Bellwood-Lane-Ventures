import { describe, expect, it } from 'vitest';
import {
  addressMatchScore,
  classifyConfidence,
  extractPostcode,
  normaliseUkAddress,
} from '../address-normalise';

describe('extractPostcode', () => {
  it('pulls and normalises a spaced postcode', () => {
    expect(extractPostcode('5 Hewitt Avenue, Coventry, CV6 1NJ')).toBe('CV6 1NJ');
  });
  it('normalises a postcode with no space', () => {
    expect(extractPostcode('Sevenoaks Avenue, Stockport SK44AP')).toBe('SK4 4AP');
  });
  it('returns null when there is no postcode', () => {
    expect(extractPostcode('somewhere with no code')).toBeNull();
  });
});

describe('normaliseUkAddress', () => {
  it('splits house number, street and postcode', () => {
    const n = normaliseUkAddress('12 Sevenoaks Avenue, Stockport, SK4 4AP');
    expect(n.houseNumber).toBe('12');
    expect(n.street).toBe('sevenoaks avenue');
    expect(n.postcode).toBe('SK4 4AP');
  });
  it('canonicalises street-type abbreviations', () => {
    expect(normaliseUkAddress('5 Oak Rd, Leeds, LS1 1AA').street).toBe('oak road');
    expect(normaliseUkAddress('5 Oak Road, Leeds, LS1 1AA').street).toBe('oak road');
  });
  it('handles a house number with a letter suffix', () => {
    expect(normaliseUkAddress('12A High Street, BS1 2AB').houseNumber).toBe('12a');
  });
  it('copes with a street-only address (no number)', () => {
    const n = normaliseUkAddress('Cadogan Street, Manchester, M14 4NE');
    expect(n.houseNumber).toBeNull();
    expect(n.street).toBe('cadogan street');
    expect(n.postcode).toBe('M14 4NE');
  });
});

describe('addressMatchScore', () => {
  const subject = normaliseUkAddress('12 Sevenoaks Avenue, Stockport, SK4 4AP');

  it('scores an exact house+street+postcode match as confident', () => {
    const other = normaliseUkAddress('12 Sevenoaks Avenue, Stockport SK4 4AP');
    const s = addressMatchScore(subject, other);
    expect(s).toBeGreaterThanOrEqual(0.85);
    expect(classifyConfidence(s)).toBe('confident');
  });

  it('hard-gates a different postcode to zero', () => {
    const other = normaliseUkAddress('12 Sevenoaks Avenue, Stockport, SK5 7BH');
    expect(addressMatchScore(subject, other)).toBe(0);
  });

  it('treats same street but different house number as not-the-same', () => {
    const other = normaliseUkAddress('46 Sevenoaks Avenue, Stockport, SK4 4AP');
    const s = addressMatchScore(subject, other);
    expect(s).toBeLessThan(0.5);
    expect(classifyConfidence(s)).toBe('none');
  });

  it('gives a fuzzy score for same postcode + street when a house number is missing', () => {
    const streetOnly = normaliseUkAddress('Sevenoaks Avenue, Stockport, SK4 4AP');
    const s = addressMatchScore(streetOnly, subject);
    expect(classifyConfidence(s)).toBe('fuzzy');
  });
});

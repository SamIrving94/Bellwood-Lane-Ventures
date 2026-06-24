import {
  CRITICAL_LEASE_THRESHOLD_YEARS,
  type LeaseRecordInput,
  MARRIAGE_VALUE_THRESHOLD_YEARS,
  classifyLeaseDistress,
  computeRemainingLeaseYears,
  findShortLeases,
} from '@repo/property-data/src/registered-leases';
import { describe, expect, it } from 'vitest';

// The marriage-value line (80 years) is the load-bearing threshold for the
// whole short-lease sourcing play, so these tests lock the band boundaries and
// the remaining-term maths against drift.

const ASOF = new Date('2026-06-24T00:00:00Z');

describe('computeRemainingLeaseYears', () => {
  it('derives remaining years from term start + length', () => {
    // 125-year term from 2000 → expires 2125 → ~98–99 years left in 2026.
    const remaining = computeRemainingLeaseYears('2000-01-01', 125, ASOF);
    expect(remaining).toBeGreaterThanOrEqual(98);
    expect(remaining).toBeLessThanOrEqual(99);
  });

  it('clamps an expired lease to 0 rather than going negative', () => {
    expect(computeRemainingLeaseYears('1900-01-01', 99, ASOF)).toBe(0);
  });

  it('returns null on missing or unparseable inputs', () => {
    expect(computeRemainingLeaseYears(null, 99, ASOF)).toBeNull();
    expect(computeRemainingLeaseYears('2000-01-01', null, ASOF)).toBeNull();
    expect(computeRemainingLeaseYears('not-a-date', 99, ASOF)).toBeNull();
  });
});

describe('classifyLeaseDistress', () => {
  it('flags marriage value strictly below 80 years', () => {
    expect(classifyLeaseDistress(79).marriageValue).toBe(true);
    expect(
      classifyLeaseDistress(MARRIAGE_VALUE_THRESHOLD_YEARS).marriageValue
    ).toBe(false);
  });

  it('bands a critically short lease as cash-only / motivated', () => {
    const a = classifyLeaseDistress(CRITICAL_LEASE_THRESHOLD_YEARS - 1);
    expect(a.band).toBe('critical');
    expect(a.motivated).toBe(true);
    expect(a.marriageValue).toBe(true);
  });

  it('bands 60–70 as unmortgageable and 70–80 as marriage-value', () => {
    expect(classifyLeaseDistress(65).band).toBe('unmortgageable');
    expect(classifyLeaseDistress(75).band).toBe('marriage-value');
  });

  it('treats a lease at/above the ceiling as a non-signal', () => {
    const a = classifyLeaseDistress(120);
    expect(a.band).toBe('comfortable');
    expect(a.motivated).toBe(false);
    expect(a.urgency).toBe(0);
  });

  it('returns unknown (no signal) when term is missing', () => {
    const a = classifyLeaseDistress(null);
    expect(a.band).toBe('unknown');
    expect(a.motivated).toBe(false);
  });

  it('scales urgency higher as the lease gets shorter', () => {
    const longer = classifyLeaseDistress(79).urgency;
    const shorter = classifyLeaseDistress(55).urgency;
    expect(shorter).toBeGreaterThan(longer);
    expect(shorter).toBeLessThanOrEqual(1);
    expect(longer).toBeGreaterThanOrEqual(0);
  });
});

describe('findShortLeases', () => {
  const records: LeaseRecordInput[] = [
    {
      address: 'Flat 1, Long Court',
      tenure: 'leasehold',
      remainingLeaseYears: 130,
    },
    {
      address: 'Flat 2, Short Court',
      tenure: 'leasehold',
      remainingLeaseYears: 72,
    },
    {
      address: 'Flat 3, Critical Court',
      tenure: 'leasehold',
      remainingLeaseYears: 48,
    },
    {
      address: '4 Freehold Road',
      tenure: 'freehold',
      remainingLeaseYears: null,
    },
    {
      address: 'Flat 5, Unknown Court',
      tenure: 'leasehold',
      remainingLeaseYears: null,
    },
  ];

  it('keeps only motivated leasehold short leases', () => {
    const hits = findShortLeases(records, ASOF);
    const addresses = hits.map((h) => h.address);
    expect(addresses).toContain('Flat 2, Short Court');
    expect(addresses).toContain('Flat 3, Critical Court');
    // Long lease, freehold, and unknown-term are all excluded.
    expect(addresses).not.toContain('Flat 1, Long Court');
    expect(addresses).not.toContain('4 Freehold Road');
    expect(addresses).not.toContain('Flat 5, Unknown Court');
  });

  it('sorts the shortest (most urgent) lease first', () => {
    const hits = findShortLeases(records, ASOF);
    expect(hits[0]?.address).toBe('Flat 3, Critical Court');
  });

  it('derives the term from particulars when no precomputed years', () => {
    const hits = findShortLeases(
      [
        {
          address: 'Flat 6',
          tenure: 'leasehold',
          termStartISO: '1960-01-01',
          termYears: 99,
        },
      ],
      ASOF
    );
    // 1960 + 99 = 2059 → ~33 years left → critical.
    expect(hits).toHaveLength(1);
    expect(hits[0]?.band).toBe('critical');
  });
});

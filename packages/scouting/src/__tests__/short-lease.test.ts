import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchShortLeaseLeads } from '../short-lease';

// Mock the PropertyData tenure source so we test the lead-shaping logic
// without a live API. The source's only external dependency is
// getTenureByPostcode.
vi.mock('@repo/property-data/src/propertydata', () => ({
  getTenureByPostcode: vi.fn(),
}));

import { getTenureByPostcode } from '@repo/property-data/src/propertydata';

const mockTenure = getTenureByPostcode as unknown as ReturnType<typeof vi.fn>;
const ASOF = new Date('2026-06-24T00:00:00Z');

afterEach(() => {
  vi.clearAllMocks();
});

describe('fetchShortLeaseLeads', () => {
  it('shapes a short lease into a lease-expiry raw lead', async () => {
    mockTenure.mockResolvedValue([
      {
        address: 'Flat 5, Milton Court',
        tenure: 'leasehold',
        remainingLeaseYears: 74,
        groundRentPerYear: 250,
        serviceChargePerYear: 1800,
      },
    ]);

    const { leads, scanned } = await fetchShortLeaseLeads(
      [{ label: 'NW1', postcode: 'NW1 1AA' }],
      { asOf: ASOF }
    );

    expect(scanned).toBe(1);
    expect(leads).toHaveLength(1);
    const lead = leads[0]!;
    expect(lead.leadTypeHint).toBe('lease_expiry');
    expect(lead.grantType).toBe('unknown');
    expect(lead.source).toBe('short_lease_marriage_value');
    expect(lead.postcode).toBe('NW1 1AA');
    expect(lead.leaseSignal.remainingLeaseYears).toBe(74);
    expect(lead.leaseSignal.marriageValue).toBe(true);
    expect(lead.leaseSignal.groundRentPerYear).toBe(250);
    expect(lead.probateRef).toContain('lease-NW1');
  });

  it('excludes freeholds and long leases', async () => {
    mockTenure.mockResolvedValue([
      {
        address: '1 Freehold Way',
        tenure: 'freehold',
        remainingLeaseYears: null,
      },
      { address: 'Flat 2', tenure: 'leasehold', remainingLeaseYears: 140 },
      { address: 'Flat 3', tenure: 'leasehold', remainingLeaseYears: 62 },
    ]);

    const { leads } = await fetchShortLeaseLeads([{ postcode: 'E1 6AN' }], {
      asOf: ASOF,
    });

    expect(leads.map((l) => l.address)).toEqual(['Flat 3']);
  });

  it('tags a watch-band lease (80–85y) without the marriage-value source', async () => {
    mockTenure.mockResolvedValue([
      { address: 'Flat 9', tenure: 'leasehold', remainingLeaseYears: 83 },
    ]);

    const { leads } = await fetchShortLeaseLeads([{ postcode: 'M1 1AE' }], {
      asOf: ASOF,
    });

    expect(leads[0]?.source).toBe('short_lease_watch');
    expect(leads[0]?.leaseSignal.marriageValue).toBe(false);
  });

  it('tolerates a per-postcode failure and surfaces the first error', async () => {
    mockTenure.mockRejectedValueOnce(new Error('rate limited'));
    mockTenure.mockResolvedValueOnce([
      { address: 'Flat 7', tenure: 'leasehold', remainingLeaseYears: 55 },
    ]);

    const { leads, error, scanned } = await fetchShortLeaseLeads(
      [{ postcode: 'BAD 1' }, { postcode: 'OK1 1AA' }],
      { asOf: ASOF }
    );

    expect(scanned).toBe(2);
    expect(error).toContain('rate limited');
    // The second postcode still produced its lead.
    expect(leads.map((l) => l.address)).toEqual(['Flat 7']);
  });

  it('returns nothing when there are no leasehold hits', async () => {
    mockTenure.mockResolvedValue([
      {
        address: '1 Freehold Way',
        tenure: 'freehold',
        remainingLeaseYears: null,
      },
    ]);
    const { leads, error } = await fetchShortLeaseLeads(
      [{ postcode: 'SW1 1AA' }],
      {
        asOf: ASOF,
      }
    );
    expect(leads).toHaveLength(0);
    expect(error).toBeUndefined();
  });
});

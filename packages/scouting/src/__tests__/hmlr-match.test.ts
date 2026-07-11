import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the HMLR address-record fetch so the matcher is deterministic + offline.
vi.mock('@repo/property-data/src/hmlr', () => ({
  getPricePaidWithAddresses: vi.fn(),
}));

const { getPricePaidWithAddresses } = await import('@repo/property-data/src/hmlr');
const { matchProbateAddressToSale, _clearHmlrMatchCache } = await import(
  '../hmlr-match'
);

beforeEach(() => {
  vi.clearAllMocks();
  _clearHmlrMatchCache();
});

describe('matchProbateAddressToSale', () => {
  it('pins the exact house and returns its most recent sale in pence', async () => {
    vi.mocked(getPricePaidWithAddresses).mockResolvedValue([
      { price: 250_000, date: '2018-06-01', address: '12, Sevenoaks Avenue, Stockport', postcode: 'SK4 4AP', propertyType: 'detached' },
      { price: 420_000, date: '2023-03-15', address: '12, Sevenoaks Avenue, Stockport', postcode: 'SK4 4AP', propertyType: 'detached' },
      { price: 300_000, date: '2022-01-10', address: '46, Sevenoaks Avenue, Stockport', postcode: 'SK4 4AP', propertyType: 'detached' },
    ]);

    const m = await matchProbateAddressToSale({
      address: '12 Sevenoaks Avenue, Stockport',
      postcode: 'SK4 4AP',
    });

    expect(m.confidence).toBe('confident');
    expect(m.lastSalePricePence).toBe(420_000_00); // most recent of the two #12 sales
    expect(m.lastSaleDate).toBe('2023-03-15');
    expect(m.matchedAddress).toContain('12');
    expect(m.candidatesConsidered).toBe(3);
  });

  it('returns confidence none (no fabricated sale) when nothing matches', async () => {
    vi.mocked(getPricePaidWithAddresses).mockResolvedValue([
      { price: 300_000, date: '2022-01-10', address: '9, Other Road, Stockport', postcode: 'SK4 4AP', propertyType: 'terraced' },
    ]);

    const m = await matchProbateAddressToSale({
      address: '12 Sevenoaks Avenue, Stockport',
      postcode: 'SK4 4AP',
    });

    expect(m.confidence).toBe('none');
    expect(m.lastSalePricePence).toBeNull();
    expect(m.matchedAddress).toBeNull();
  });

  it('returns none when HMLR has no records (real-data-or-nothing)', async () => {
    vi.mocked(getPricePaidWithAddresses).mockResolvedValue([]);
    const m = await matchProbateAddressToSale({
      address: '12 Sevenoaks Avenue',
      postcode: 'SK4 4AP',
    });
    expect(m.confidence).toBe('none');
    expect(m.lastSalePricePence).toBeNull();
  });

  it('caches HMLR per postcode across leads in the same run', async () => {
    vi.mocked(getPricePaidWithAddresses).mockResolvedValue([
      { price: 420_000, date: '2023-03-15', address: '12, Sevenoaks Avenue, Stockport', postcode: 'SK4 4AP', propertyType: 'detached' },
    ]);
    await matchProbateAddressToSale({ address: '12 Sevenoaks Avenue', postcode: 'SK4 4AP' });
    await matchProbateAddressToSale({ address: '12 Sevenoaks Avenue', postcode: 'SK4 4AP' });
    expect(vi.mocked(getPricePaidWithAddresses)).toHaveBeenCalledTimes(1);
  });
});

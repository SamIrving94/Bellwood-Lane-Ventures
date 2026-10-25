import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../epc', () => ({
  searchDomesticEpc: vi.fn(),
  getEpcCertificateByNumber: vi.fn(),
}));

const { searchDomesticEpc, getEpcCertificateByNumber } = await import('../epc');
const { getEpcCompFloorAreas, MAX_EPC_COMP_LOOKUPS } = await import(
  '../epc-comp-sizes'
);

const row = (certificateNumber: string, address: string, registrationDate: string) => ({
  certificateNumber,
  address,
  postcode: 'SE13 5RN',
  band: null,
  registrationDate,
  uprn: null,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getEpcCompFloorAreas — every comp sized from the free register', () => {
  it('sizes a comp from its own newest certificate, grouped by postcode', async () => {
    vi.mocked(searchDomesticEpc).mockResolvedValue([
      row('old', '18c, Manor Park, LONDON, SE13 5RN', '2015-01-01'),
      row('new', '18c, Manor Park, LONDON, SE13 5RN', '2021-06-01'),
      row('neighbour', '18b, Manor Park, LONDON, SE13 5RN', '2022-01-01'),
    ]);
    vi.mocked(getEpcCertificateByNumber).mockResolvedValue({ floorAreaSqm: 62 } as never);

    const out = await getEpcCompFloorAreas([
      { address: '18c, Manor Park, SE13 5RN', postcode: 'SE13 5RN', distanceMiles: 0.3 },
    ]);

    expect(getEpcCertificateByNumber).toHaveBeenCalledTimes(1);
    expect(getEpcCertificateByNumber).toHaveBeenCalledWith('new', 'SE13 5RN');
    expect(out.get('SE135RN')).toEqual([
      { address: '18c, Manor Park, LONDON, SE13 5RN', floorAreaSqm: 62, certificateNumber: 'new' },
    ]);
  });

  it('never takes a neighbour: 12 is not 12A, Flat 1 is not Flat 2', async () => {
    vi.mocked(searchDomesticEpc).mockResolvedValue([
      row('a', '12A, Manor Park, LONDON, SE13 5RN', '2021-01-01'),
      row('b', 'Flat 2, 40 Manor Park, LONDON, SE13 5RN', '2021-01-01'),
    ]);
    const out = await getEpcCompFloorAreas([
      { address: '12, Manor Park, SE13 5RN', postcode: 'SE13 5RN' },
      { address: 'Flat 1, 40, Manor Park, SE13 5RN', postcode: 'SE13 5RN' },
    ]);
    expect(getEpcCertificateByNumber).not.toHaveBeenCalled();
    expect(out.size).toBe(0);
  });

  it('a failed search or certificate is "no size", never a throw', async () => {
    vi.mocked(searchDomesticEpc).mockRejectedValue(new Error('EPC down'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const out = await getEpcCompFloorAreas([
      { address: '18c, Manor Park, SE13 5RN', postcode: 'SE13 5RN' },
    ]);
    expect(out.size).toBe(0);
  });

  it('looks up at most MAX_EPC_COMP_LOOKUPS comps, nearest first', async () => {
    vi.mocked(searchDomesticEpc).mockResolvedValue([]);
    const comps = Array.from({ length: MAX_EPC_COMP_LOOKUPS + 10 }, (_, i) => ({
      address: `${i + 1}, Manor Park`,
      postcode: `SE13 ${i}AA`,
      distanceMiles: (MAX_EPC_COMP_LOOKUPS + 10 - i) / 100,
    }));
    await getEpcCompFloorAreas(comps);
    expect(searchDomesticEpc).toHaveBeenCalledTimes(MAX_EPC_COMP_LOOKUPS);
    // The farthest (first in the input) were the ones dropped.
    expect(searchDomesticEpc).not.toHaveBeenCalledWith('SE13 0AA');
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getEpcData } from '../epc';

// These tests exercise the fallback path (no live network). The key invariant:
// when EPC data is unavailable we must NOT fabricate a rating / floor area,
// because getEpcData feeds the AVM (base-valuation.ts) and a fake floor area
// would drive the £/sqft number on a binding offer.

describe('getEpcData fallback', () => {
  const prevEmail = process.env.EPC_API_EMAIL;
  const prevKey = process.env.EPC_API_KEY;
  const prevSynthetic = process.env.EPC_ALLOW_SYNTHETIC;

  beforeEach(() => {
    // No credentials → forces the fallback path.
    process.env.EPC_API_EMAIL = '';
    process.env.EPC_API_KEY = '';
  });

  afterEach(() => {
    process.env.EPC_API_EMAIL = prevEmail;
    process.env.EPC_API_KEY = prevKey;
    if (prevSynthetic === undefined) delete process.env.EPC_ALLOW_SYNTHETIC;
    else process.env.EPC_ALLOW_SYNTHETIC = prevSynthetic;
  });

  it('returns an "unavailable" reading with no fabricated data by default', async () => {
    delete process.env.EPC_ALLOW_SYNTHETIC;
    const epc = await getEpcData('SW1A 2AA');

    expect(epc.source).toBe('unavailable');
    expect(epc.postcode).toBe('SW1A 2AA');
    // Nothing fabricated — these would otherwise corrupt the AVM.
    expect(epc.epcRating).toBeNull();
    expect(epc.epcScore).toBeNull();
    expect(epc.floorAreaSqm).toBeNull();
    expect(epc.totalBedrooms).toBeNull();
    expect(epc.constructionAgeBand).toBeNull();
  });

  it('does not fabricate even when EPC_ALLOW_SYNTHETIC is unset/false', async () => {
    process.env.EPC_ALLOW_SYNTHETIC = 'false';
    const epc = await getEpcData('M1 1AE');
    expect(epc.source).toBe('unavailable');
    expect(epc.floorAreaSqm).toBeNull();
  });

  it('returns populated synthetic data only when explicitly opted in (dev)', async () => {
    process.env.EPC_ALLOW_SYNTHETIC = 'true';
    const epc = await getEpcData('M1 1AE');

    expect(epc.source).toBe('synthetic');
    expect(epc.epcRating).not.toBeNull();
    expect(epc.floorAreaSqm).not.toBeNull();
  });
});

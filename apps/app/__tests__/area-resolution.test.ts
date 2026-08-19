/**
 * The tests that would have caught the SW3 incident.
 *
 * SW3 was typed into Settings → Scouting; the resolver didn't know it,
 * fabricated "SW3 1AA" (not a real postcode), saved the area, and the
 * founder learned about it days later from a truncated 422. The contract
 * under test now: resolve dynamically, or fail loudly — never guess.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const geocodePostcode = vi.fn();
const seedPostcodeForOutcode = vi.fn();

vi.mock('@repo/property-data/src/postcodes-io', () => ({
  geocodePostcode: (...a: unknown[]) => geocodePostcode(...a),
  seedPostcodeForOutcode: (...a: unknown[]) => seedPostcodeForOutcode(...a),
}));

import { outwardCode } from '@repo/scouting/src/track';
import {
  DISTRICT_SAMPLES,
  TOWN_SAMPLES,
  resolveArea,
} from '../app/(authenticated)/settings/scouting/area-resolution';

beforeEach(() => {
  geocodePostcode.mockReset();
  seedPostcodeForOutcode.mockReset();
});

describe('resolveArea — the SW3 regression', () => {
  it('resolves an UNMAPPED district dynamically, and the seed is never "<DISTRICT> 1AA"', async () => {
    // PL4 (Plymouth) is deliberately not in DISTRICT_SAMPLES.
    expect(DISTRICT_SAMPLES.PL4).toBeUndefined();
    seedPostcodeForOutcode.mockResolvedValue({
      outcome: 'found',
      postcode: 'PL4 8HH',
    });

    const r = await resolveArea('PL4');
    expect(r).toEqual({
      ok: true,
      label: 'PL4',
      seedPostcode: 'PL4 8HH',
      district: 'PL4',
      radiusMiles: 1.5,
    });
  });

  it('rejects a well-formed district that does not exist (ZZ99), naming the input', async () => {
    seedPostcodeForOutcode.mockResolvedValue({ outcome: 'not-found' });
    const r = await resolveArea('ZZ99');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('ZZ99');
  });

  it('says "try again" when postcodes.io is down — and never guesses', async () => {
    seedPostcodeForOutcode.mockResolvedValue({ outcome: 'unavailable' });
    const r = await resolveArea('SW2');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.toLowerCase()).toContain('try again');
      expect(r.error).not.toContain('1AA');
    }
  });

  it('falls through to dynamic resolution when a TABLE seed is invalid', async () => {
    // Self-healing: a stale curated row must not poison the area.
    const district = Object.keys(DISTRICT_SAMPLES)[0] as string;
    geocodePostcode.mockResolvedValue(null); // table seed fails validation
    seedPostcodeForOutcode.mockResolvedValue({
      outcome: 'found',
      postcode: `${district} 9XX`,
    });

    const r = await resolveArea(district);
    expect(r).toMatchObject({ ok: true, seedPostcode: `${district} 9XX` });
    expect(seedPostcodeForOutcode).toHaveBeenCalledWith(district);
  });

  it('rejects a well-formed FAKE full postcode (the "SW3 1AA" class)', async () => {
    geocodePostcode.mockResolvedValue(null);
    const r = await resolveArea('SW3 1AA');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('SW3 1AA');
  });

  it('accepts a real full postcode at radius 1', async () => {
    geocodePostcode.mockResolvedValue({ latitude: 51.5, longitude: -0.16 });
    const r = await resolveArea('sw3 3th');
    expect(r).toEqual({
      ok: true,
      label: 'SW3 3TH',
      seedPostcode: 'SW3 3TH',
      district: 'SW3',
      radiusMiles: 1,
    });
  });
});

describe('table hygiene', () => {
  it('every DISTRICT_SAMPLES key matches its seed postcode’s own district', () => {
    for (const [district, seed] of Object.entries(DISTRICT_SAMPLES)) {
      expect(outwardCode(seed), `${district}: ${seed}`).toBe(district);
    }
  });

  it('every TOWN_SAMPLES value is a well-formed full postcode', () => {
    for (const [town, seed] of Object.entries(TOWN_SAMPLES)) {
      expect(outwardCode(seed), `${town}: ${seed}`).not.toBeNull();
      expect(seed, `${town}: ${seed}`).toMatch(
        /^[A-Z]{1,2}\d{1,2}[A-Z]? \d[A-Z]{2}$/
      );
    }
  });
});

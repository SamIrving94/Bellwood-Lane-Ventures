/**
 * The cron's truth-keeping. The regression these tests guard: the old
 * rotation stamp merged only `checkedAt` into lastProbe, so a stale error
 * survived forever under an ever-fresh timestamp, and a recovered area kept
 * displaying a failure the cron disproved every single morning.
 */
import { describe, expect, it } from 'vitest';
import { mergeAreaProbes } from '../app/cron/_lib/merge-area-probes';

const NOW = '2026-08-20T07:00:00.000Z';

function area(over: Record<string, unknown> = {}) {
  return {
    id: 'area_SW3_1',
    label: 'SW3',
    seedPostcode: 'SW3 3TH',
    district: 'SW3',
    radiusMiles: 1.5,
    lastProbe: null,
    history: [],
    ...over,
  };
}

describe('mergeAreaProbes', () => {
  it('CLEARS a stale error when the run succeeds — the core regression', () => {
    const stale = area({
      lastProbe: {
        listingCount: 0,
        checkedAt: '2026-08-01T07:00:00.000Z',
        error:
          '[propertydata /sourced-properties] lookup unavailable: HTTP 422',
      },
    });
    const [out] = mergeAreaProbes(
      [stale],
      ['area_SW3_1'],
      [{ label: 'SW3', postcode: 'SW3 3TH', listingCount: 7, error: null }],
      NOW
    );
    expect(out?.lastProbe).toEqual({
      listingCount: 7,
      checkedAt: NOW,
      error: null,
    });
    expect(out?.history).toEqual([{ date: '2026-08-20', count: 7 }]);
  });

  it('writes the error when the run fails', () => {
    const [out] = mergeAreaProbes(
      [area()],
      ['area_SW3_1'],
      [
        {
          label: 'SW3',
          postcode: 'SW3 3TH',
          listingCount: 0,
          error: 'HTTP 422 from /sourced-properties',
        },
      ],
      NOW
    );
    expect(out?.lastProbe).toEqual({
      listingCount: 0,
      checkedAt: NOW,
      error: 'HTTP 422 from /sourced-properties',
    });
  });

  it('leaves unscanned areas untouched', () => {
    const untouched = area({ id: 'area_M20_1', seedPostcode: 'M20 6AB' });
    const [out] = mergeAreaProbes([untouched], ['area_SW3_1'], [], NOW);
    expect(out).toEqual(untouched);
  });

  it('matches outcomes by postcode regardless of spacing/case', () => {
    const [out] = mergeAreaProbes(
      [area()],
      ['area_SW3_1'],
      [{ label: 'SW3', postcode: 'sw33th', listingCount: 3, error: null }],
      NOW
    );
    expect(out?.lastProbe).toMatchObject({ listingCount: 3, error: null });
  });

  it('falls back to a checkedAt-only stamp when a scanned area has no outcome', () => {
    // Rotation must advance, but we learned nothing — never invent a result.
    const stale = area({
      lastProbe: {
        listingCount: 4,
        checkedAt: '2026-08-01T07:00:00.000Z',
        error: 'old error',
      },
    });
    const [out] = mergeAreaProbes([stale], ['area_SW3_1'], [], NOW);
    expect(out?.lastProbe).toEqual({
      listingCount: 4,
      checkedAt: NOW,
      error: 'old error',
    });
  });

  it('replaces same-day history rather than duplicating it, capped at 30', () => {
    const hist = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-07-${String(i + 1).padStart(2, '0')}`,
      count: i,
    }));
    hist.push({ date: '2026-08-20', count: 1 });
    const [out] = mergeAreaProbes(
      [area({ history: hist })],
      ['area_SW3_1'],
      [{ label: 'SW3', postcode: 'SW3 3TH', listingCount: 9, error: null }],
      NOW
    );
    const h = out?.history as Array<{ date: string; count: number }>;
    expect(h.length).toBeLessThanOrEqual(30);
    expect(h.filter((x) => x.date === '2026-08-20')).toEqual([
      { date: '2026-08-20', count: 9 },
    ]);
  });
});

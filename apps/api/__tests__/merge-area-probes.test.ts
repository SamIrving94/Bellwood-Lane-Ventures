/**
 * The cron's truth-keeping. The regression these tests guard: the old
 * rotation stamp merged only `checkedAt` into lastProbe, so a stale error
 * survived forever under an ever-fresh timestamp, and a recovered area kept
 * displaying a failure the cron disproved every single morning.
 */
import { describe, expect, it } from 'vitest';
import {
  lastScannedAtMs,
  mergeAreaProbes,
} from '../app/cron/_lib/merge-area-probes';

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

  it('stamps lastScannedAt on every scanned area, with or without an outcome', () => {
    const [withOutcome, withoutOutcome, untouched] = mergeAreaProbes(
      [
        area(),
        area({ id: 'area_M20_1', seedPostcode: 'M20 6AB' }),
        area({ id: 'area_LS17_1', seedPostcode: 'LS17 6BU' }),
      ],
      ['area_SW3_1', 'area_M20_1'],
      [{ label: 'SW3', postcode: 'SW3 3TH', listingCount: 2, error: null }],
      NOW
    );
    expect(withOutcome?.lastScannedAt).toBe(NOW);
    expect(withoutOutcome?.lastScannedAt).toBe(NOW);
    expect(untouched).not.toHaveProperty('lastScannedAt');
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

/**
 * The rotation's sort key. The regression: a freshly added area carries an
 * add-time lastProbe.checkedAt, and sorting on THAT put it at the back of
 * the 6-a-day rotation — the founder added a patch, clicked "Run scout
 * now", and the run skipped it.
 */
describe('lastScannedAtMs', () => {
  it('reads the cron stamp', () => {
    expect(lastScannedAtMs({ lastScannedAt: NOW })).toBe(Date.parse(NOW));
  });

  it('is 0 when missing or unparseable — never-scanned sorts first', () => {
    expect(lastScannedAtMs({})).toBe(0);
    expect(lastScannedAtMs({ lastScannedAt: 'yesterday-ish' })).toBe(0);
    expect(lastScannedAtMs({ lastScannedAt: 42 })).toBe(0);
  });

  it('ignores the add-time validation probe: a new area beats a scanned one', () => {
    const scannedYesterday = area({
      id: 'area_M20_1',
      lastScannedAt: '2026-08-19T07:00:00.000Z',
      lastProbe: {
        listingCount: 5,
        checkedAt: '2026-08-19T07:00:00.000Z',
        error: null,
      },
    });
    const justAdded = area({
      id: 'area_E18_1',
      // The dashboard probed it a minute ago — that is NOT a scan.
      lastProbe: { listingCount: 3, checkedAt: NOW, error: null },
    });
    const queue = [scannedYesterday, justAdded].sort(
      (a, b) => lastScannedAtMs(a) - lastScannedAtMs(b)
    );
    expect(queue.map((a) => a.id)).toEqual(['area_E18_1', 'area_M20_1']);
  });
});

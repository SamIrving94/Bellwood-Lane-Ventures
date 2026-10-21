import type { PpdAddressRecord } from '@repo/property-data/src/hmlr';
import { describe, expect, test } from 'vitest';
import {
  MATCH_WINDOW_MONTHS,
  MIN_SAMPLE_FOR_HEADLINE,
  type MatchedRow,
  buildBacktestActionCopy,
  floorAreaSourceOf,
  pickOutcomeSale,
  priceBand,
  summariseMatched,
} from '../app/cron/_lib/avm-backtest';

const snapshot = {
  id: 'snap_1',
  address: '12 Acacia Road, East Dulwich',
  postcode: 'SE22 8AB',
  appraisedAt: new Date('2026-03-01T08:00:00Z'),
};

const sale = (over: Partial<PpdAddressRecord>): PpdAddressRecord => ({
  price: 800_000,
  date: '2026-07-14',
  address: '12 Acacia Road, London',
  postcode: 'SE22 8AB',
  propertyType: 'terraced',
  ...over,
});

const NOW = new Date('2026-09-12T06:00:00Z');

describe('pickOutcomeSale', () => {
  test('matches the same house sold after the appraisal', () => {
    const out = pickOutcomeSale(snapshot, [sale({})], NOW);
    expect(out.status).toBe('matched');
    if (out.status === 'matched') {
      expect(out.sale.price).toBe(800_000);
      expect(out.score).toBeGreaterThanOrEqual(0.85);
    }
  });

  test('a sale BEFORE the appraisal is history, not an outcome', () => {
    const out = pickOutcomeSale(snapshot, [sale({ date: '2026-02-20' })], NOW);
    expect(out.status).toBe('pending');
  });

  test('the neighbour at 12A never pairs with 12', () => {
    const out = pickOutcomeSale(
      snapshot,
      [sale({ address: '12A Acacia Road, London' })],
      NOW
    );
    expect(out.status).toBe('pending');
    if (out.status === 'pending') {
      expect(out.bestScore).toBeLessThan(0.85);
    }
  });

  test('a flat inside the house is a different property', () => {
    const out = pickOutcomeSale(
      snapshot,
      [sale({ address: 'Flat 2, 12 Acacia Road, London' })],
      NOW
    );
    expect(out.status).toBe('pending');
  });

  test('the EARLIEST sale after the appraisal wins over a later resale', () => {
    const out = pickOutcomeSale(
      snapshot,
      [
        sale({ date: '2027-01-10', price: 900_000 }),
        sale({ date: '2026-06-02', price: 790_000 }),
      ],
      NOW
    );
    expect(out.status).toBe('matched');
    if (out.status === 'matched') {
      expect(out.sale.price).toBe(790_000);
    }
  });

  test('a zero-price record is ignored', () => {
    const out = pickOutcomeSale(snapshot, [sale({ price: 0 })], NOW);
    expect(out.status).toBe('pending');
  });

  test('an unsold row is written off once the window closes', () => {
    const old = {
      ...snapshot,
      appraisedAt: new Date(
        NOW.getTime() - (MATCH_WINDOW_MONTHS + 1) * 30.5 * 24 * 60 * 60 * 1000
      ),
    };
    expect(pickOutcomeSale(old, [], NOW).status).toBe('expired');
    // ...but a row that DID sell inside the window still matches.
    expect(
      pickOutcomeSale(old, [sale({ date: '2026-01-05' })], NOW).status
    ).toBe('matched');
  });
});

describe('priceBand', () => {
  test('bands on pounds, not pence', () => {
    expect(priceBand(249_999_00)).toBe('under_250k');
    expect(priceBand(250_000_00)).toBe('250k_500k');
    expect(priceBand(999_999_00)).toBe('500k_1m');
    expect(priceBand(1_000_000_00)).toBe('over_1m');
  });
});

const row = (over: Partial<MatchedRow>): MatchedRow => ({
  pointEstimatePence: 100_000_00,
  lowPence: 95_000_00,
  highPence: 105_000_00,
  soldPricePence: 100_000_00,
  confidenceLevel: 'high',
  source: 'scout_lead',
  propertyType: 'terraced',
  csaSource: 'distance',
  engineVersion: 'abc1234',
  floorAreaSource: 'propertydata',
  ...over,
});

describe('summariseMatched', () => {
  test('segments the cohort every way the founder reads it', () => {
    const s = summariseMatched([
      row({}),
      row({
        confidenceLevel: 'low',
        soldPricePence: 120_000_00,
        source: 'quote',
      }),
    ]);
    expect(s.n).toBe(2);
    expect(s.overall.n).toBe(2);
    expect(s.byConfidence.high.n).toBe(1);
    expect(s.byConfidence.low.medianApe).toBeCloseTo(1 / 6, 3);
    expect(s.bySource.quote.n).toBe(1);
    expect(s.byPriceBand.under_250k.n).toBe(2);
    expect(s.byEngineVersion.abc1234.n).toBe(2);
    expect(s.byFloorAreaSource.propertydata.n).toBe(2);
  });

  test('splits the cohort by where the floor area came from', () => {
    const s = summariseMatched([
      row({ floorAreaSource: 'epc_uprn' }),
      row({ floorAreaSource: 'epc_uprn', soldPricePence: 125_000_00 }),
      row({ floorAreaSource: 'propertydata', soldPricePence: 80_000_00 }),
      row({ floorAreaSource: 'caller' }),
      row({ floorAreaSource: 'none' }),
      row({ floorAreaSource: 'unknown' }),
    ]);
    expect(Object.keys(s.byFloorAreaSource).sort()).toEqual([
      'caller',
      'epc_uprn',
      'none',
      'propertydata',
      'unknown',
    ]);
    expect(s.byFloorAreaSource.epc_uprn.n).toBe(2);
    // Each segment is scored on its own rows only.
    expect(s.byFloorAreaSource.epc_uprn.medianApe).toBeCloseTo(0.1, 3);
    expect(s.byFloorAreaSource.propertydata.medianApe).toBeCloseTo(0.25, 3);
    expect(s.byFloorAreaSource.caller.medianApe).toBe(0);
  });
});

describe('floorAreaSourceOf', () => {
  test('passes through the three sources the engine records', () => {
    expect(floorAreaSourceOf({ floorAreaSource: 'epc_uprn' })).toBe('epc_uprn');
    expect(floorAreaSourceOf({ floorAreaSource: 'propertydata' })).toBe(
      'propertydata'
    );
    expect(floorAreaSourceOf({ floorAreaSource: 'caller' })).toBe('caller');
  });

  test('null means the engine had no verified size', () => {
    expect(floorAreaSourceOf({ floorAreaSource: null })).toBe('none');
  });

  test('a missing or unexpected field is unknown, not none', () => {
    expect(floorAreaSourceOf({})).toBe('unknown');
    expect(floorAreaSourceOf({ floorAreaSource: 'epc' })).toBe('unknown');
    expect(floorAreaSourceOf(null)).toBe('unknown');
    expect(floorAreaSourceOf('epc_uprn')).toBe('unknown');
  });
});

describe('buildBacktestActionCopy', () => {
  test('below the sample floor it refuses to give a verdict', () => {
    const copy = buildBacktestActionCopy({
      summary: summariseMatched([row({})]),
      pending: 40,
      excluded: 2,
      expired: 0,
      monthLabel: '2026-09',
    });
    expect(copy.priority).toBe('low');
    expect(copy.title).toContain('too few to read yet');
    expect(copy.description).toContain(`${MIN_SAMPLE_FOR_HEADLINE}+`);
  });

  test('with a readable sample it names the median error and the bias direction', () => {
    const rows = Array.from({ length: MIN_SAMPLE_FOR_HEADLINE }, () =>
      row({ pointEstimatePence: 110_000_00 })
    );
    const copy = buildBacktestActionCopy({
      summary: summariseMatched(rows),
      pending: 0,
      excluded: 0,
      expired: 0,
      monthLabel: '2026-09',
    });
    expect(copy.priority).toBe('medium');
    expect(copy.title).toContain('median error 10.0%');
    expect(copy.description).toContain('OVER-values');
  });
});

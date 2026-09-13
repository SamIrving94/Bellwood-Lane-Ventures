import { describe, expect, it } from 'vitest';
import {
  buildAvmSnapshot,
  csaSourceFromLabel,
  saveAvmSnapshot,
} from '../backtest-snapshot';
import type { AvmInput, AvmResultPayload } from '../index';

const input: AvmInput = {
  postcode: 'se22 8ab',
  propertyType: 'terraced',
  address: ' 12 Acacia Road ',
  bedrooms: 3,
  sellerType: 'probate',
  offerConfig: { sellerTypeMargin: { probate: 0.2 } } as never,
};

const result = {
  postcode: 'SE22 8AB',
  propertyType: 'terraced',
  riskScore: 4,
  expiresAt: new Date('2026-10-01'),
  resultJson: {
    avmPointEstimate: 812_345.67,
    avmLow: 788_000,
    avmHigh: 836_000,
    finalOffer: 650_000,
    confidenceLevel: 'medium',
    comparableCount: 5,
    avmSources: 'propertydata_sold_distance(3@0.25mi/2@0.5mi)+hpi+sqft(2)',
  },
} as unknown as AvmResultPayload;

describe('csaSourceFromLabel', () => {
  it('maps the engine label to the coarse comps path', () => {
    expect(
      csaSourceFromLabel('propertydata_sold_distance(3@0.25mi/2@0.5mi)')
    ).toBe('distance');
    expect(csaSourceFromLabel('hmlr_ppd+hpi')).toBe('hmlr');
    expect(csaSourceFromLabel('synthetic')).toBe('synthetic');
    expect(csaSourceFromLabel(null)).toBe('synthetic');
  });
});

describe('buildAvmSnapshot', () => {
  it('freezes the estimate in pence with a clean identity', () => {
    const row = buildAvmSnapshot({
      input,
      result,
      source: 'scout_lead',
      sourceId: 'lead_1',
      evalConfigVersion: 3,
      engineVersion: 'abc1234',
    });
    expect(row.postcode).toBe('SE22 8AB');
    expect(row.address).toBe('12 Acacia Road');
    expect(row.pointEstimatePence).toBe(81_234_567);
    expect(row.lowPence).toBe(78_800_000);
    expect(row.highPence).toBe(83_600_000);
    expect(row.offerPence).toBe(65_000_000);
    expect(row.confidenceLevel).toBe('medium');
    expect(row.comparableCount).toBe(5);
    expect(row.csaSource).toBe('distance');
    expect(row.engineVersion).toBe('abc1234');
    expect(row.evalConfigVersion).toBe(3);
    expect(row.sellerType).toBe('probate');
  });

  it('drops the bulky offer config from the frozen input (version identifies it)', () => {
    const row = buildAvmSnapshot({ input, result, source: 'deal' });
    expect(row.inputJson).not.toHaveProperty('offerConfig');
    expect(row.inputJson).toMatchObject({ postcode: 'se22 8ab', bedrooms: 3 });
  });
});

describe('saveAvmSnapshot', () => {
  it('writes through the client it is handed', async () => {
    const writes: unknown[] = [];
    const db = {
      avmSnapshot: {
        create: async (args: { data: unknown }) => {
          writes.push(args.data);
          return {};
        },
      },
    };
    const ok = await saveAvmSnapshot(db, { input, result, source: 'quote' });
    expect(ok).toBe(true);
    expect(writes).toHaveLength(1);
  });

  it('never throws — a failed write is logged and swallowed', async () => {
    const db = {
      avmSnapshot: {
        create: async () => {
          throw new Error('db down');
        },
      },
    };
    await expect(
      saveAvmSnapshot(db, { input, result, source: 'quote' })
    ).resolves.toBe(false);
  });

  it('skips a result with no point estimate — nothing to judge later', async () => {
    let called = false;
    const db = {
      avmSnapshot: {
        create: async () => {
          called = true;
          return {};
        },
      },
    };
    const empty = {
      ...result,
      resultJson: { ...result.resultJson, avmPointEstimate: 0 },
    } as AvmResultPayload;
    expect(
      await saveAvmSnapshot(db, { input, result: empty, source: 'batch' })
    ).toBe(false);
    expect(called).toBe(false);
  });
});

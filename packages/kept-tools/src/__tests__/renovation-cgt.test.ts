import { describe, expect, it } from 'vitest';
import { estimateInheritedHomeCgt } from '../cgt';
import { formatPounds } from '../money';
import { estimateRenovation } from '../renovation';

describe('estimateRenovation', () => {
  it('prices three bands over the floor area using the shared tables', () => {
    const r = estimateRenovation({ floorAreaSqm: 80 });
    expect(r.assumedFloorArea).toBe(false);
    expect(r.bands.map((b) => [b.key, b.totalPence])).toEqual([
      ['light', 24_000_00], // £300/m² × 80
      ['full', 44_000_00], // £550/m² × 80
      ['heavy', 104_000_00], // £1,300/m² × 80
    ]);
  });

  it('flags an assumed floor area', () => {
    const r = estimateRenovation({});
    expect(r.assumedFloorArea).toBe(true);
    expect(r.floorAreaSqm).toBe(75);
    expect(r.notes.join(' ')).toMatch(/assumed/);
  });

  it('adds known issues, without double-counting fittings in the heavy band', () => {
    const r = estimateRenovation({
      floorAreaSqm: 80,
      knownIssues: ['no_kitchen', 'roof_damage'],
    });
    const full = r.bands.find((b) => b.key === 'full');
    const heavy = r.bands.find((b) => b.key === 'heavy');
    expect(full?.totalPence).toBe(44_000_00 + 8_000_00 + 12_000_00);
    expect(heavy?.totalPence).toBe(104_000_00 + 12_000_00);
  });

  it('ignores issue keys it does not know', () => {
    const r = estimateRenovation({
      floorAreaSqm: 80,
      knownIssues: ['squatting_signs' as never],
    });
    expect(r.issueLines).toEqual([]);
  });
});

describe('estimateInheritedHomeCgt', () => {
  it('is zero when the sale does not beat probate value after costs', () => {
    const r = estimateInheritedHomeCgt({
      salePricePence: 250_000_00,
      probateValuePence: 250_000_00,
      sellingCostsPence: 4_000_00,
      seller: 'executors',
    });
    expect(r.taxPence).toBe(0);
    expect(r.gainPence).toBe(0);
  });

  it('uses 18% for a basic-rate beneficiary and 24% otherwise', () => {
    const base = {
      salePricePence: 260_000_00,
      probateValuePence: 250_000_00,
      sellingCostsPence: 0,
    };
    expect(
      estimateInheritedHomeCgt({
        ...base,
        seller: 'beneficiary',
        beneficiaryRateBand: 'basic',
      }).taxPence
    ).toBe(1_260_00); // (10,000 - 3,000) × 18%
    expect(
      estimateInheritedHomeCgt({ ...base, seller: 'beneficiary' }).taxPence
    ).toBe(1_680_00);
    expect(
      estimateInheritedHomeCgt({
        ...base,
        seller: 'executors',
        annualExemptAvailable: false,
      }).taxPence
    ).toBe(2_400_00);
  });
});

describe('formatPounds', () => {
  it('formats pence as whole pounds', () => {
    expect(formatPounds(1_234_567_89)).toBe('£1,234,568');
    expect(formatPounds(-50_00)).toBe('-£50');
  });
});

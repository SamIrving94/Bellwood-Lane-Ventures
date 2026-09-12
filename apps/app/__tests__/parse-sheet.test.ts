import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  MAX_PENCE,
  moneyCellToPence,
  parseMoneyToPence,
  parseSheet,
} from '../lib/batch/parse-sheet';

function sheetBuffer(rows: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pipeline');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('parseMoneyToPence', () => {
  it('parses pounds in the common cell shapes to integer pence', () => {
    expect(parseMoneyToPence('£225,000')).toBe(22_500_000);
    expect(parseMoneyToPence('225000.0')).toBe(22_500_000);
    expect(parseMoneyToPence(225_000)).toBe(22_500_000);
  });

  it('returns null for empty, zero, negative or non-numeric cells', () => {
    expect(parseMoneyToPence('')).toBeNull();
    expect(parseMoneyToPence(null)).toBeNull();
    expect(parseMoneyToPence(0)).toBeNull();
    expect(parseMoneyToPence(-5)).toBeNull();
    expect(parseMoneyToPence('tbc')).toBeNull();
  });

  it('drops a figure that would overflow the Postgres integer column', () => {
    // The 11 Sep 2026 upload: a cell of 110,000,000 → 11,000,000,000 pence,
    // which Postgres rejected and which killed the whole createMany.
    expect(parseMoneyToPence(110_000_000)).toBeNull();
    expect(moneyCellToPence(110_000_000)).toEqual({
      pence: null,
      outOfRange: true,
    });
    // Just inside the limit still parses.
    expect(moneyCellToPence(Math.floor(MAX_PENCE / 100)).outOfRange).toBe(
      false
    );
  });
});

describe('parseSheet', () => {
  it('keeps the row, blanks the bad cell and reports it by sheet row number', () => {
    const buf = sheetBuffer([
      [
        'Opportunity Name',
        'Property Type',
        'Underwriting Entry: Acceptable Trade Offer Level',
      ],
      ['1, HIGH STREET, LEEDS, LS1 1AA - Purchase', 'House', 150_000],
      ['2, HIGH STREET, LEEDS, LS1 1AB - Purchase', 'House', 110_000_000],
    ]);
    const parsed = parseSheet(buf);

    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.acceptableTradeOfferPence).toBe(15_000_000);
    expect(parsed.rows[1]?.acceptableTradeOfferPence).toBeNull();
    expect(parsed.rows[1]?.postcode).toBe('LS1 1AB');

    expect(parsed.warnings).toHaveLength(1);
    // Header is row 1, so the second data row is sheet row 3.
    expect(parsed.warnings[0]).toMatch(/^Row 3 /);
    expect(parsed.warnings[0]).toContain('Acceptable Trade Offer');
    expect(parsed.warnings[0]).toContain('110000000');
  });

  it('reports no warnings for a clean sheet', () => {
    const buf = sheetBuffer([
      ['Opportunity Name', 'Sign off sale price'],
      ['3, HIGH STREET, LEEDS, LS1 1AC - Purchase', '£95,000'],
    ]);
    const parsed = parseSheet(buf);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.rows[0]?.signOffPricePence).toBe(9_500_000);
  });
});

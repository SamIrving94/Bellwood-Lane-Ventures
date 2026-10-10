// The pack page's pure helpers live in apps/web, which has no test runner;
// they run here so CI covers them.
import { describe, expect, it } from 'vitest';
import {
  dealNumbers,
  isPreviewToken,
  packState,
  sdltAdditionalProperty,
} from '../../web/lib/investor-pack';

describe('packState', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  it('a live pack is open until its close date, then closed', () => {
    const closesAt = new Date('2026-10-24T12:00:00Z');
    expect(packState({ status: 'live', closesAt }, now)).toBe('open');
    expect(
      packState({ status: 'live', closesAt }, new Date('2026-10-24T12:00:01Z'))
    ).toBe('closed');
  });
  it('maps the other statuses', () => {
    expect(packState({ status: 'draft', closesAt: null }, now)).toBe('preview');
    expect(packState({ status: 'closed', closesAt: null }, now)).toBe('closed');
    expect(packState({ status: 'withdrawn', closesAt: null }, now)).toBe(
      'withdrawn'
    );
  });
});

describe('isPreviewToken', () => {
  it('only the email-less founder preview link counts', () => {
    expect(isPreviewToken({ label: 'Founder preview', email: null })).toBe(
      true
    );
    expect(isPreviewToken({ label: 'Founder preview', email: 'a@b.co' })).toBe(
      false
    );
    expect(isPreviewToken({ label: 'Acme', email: null })).toBe(false);
  });
});

describe('sdltAdditionalProperty (England, from 1 April 2025)', () => {
  it('charges 5% on the nil band and the higher rates above it', () => {
    // 125k * 5% + 125k * 7% + 50k * 10% = 6,250 + 8,750 + 5,000
    expect(sdltAdditionalProperty(300_000)).toBe(20_000);
  });
  it('charges nothing under £40,000', () => {
    expect(sdltAdditionalProperty(39_999)).toBe(0);
  });
  it('applies the higher rate to the whole price from £40,000', () => {
    expect(sdltAdditionalProperty(100_000)).toBe(5_000);
  });
  it('reaches the 15% and 17% bands', () => {
    // 6,250 + 8,750 + 67,500 + 86,250 + 85,000
    expect(sdltAdditionalProperty(2_000_000)).toBe(253_750);
  });
});

describe('dealNumbers', () => {
  it('totals cash in and derives yield and uplift', () => {
    const r = dealNumbers({
      price: 185_000,
      refurb: 25_000,
      legal: 2_000,
      monthlyRent: 1_200,
      valueAfterWorks: 260_000,
    });
    // SDLT: 6,250 + 60k * 7% = 10,450
    expect(r.sdlt).toBe(10_450);
    expect(r.totalIn).toBe(222_450);
    expect(r.grossYield).toBeCloseTo((14_400 / 222_450) * 100, 5);
    expect(r.uplift).toBe(37_550);
  });
  it('leaves yield and uplift empty without rent or value', () => {
    const r = dealNumbers({
      price: 100_000,
      refurb: 0,
      legal: 0,
      monthlyRent: null,
      valueAfterWorks: null,
    });
    expect(r.grossYield).toBeNull();
    expect(r.uplift).toBeNull();
    expect(r.returnOnCash).toBeNull();
  });
});

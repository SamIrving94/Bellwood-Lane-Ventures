/**
 * Guide-price parsing — Auction House UK adapter.
 *
 * Auction House UK is the only live auction source, so every lot in the
 * pipeline flows through this grammar. A "£150k" lot that parses as £150 does
 * not just look wrong: apps/api/app/agents/auctions/route.ts treats anything
 * under £100k as a strong match, so a mis-parse manufactures fake bargains.
 *
 * Money note: parseGuideText returns integer PENCE.
 */

import { describe, expect, it } from 'vitest';
import { parseGuideText } from '../sources/auction-house';

const POUNDS = 100;

describe('parseGuideText', () => {
  it('applies the k suffix', () => {
    expect(parseGuideText('Guide £150k+')).toEqual({
      minPence: 150_000 * POUNDS,
      maxPence: 150_000 * POUNDS,
    });
  });

  it('applies the k suffix to a fractional figure', () => {
    expect(parseGuideText('Guide £1.5k')).toEqual({
      minPence: 1_500 * POUNDS,
      maxPence: 1_500 * POUNDS,
    });
  });

  it('applies the m suffix', () => {
    expect(parseGuideText('Guide Price £1.25m')).toEqual({
      minPence: 1_250_000 * POUNDS,
      maxPence: 1_250_000 * POUNDS,
    });
  });

  it('reads a fully written figure without a suffix', () => {
    expect(parseGuideText('Guide £150,000')).toEqual({
      minPence: 150_000 * POUNDS,
      maxPence: 150_000 * POUNDS,
    });
  });

  it('reads a plain two-figure amount literally', () => {
    expect(parseGuideText('£95')).toEqual({
      minPence: 95 * POUNDS,
      maxPence: 95 * POUNDS,
    });
  });

  it('is case-insensitive on the suffix', () => {
    expect(parseGuideText('Guide Price £95K')).toEqual({
      minPence: 95_000 * POUNDS,
      maxPence: 95_000 * POUNDS,
    });
  });

  it('applies the suffix to BOTH sides of a range', () => {
    expect(parseGuideText('Guide £150k - £180k')).toEqual({
      minPence: 150_000 * POUNDS,
      maxPence: 180_000 * POUNDS,
    });
  });

  it('borrows the low suffix when only the low side carries one', () => {
    expect(parseGuideText('Guide £150k to £180')).toEqual({
      minPence: 150_000 * POUNDS,
      maxPence: 180_000 * POUNDS,
    });
  });

  it('handles a full-figure range', () => {
    expect(parseGuideText('Guide Price £95,000 to £110,000')).toEqual({
      minPence: 95_000 * POUNDS,
      maxPence: 110_000 * POUNDS,
    });
  });

  it('does not borrow a following word as a multiplier', () => {
    // "modernisation" must not lend its "m" to the figure.
    expect(parseGuideText('Guide £150,000 modernisation required')).toEqual({
      minPence: 150_000 * POUNDS,
      maxPence: 150_000 * POUNDS,
    });
  });

  it('returns nulls when there is no figure at all', () => {
    expect(parseGuideText('Guide price on application')).toEqual({
      minPence: null,
      maxPence: null,
    });
  });
});

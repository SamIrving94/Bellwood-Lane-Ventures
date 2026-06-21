/**
 * Percentage discount of the underwriting benchmark against our estimated
 * market value.
 *
 *   discount% = (EMV - benchmark) / EMV * 100
 *
 * A higher number means we'd be buying further below market — i.e. a better
 * deal — so the pipeline is ranked by this descending.
 *
 * Benchmark selection (per the founder's rule):
 *   1. "Underwriting Entry: Acceptable Trade Offer" if present and > 0
 *   2. else "Underwriting Entry: Sign off sale price" if present and > 0
 *   3. else none → discount is left blank and the row is flagged
 *
 * All money args are in pounds (or all in pence — must be consistent). The
 * result is a percentage rounded to one decimal place.
 */

export type BenchmarkUsed = 'trade_offer' | 'sign_off' | 'none';

export interface DiscountResult {
  discountPercent: number | null;
  benchmarkUsed: BenchmarkUsed;
  benchmark: number | null;
}

function positive(n?: number | null): number | null {
  return typeof n === 'number' && n > 0 ? n : null;
}

export function computeDiscount(
  estimatedMarketValue: number | null | undefined,
  tradeOffer?: number | null,
  signOffPrice?: number | null,
): DiscountResult {
  const trade = positive(tradeOffer);
  const signOff = positive(signOffPrice);
  const benchmark = trade ?? signOff;
  const benchmarkUsed: BenchmarkUsed = trade
    ? 'trade_offer'
    : signOff
      ? 'sign_off'
      : 'none';

  if (!estimatedMarketValue || estimatedMarketValue <= 0 || benchmark == null) {
    return { discountPercent: null, benchmarkUsed, benchmark: benchmark ?? null };
  }

  const pct =
    Math.round(((estimatedMarketValue - benchmark) / estimatedMarketValue) * 1000) / 10;
  return { discountPercent: pct, benchmarkUsed, benchmark };
}

/**
 * Pure helpers for the investor pack page and its interest endpoint.
 * No database, no React: unit-tested in __tests__/investor-pack.test.ts.
 */

export type PackStatus = 'draft' | 'live' | 'closed' | 'withdrawn';

/**
 * What an investor can do with a pack right now. The two-week window closes
 * itself: a live pack past `closesAt` reads as closed without a cron.
 */
export type PackState = 'preview' | 'open' | 'closed' | 'withdrawn';

export function packState(
  pack: { status: PackStatus; closesAt: Date | null },
  now: Date = new Date()
): PackState {
  if (pack.status === 'withdrawn') return 'withdrawn';
  if (pack.status === 'draft') return 'preview';
  if (pack.status === 'closed') return 'closed';
  if (pack.closesAt && pack.closesAt.getTime() <= now.getTime()) {
    return 'closed';
  }
  return 'open';
}

/** The founder's own preview link: no email, fixed label. */
export const PREVIEW_TOKEN_LABEL = 'Founder preview';

export function isPreviewToken(t: { label: string; email: string | null }) {
  return t.label === PREVIEW_TOKEN_LABEL && t.email === null;
}

/**
 * Stamp Duty Land Tax for an individual buying an ADDITIONAL residential
 * property in England, rates from 1 April 2025, including the 5% higher
 * rate for additional dwellings (from 31 Oct 2024). Returns pounds.
 *
 * An estimate for the pack's calculator only. It ignores company purchases
 * and the non-resident surcharge, and the page says to check with an
 * adviser. Verified against gov.uk higher-rates guidance, 10 Oct 2026.
 */
export const SDLT_RATES_LABEL = 'England, rates from 1 April 2025';

const SDLT_BANDS: Array<{ upTo: number; rate: number }> = [
  { upTo: 125_000, rate: 0 },
  { upTo: 250_000, rate: 0.02 },
  { upTo: 925_000, rate: 0.05 },
  { upTo: 1_500_000, rate: 0.1 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.12 },
];
const ADDITIONAL_DWELLING_SURCHARGE = 0.05;

export function sdltAdditionalProperty(price: number): number {
  // Below £40,000 the higher rates do not apply, and the standard nil band
  // covers the whole price.
  if (price < 40_000) return 0;
  let tax = 0;
  let lower = 0;
  for (const band of SDLT_BANDS) {
    if (price <= lower) break;
    const slice = Math.min(price, band.upTo) - lower;
    tax += slice * (band.rate + ADDITIONAL_DWELLING_SURCHARGE);
    lower = band.upTo;
  }
  return Math.round(tax);
}

export type DealNumbersInput = {
  price: number;
  refurb: number;
  legal: number;
  monthlyRent: number | null;
  valueAfterWorks: number | null;
};

export type DealNumbers = {
  sdlt: number;
  totalIn: number;
  /** Annual rent / total cash in, as a percentage. */
  grossYield: number | null;
  /** Value after works minus total cash in. */
  uplift: number | null;
  /** Uplift as a percentage of total cash in. */
  returnOnCash: number | null;
};

export function dealNumbers(i: DealNumbersInput): DealNumbers {
  const sdlt = sdltAdditionalProperty(i.price);
  const totalIn = i.price + Math.max(0, i.refurb) + Math.max(0, i.legal) + sdlt;
  const grossYield =
    i.monthlyRent && totalIn > 0
      ? ((i.monthlyRent * 12) / totalIn) * 100
      : null;
  const uplift = i.valueAfterWorks ? i.valueAfterWorks - totalIn : null;
  const returnOnCash =
    uplift !== null && totalIn > 0 ? (uplift / totalIn) * 100 : null;
  return { sdlt, totalIn, grossYield, uplift, returnOnCash };
}

export function gbp(pounds: number): string {
  return `£${Math.round(pounds).toLocaleString('en-GB')}`;
}

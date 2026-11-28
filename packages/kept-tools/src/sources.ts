/**
 * Every public fact the plugin tools state, with where it came from and when
 * it was last checked. Verify-before-asserting (docs/brand/KEPT.md § Voice):
 * a figure the tools show either comes from the user, from open data, or
 * from this file — never from memory.
 *
 * Re-check each `checked` date when tax years roll over (6 April) and when
 * the live site copy changes (CLAUDE.md "Public promises").
 */

export interface Source {
  /** Short, plain-English description of the fact. */
  label: string;
  url: string;
  /** ISO date the fact was last checked against the source. */
  checked: string;
}

// Re-checked 28 Nov 2026, after the Autumn Budget (28 Oct 2026), from search
// results of the cited pages: gov.uk can't be fetched from the build sandbox.
// Notes and what changed: docs/mcp/08-review-2026-11.md.
const CHECKED = '2026-11-28';

/**
 * The fall-through rate exactly as the live /sell page states it
 * (apps/web/app/sell/page.tsx, footnote 1: TwentyCi, 2025). The site moved
 * from "1 in 3" to "1 in 4" on 18 Oct 2026 (#143) and the plugin kept the old
 * figure, so it lives here once. The live site wins: change it with the page.
 */
export const FALL_THROUGH_SHARE = '1 in 4';

export const SOURCES = {
  agentFee: {
    label: 'Typical estate agent fee: 1–1.5% plus VAT',
    url: 'https://wearekept.co.uk/sell',
    checked: CHECKED,
  },
  agentTime: {
    label: 'A typical open-market sale takes 4–6 months to complete',
    url: 'https://wearekept.co.uk/sell',
    checked: CHECKED,
  },
  fallThrough: {
    label: `Around ${FALL_THROUGH_SHARE} agreed sales collapse before completion (TwentyCi, 2025)`,
    url: 'https://wearekept.co.uk/sell',
    checked: CHECKED,
  },
  keptCompletion: {
    label:
      'Kept is a cash buyer and can complete in as little as two weeks, once it has viewed the home and confirmed an offer in writing',
    url: 'https://wearekept.co.uk/chain-break',
    checked: CHECKED,
  },
  auctionFees: {
    label:
      'Auction seller commission is usually 2% to 4% of the sale price plus VAT, plus an entry fee',
    url: 'https://www.cliveemson.co.uk/selling-a-property-at-auction/',
    checked: CHECKED,
  },
  vat: {
    label: 'Standard rate of VAT: 20%',
    url: 'https://www.gov.uk/vat-rates',
    checked: CHECKED,
  },
  cgtRates: {
    label:
      'CGT on residential property: 18% (basic rate) or 24% (higher rate) for individuals; 24% for personal representatives',
    url: 'https://www.gov.uk/government/publications/death-personal-representatives-and-legatees-hs282-self-assessment-helpsheet/hs282-death-personal-representatives-and-legatees-2026',
    checked: CHECKED,
  },
  cgtAllowance: {
    label:
      'CGT annual exempt amount 2026–27: £3,000 for individuals and personal representatives (executors get it in the tax year of death and the 2 years after)',
    url: 'https://www.gov.uk/guidance/capital-gains-tax-rates-and-allowances',
    checked: CHECKED,
  },
  cgtBaseCost: {
    label:
      'For an inherited home, the base cost for CGT is its value at the date of death (the probate value)',
    url: 'https://www.gov.uk/tax-sell-property/work-out-your-gain',
    checked: CHECKED,
  },
  cgt60Days: {
    label:
      'Report and pay any CGT on a UK home within 60 days of completing the sale',
    url: 'https://www.gov.uk/report-and-pay-your-capital-gains-tax/if-you-sold-a-property-in-the-uk-on-or-after-6-april-2020',
    checked: CHECKED,
  },
  ihtDue: {
    label:
      'Inheritance Tax is due by the end of the sixth month after the death; interest is charged after that',
    url: 'https://www.gov.uk/paying-inheritance-tax',
    checked: CHECKED,
  },
  registerDeath: {
    label:
      "In England and Wales, register a death within 5 days of the medical examiner's office confirming you can, unless a coroner is involved. Weekends and bank holidays count",
    url: 'https://www.gov.uk/register-a-death',
    checked: CHECKED,
  },
  councilTaxProbate: {
    label:
      'Council tax (England): an empty home is exempt until probate is granted, then for up to 6 more months if still empty and not sold or transferred; no long-term empty premium for 12 months from the grant',
    url: 'https://www.gov.uk/government/publications/long-term-empty-homes-and-second-homes-council-tax-premiums-and-exceptions/guidance-on-the-implementation-of-the-council-tax-premiums-on-long-term-empty-homes-and-second-homes',
    checked: CHECKED,
  },
  emptyInsurance: {
    label:
      'Standard home insurance often stops covering a home that has been empty for 30 to 60 days',
    url: 'https://wearekept.co.uk/probate',
    checked: CHECKED,
  },
  saleBeforeGrant: {
    label:
      'You can agree a sale before probate is granted, but you cannot complete until it is',
    url: 'https://wearekept.co.uk/probate',
    checked: CHECKED,
  },
  refurbTables: {
    label:
      "Kept's own rule-of-thumb refurbishment costs per m² (budget bands, not quotes)",
    url: 'https://wearekept.co.uk',
    checked: CHECKED,
  },
  landRegistry: {
    label:
      'Contains HM Land Registry data © Crown copyright and database right. Licensed under the Open Government Licence v3.0',
    url: 'https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads',
    checked: CHECKED,
  },
  epcRegister: {
    label: 'Energy Performance Certificate register (GOV.UK)',
    url: 'https://www.gov.uk/find-energy-certificate',
    checked: CHECKED,
  },
} as const satisfies Record<string, Source>;

export type SourceKey = keyof typeof SOURCES;

/** UK VAT, as a fraction. */
export const VAT_RATE = 0.2;
/** CGT annual exempt amount, 2026–27, in pence. */
export const CGT_ANNUAL_EXEMPT_PENCE = 3000_00;
export const CGT_RATE_BASIC = 0.18;
export const CGT_RATE_HIGHER = 0.24;
export const CGT_RATE_PERSONAL_REPRESENTATIVES = 0.24;

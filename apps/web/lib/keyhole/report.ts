/**
 * Keyhole report builder (docs/prds/keyhole-v1-2026-08.md, Phase 0).
 *
 * Assembles the one-page condition-and-value report a professional sees:
 * EPC condition facts, the street's recorded sales, and typical
 * refurbishment cost bands for the floor area. Open data only (EPC register,
 * HM Land Registry Price Paid) — nothing here touches PropertyData, whose
 * licence covers our internal use, not third-party display.
 *
 * TWO RULES, load-bearing:
 *
 * 1. **Never a valuation.** The report shows what the register recorded and
 *    what work typically costs. It never prices THIS property, on screen or
 *    in the stored snapshot — that is the founder's no-figure rule, and it
 *    is also what keeps the tool neutral enough for a solicitor or RICS
 *    surveyor to use without a conflict. The condition-adjusted value band
 *    in the PRD ships only once the measured district arbitrage model
 *    (scripts/arbitrage-rank.mts) gives it evidence to stand on.
 * 2. **Real data or nothing.** Sales come from getPricePaidWithAddresses
 *    (never synthetic); EPC comes back `unavailable` rather than invented.
 *    A section with no data says so — "no record found" is a feature.
 *
 * Needs EPC_API_TOKEN on the web deployment for the EPC section; without it
 * the report still renders with sales + refurb bands and an honest
 * "register not available" note.
 */

import 'server-only';

import {
  type Epc,
  type PpdAddressRecord,
  getEpcData,
  getPricePaidWithAddresses,
} from '@repo/property-data';
import { estimateRefurb } from '@repo/valuation/src/refurb';

// ---------------------------------------------------------------------------
// Report shape (stored verbatim in KeyholeReport.reportJson)
// ---------------------------------------------------------------------------

export interface KeyholeStreetSale {
  address: string;
  /** ISO YYYY-MM-DD. */
  date: string;
  pricePounds: number;
  propertyType: string;
  /** True when the sale's house number/name matches the entered address. */
  sameAddress: boolean;
}

export interface KeyholeRefurbBand {
  label: string;
  /** Whole pounds, rounded — a budget band, not a quote. */
  totalPounds: number;
}

export interface KeyholeReportData {
  version: 1;
  generatedAt: string;
  addressLine: string;
  postcode: string;
  epc: {
    available: boolean;
    rating: string | null;
    score: number | null;
    propertyType: string | null;
    floorAreaSqm: number | null;
    constructionAgeBand: string | null;
    heatingType: string | null;
    inspectionDate: string | null;
  };
  /** Recorded sales in this postcode, newest first. Real HMLR rows only. */
  streetSales: KeyholeStreetSale[];
  /** Simple context over the rows above. Null when fewer than 3 sales. */
  streetContext: {
    saleCount: number;
    medianPricePounds: number;
    earliest: string;
    latest: string;
  } | null;
  refurb: {
    floorAreaSqm: number;
    /** True when the EPC gave no floor area and a default was assumed. */
    assumedFloorArea: boolean;
    bands: KeyholeRefurbBand[];
  };
}

// ---------------------------------------------------------------------------
// Address highlighting (strict, same philosophy as the arbitrage matcher:
// a wrong "this property" row misleads an executor, so precision wins)
// ---------------------------------------------------------------------------

const NON_ALNUM = /[^A-Z0-9 ]+/g;
const SPACES = /\s+/g;

function normalise(text: string): string {
  return text.toUpperCase().replace(NON_ALNUM, ' ').replace(SPACES, ' ').trim();
}

/** Leading house-number token ("12", "12A") of an address line, or null. */
function houseNumberToken(addressLine: string): string | null {
  const m = normalise(addressLine).match(/^(\d+[A-Z]?)\b/);
  return m?.[1] ?? null;
}

export function isSameAddress(
  enteredAddressLine: string,
  saleAddress: string
): boolean {
  const token = houseNumberToken(enteredAddressLine);
  const sale = normalise(saleAddress);
  if (token) {
    return new RegExp(`(?:^|\\s)${token}(?:\\s|$)`).test(sale);
  }
  // Name-only address: require the full entered line inside the sale row.
  const entered = normalise(enteredAddressLine);
  return entered.length >= 4 && sale.includes(entered);
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (sorted.length % 2 === 0 && lower !== undefined && upper !== undefined) {
    return (lower + upper) / 2;
  }
  return upper ?? null;
}

/** The three budget bands, from the same tables the internal deal model uses. */
function refurbBands(floorAreaSqm: number | null): {
  floorAreaSqm: number;
  assumedFloorArea: boolean;
  bands: KeyholeRefurbBand[];
} {
  const levels: Array<{ condition: string; label: string }> = [
    { condition: 'fair', label: 'Light cosmetic' },
    { condition: 'tired', label: 'Full refurbishment' },
    { condition: 'derelict', label: 'Heavy or structural' },
  ];
  const bands = levels.map(({ condition, label }) => {
    const est = estimateRefurb({ condition, floorAreaSqm });
    return { label, totalPounds: Math.round(est.totalPence / 100) };
  });
  const probe = estimateRefurb({ condition: 'fair', floorAreaSqm });
  return {
    floorAreaSqm: probe.floorAreaSqm,
    assumedFloorArea: probe.assumedFloorArea,
    bands,
  };
}

export async function buildKeyholeReport(input: {
  addressLine: string;
  postcode: string;
}): Promise<KeyholeReportData> {
  const addressLine = input.addressLine.trim();
  const postcode = input.postcode.toUpperCase().trim();

  const [epc, sales] = await Promise.all([
    getEpcData(postcode, addressLine),
    getPricePaidWithAddresses(postcode, 100),
  ]);

  const streetSales: KeyholeStreetSale[] = sales
    .filter((s: PpdAddressRecord) => s.price > 0 && s.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12)
    .map((s) => ({
      address: s.address,
      date: s.date,
      pricePounds: s.price,
      propertyType: s.propertyType,
      sameAddress: isSameAddress(addressLine, s.address),
    }));

  const prices = streetSales.map((s) => s.pricePounds);
  const med = median(prices);
  const streetContext =
    streetSales.length >= 3 && med !== null
      ? {
          saleCount: streetSales.length,
          medianPricePounds: Math.round(med),
          earliest: streetSales[streetSales.length - 1]?.date ?? '',
          latest: streetSales[0]?.date ?? '',
        }
      : null;

  const epcData: Epc = epc;
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    addressLine,
    postcode,
    epc: {
      available: epcData.source !== 'unavailable',
      rating: epcData.epcRating,
      score: epcData.epcScore,
      propertyType: epcData.propertyType,
      floorAreaSqm: epcData.floorAreaSqm,
      constructionAgeBand: epcData.constructionAgeBand,
      heatingType: epcData.heatingType,
      inspectionDate: epcData.inspectionDate,
    },
    streetSales,
    streetContext,
    refurb: refurbBands(epcData.floorAreaSqm),
  };
}

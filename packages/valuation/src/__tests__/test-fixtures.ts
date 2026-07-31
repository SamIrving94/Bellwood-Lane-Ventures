/**
 * Shared fixtures for AVM golden tests.
 *
 * Three property scenarios designed to exercise the offer-engine edges:
 *   1. Normal terraced (M14) — healthy comps, standard seller, no risk flags
 *   2. Chain-break + EPC F  — seller-type discount, EPC penalty
 *   3. Probate, no comps    — fallback path, probate discount, flood zone 2
 *
 * Mock data is hand-built so the math is deterministic — changing it should
 * cause golden assertions to fail loudly. That is the point.
 */

import type { Epc, Hpi, PpdTransaction } from '@repo/property-data';

// ───────────────────────────────────────────────────────────────────────────
// Common helpers
// ───────────────────────────────────────────────────────────────────────────

export function mkPpdTx(price: number, date: string, type = 'T'): PpdTransaction {
  return {
    price,
    date,
    propertyType: type,
    paon: '1',
    saon: null,
    street: 'Test Street',
    locality: null,
    town: 'Manchester',
    district: 'Manchester',
    county: 'Greater Manchester',
    postcode: 'M14 5AB',
  } as PpdTransaction;
}

export function rising(annual: number): Hpi {
  return {
    postcode: 'M14',
    region: 'North West',
    annualChange: annual,
    monthlyChange: annual / 12,
    trend: annual > 1 ? 'rising' : annual < -1 ? 'declining' : 'stable',
    source: 'hmlr_hpi',
  } as Hpi;
}

export function mkEpc(
  rating: string | null,
  floorAreaSqm: number | null = 85,
  ageBand: string | null = '1981-1990',
): Epc {
  return {
    epcRating: rating,
    floorAreaSqm,
    totalBedrooms: 3,
    constructionAgeBand: ageBand,
    address: null,
    postcode: 'M14 5AB',
    source: rating ? 'epc_register' : 'none',
  } as Epc;
}

// ───────────────────────────────────────────────────────────────────────────
// Scenario 1 — Normal terraced sale in M14
// 12 strong comparable terraced sales averaging £290k
// ───────────────────────────────────────────────────────────────────────────

export const SCENARIO_NORMAL_TERRACED = {
  pricePaid: {
    source: 'hmlr_ppd',
    avgPrice: 290_000,
    transactions: [
      mkPpdTx(280_000, monthsBack(3)),
      mkPpdTx(285_000, monthsBack(5)),
      mkPpdTx(290_000, monthsBack(7)),
      mkPpdTx(295_000, monthsBack(9)),
      mkPpdTx(300_000, monthsBack(11)),
      mkPpdTx(287_000, monthsBack(13)),
      mkPpdTx(292_000, monthsBack(15)),
      mkPpdTx(298_000, monthsBack(17)),
      mkPpdTx(289_000, monthsBack(19)),
      mkPpdTx(293_000, monthsBack(21)),
      mkPpdTx(286_000, monthsBack(23)),
      mkPpdTx(291_000, monthsBack(24)),
    ],
  },
  hpi: rising(3.2),
  epc: mkEpc('C', 85, '1981-1990'),
  externalAvm: { estimate: 295_000 } as { estimate: number },
};

// ───────────────────────────────────────────────────────────────────────────
// Scenario 2 — Chain-break with EPC F
// Same area comps but poor energy rating → -2% EPC penalty
// ───────────────────────────────────────────────────────────────────────────

export const SCENARIO_CHAIN_BREAK_EPC_F = {
  pricePaid: SCENARIO_NORMAL_TERRACED.pricePaid,
  hpi: rising(2.0),
  epc: mkEpc('F', 80, '1919-1944'),
  externalAvm: { estimate: 280_000 } as { estimate: number },
};

// ───────────────────────────────────────────────────────────────────────────
// Scenario 3 — Probate with no recent comps + flood zone 2
// Forces fallback path: empty transactions → area-average * type discount
// ───────────────────────────────────────────────────────────────────────────

export const SCENARIO_PROBATE_NO_COMPS = {
  pricePaid: {
    source: 'hmlr_ppd',
    avgPrice: 260_000,
    transactions: [], // empty — triggers fallback in base-valuation
  },
  hpi: rising(0.5), // near-stable
  epc: mkEpc(null, null, null), // no EPC data
  externalAvm: null,
};

// ───────────────────────────────────────────────────────────────────────────

function monthsBack(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

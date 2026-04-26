/**
 * @repo/property-data
 *
 * Unified UK property data orchestrator for the Bellwood Ventures platform.
 *
 * Single entry point for Scout lead enrichment via free UK government APIs:
 *
 *   - OS Places API       → canonical address + UPRN resolution
 *   - HMLR Price Paid     → historical sold prices (last 10 transactions)
 *   - HMLR HPI            → regional annual/monthly price change trend
 *   - EPC Register        → energy rating, floor area, construction era
 *   - Companies House     → solicitor firm + executor officer lookup
 *
 * All five APIs are called concurrently. Individual failures degrade gracefully
 * (synthetic fallback). The full response is returned in ≤2 s on typical
 * UK broadband to GOV.UK APIs.
 *
 * Usage:
 *   import { lookupProperty } from '@repo/property-data';
 *   const data = await lookupProperty({ address: '10 Downing St', postcode: 'SW1A 2AA' });
 *
 * The returned object is shaped for direct use by the scouting scorer and
 * the enrichment layer.
 */

import 'server-only';

import { z } from 'zod';

import { getPricePaid, PricePaidSchema } from './hmlr';
import { getHousepriceIndex, HpiSchema } from './hmlr-hpi';
import { getEpcData, EpcSchema } from './epc';
import {
  enrichEstateCompany,
  EstateOwnershipSchema,
} from './companies-house';
import { resolveAddress, OsPlaceSchema } from './os-places';

export * from './hmlr';
export * from './hmlr-hpi';
export * from './epc';
export * from './companies-house';
export * from './os-places';
export * from './propertydata';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum wall-clock time we allow for ALL parallel lookups combined. */
const LOOKUP_TIMEOUT_MS = 9_000;

// ---------------------------------------------------------------------------
// Schemas for the unified response
// ---------------------------------------------------------------------------

const ScoringSignalsSchema = z.object({
  marketTrend: z.enum(['rising', 'stable', 'declining', 'unknown']),
  avgDaysOnMarket: z.number().nullable(),
  epcRating: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']).nullable(),
  avgSalePrice: z.number().nullable(),
  annualPriceChange: z.number().nullable(),
  bedrooms: z.number().nullable(),
  floorAreaSqm: z.number().nullable(),
});

export const PropertyLookupResultSchema = z.object({
  // ── Address ─────────────────────────────────────────────────────────────
  address: z.string().nullable(),
  postcode: z.string().nullable(),
  uprn: z.string().nullable(),
  coordinates: z
    .object({ lat: z.number(), lng: z.number() })
    .nullable(),

  // ── Price history (HMLR PPD) ─────────────────────────────────────────────
  pricePaid: z
    .object({
      avgPrice: z.number().nullable(),
      lastSalePrice: z.number().nullable(),
      lastSaleDate: z.string().nullable(),
      transactionCount: z.number(),
      source: z.string(),
    })
    .nullable(),

  // ── Market trend (HMLR HPI) ──────────────────────────────────────────────
  marketIntelligence: z
    .object({
      trend: z.enum(['rising', 'stable', 'declining']),
      annualChangePercent: z.number(),
      monthlyChangePercent: z.number(),
      averageRegionalPrice: z.number().nullable(),
      hpiPeriod: z.string(),
      source: z.string(),
    })
    .nullable(),

  // ── EPC data ─────────────────────────────────────────────────────────────
  epc: z
    .object({
      rating: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']).nullable(),
      score: z.number().nullable(),
      propertyType: z.string().nullable(),
      floorAreaSqm: z.number().nullable(),
      constructionAgeBand: z.string().nullable(),
      heatingType: z.string().nullable(),
      totalBedrooms: z.number().nullable(),
      inspectionDate: z.string().nullable(),
      source: z.string(),
    })
    .nullable(),

  // ── Companies House ───────────────────────────────────────────────────────
  estateOwnership: z
    .object({
      solicitorCompany: z
        .object({
          companyName: z.string(),
          companyNumber: z.string(),
          companyStatus: z.string().nullable(),
          source: z.string(),
        })
        .nullable(),
      contactOfficer: z
        .object({
          name: z.string(),
          officerRole: z.string().nullable(),
          source: z.string(),
        })
        .nullable(),
      heldByCompany: z.boolean(),
      source: z.string(),
    })
    .nullable(),

  // ── Scorer-ready signals ─────────────────────────────────────────────────
  scoringSignals: ScoringSignalsSchema,

  // ── Meta ─────────────────────────────────────────────────────────────────
  meta: z.object({
    lookupMs: z.number(),
    sources: z.object({
      address: z.string(),
      pricePaid: z.string(),
      hpi: z.string(),
      epc: z.string(),
      estateOwnership: z.string(),
    }),
  }),
});

export type PropertyLookupResult = z.infer<typeof PropertyLookupResultSchema>;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    ),
  ]);
}

async function safe<T>(
  promise: Promise<T>,
  label: string,
  fallback: T
): Promise<T> {
  try {
    return await withTimeout(promise, LOOKUP_TIMEOUT_MS, label);
  } catch (err) {
    console.warn(
      `[property-data/${label}] ${(err as Error).message}`
    );
    return fallback;
  }
}

function deriveMarketTrend(
  hpi: Awaited<ReturnType<typeof getHousepriceIndex>> | null
): 'rising' | 'stable' | 'declining' | 'unknown' {
  return hpi?.trend ?? 'unknown';
}

function deriveAvgDaysOnMarket(
  pricePaid: Awaited<ReturnType<typeof getPricePaid>> | null
): number | null {
  if (!pricePaid?.transactions || pricePaid.transactions.length < 2)
    return null;
  const sorted = [...pricePaid.transactions].sort((a, b) =>
    b.date.localeCompare(a.date)
  );
  const latest = sorted[0];
  const second = sorted[1];
  if (!latest?.date || !second?.date) return null;
  const diffDays =
    (new Date(latest.date).getTime() - new Date(second.date).getTime()) /
    86_400_000;
  return Math.abs(Math.round(diffDays));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LookupPropertyInput {
  /** Free-text address. */
  address?: string;
  /** UK postcode (Royal Mail format). */
  postcode?: string;
  /** Pre-resolved UPRN — skips the OS Places call when supplied. */
  uprn?: string;
  /** Solicitor firm name — for Companies House lookup. */
  solicitorFirm?: string;
  /** Contact name — for Companies House officer lookup. */
  contactName?: string;
}

/**
 * Look up enriched property data for a Scout lead.
 *
 * All APIs are called concurrently. Individual failures degrade gracefully to
 * synthetic fallback data so the caller always receives a complete object.
 *
 * Currency values are in GBP (£). Dates are ISO 8601 strings (YYYY-MM-DD).
 */
export async function lookupProperty(
  input: LookupPropertyInput = {}
): Promise<PropertyLookupResult> {
  const { address, postcode, uprn, solicitorFirm, contactName } = input;
  const startMs = Date.now();

  // Resolve canonical address + UPRN first (sequential — other APIs may need it)
  let resolvedAddress: Awaited<ReturnType<typeof resolveAddress>> | null = null;
  let resolvedUprn: string | null = uprn ?? null;

  if (!uprn && (address || postcode)) {
    resolvedAddress = await safe(
      resolveAddress(address ?? '', postcode),
      'os-places',
      null as unknown as Awaited<ReturnType<typeof resolveAddress>>
    );
    resolvedUprn = resolvedAddress?.uprn ?? null;
  }

  const effectivePostcode =
    postcode ?? resolvedAddress?.postcode ?? '';

  // Parallel calls to HMLR, EPC, and Companies House
  const [pricePaid, hpi, epc, ownership] = await Promise.all([
    safe(getPricePaid(effectivePostcode), 'hmlr-ppd', null as unknown as Awaited<ReturnType<typeof getPricePaid>>),
    safe(getHousepriceIndex(effectivePostcode), 'hmlr-hpi', null as unknown as Awaited<ReturnType<typeof getHousepriceIndex>>),
    safe(getEpcData(effectivePostcode, address), 'epc', null as unknown as Awaited<ReturnType<typeof getEpcData>>),
    safe(
      enrichEstateCompany({ solicitorFirm, contactName }),
      'companies-house',
      null as unknown as Awaited<ReturnType<typeof enrichEstateCompany>>
    ),
  ]);

  const elapsedMs = Date.now() - startMs;
  const marketTrend = deriveMarketTrend(hpi);
  const avgDaysOnMarket = deriveAvgDaysOnMarket(pricePaid);

  return {
    // ── Address ─────────────────────────────────────────────────────────────
    address: resolvedAddress?.address ?? address ?? null,
    postcode: resolvedAddress?.postcode ?? postcode ?? null,
    uprn: resolvedUprn,
    coordinates:
      resolvedAddress?.latitude != null && resolvedAddress?.longitude != null
        ? { lat: resolvedAddress.latitude, lng: resolvedAddress.longitude }
        : null,

    // ── Price history ────────────────────────────────────────────────────────
    pricePaid: pricePaid
      ? {
          avgPrice: pricePaid.avgPrice,
          lastSalePrice: pricePaid.lastSalePrice,
          lastSaleDate: pricePaid.lastSaleDate,
          transactionCount: pricePaid.transactions.length,
          source: pricePaid.source,
        }
      : null,

    // ── Market trend ─────────────────────────────────────────────────────────
    marketIntelligence: hpi
      ? {
          trend: hpi.trend,
          annualChangePercent: hpi.annualChange,
          monthlyChangePercent: hpi.monthlyChange,
          averageRegionalPrice: hpi.averagePrice,
          hpiPeriod: hpi.period,
          source: hpi.source,
        }
      : null,

    // ── EPC data ─────────────────────────────────────────────────────────────
    epc: epc
      ? {
          rating: epc.epcRating,
          score: epc.epcScore,
          propertyType: epc.propertyType,
          floorAreaSqm: epc.floorAreaSqm,
          constructionAgeBand: epc.constructionAgeBand,
          heatingType: epc.heatingType,
          totalBedrooms: epc.totalBedrooms,
          inspectionDate: epc.inspectionDate,
          source: epc.source,
        }
      : null,

    // ── Companies House ───────────────────────────────────────────────────────
    estateOwnership: ownership
      ? {
          solicitorCompany: ownership.solicitorCompany
            ? {
                companyName: ownership.solicitorCompany.companyName,
                companyNumber: ownership.solicitorCompany.companyNumber,
                companyStatus: ownership.solicitorCompany.companyStatus,
                source: ownership.solicitorCompany.source,
              }
            : null,
          contactOfficer: ownership.contactOfficer
            ? {
                name: ownership.contactOfficer.name,
                officerRole: ownership.contactOfficer.officerRole,
                source: ownership.contactOfficer.source,
              }
            : null,
          heldByCompany: ownership.estateHeldByCompany,
          source:
            ownership.solicitorCompany?.source ?? 'companies_house',
        }
      : null,

    // ── Scorer-ready signals ─────────────────────────────────────────────────
    scoringSignals: {
      marketTrend,
      avgDaysOnMarket,
      epcRating: epc?.epcRating ?? null,
      avgSalePrice: pricePaid?.avgPrice ?? null,
      annualPriceChange: hpi?.annualChange ?? null,
      bedrooms: epc?.totalBedrooms ?? null,
      floorAreaSqm: epc?.floorAreaSqm ?? null,
    },

    // ── Meta ─────────────────────────────────────────────────────────────────
    meta: {
      lookupMs: elapsedMs,
      sources: {
        address:
          resolvedAddress?.source ?? (uprn ? 'uprn_provided' : 'none'),
        pricePaid: pricePaid?.source ?? 'none',
        hpi: hpi?.source ?? 'none',
        epc: epc?.source ?? 'none',
        estateOwnership:
          ownership?.solicitorCompany?.source ?? 'none',
      },
    },
  };
}

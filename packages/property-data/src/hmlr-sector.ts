/**
 * HM Land Registry Price Paid — postcode-SECTOR comparables (hmlr-sector.ts)
 *
 * The AVM's evidence of last resort. Its two primary comp sources are
 * PropertyData /sold-prices (distance-weighted, costs credits) and the
 * exact-postcode Land Registry feed (a single postcode is ~15 homes, so it
 * is often empty for a given property type). When BOTH return nothing the
 * old behaviour was to price off `pricePaid.avgPrice` — which, when the
 * Land Registry API was down, was a hash-generated placeholder. That is how
 * a 3-bed Edwardian semi in SW16 was "valued" at £345k (Sep 2026).
 *
 * This module widens to the postcode SECTOR ("SW16 3" — roughly 3,000
 * addresses) via the Land Registry SPARQL endpoint. It is free, needs no
 * key, and is independent of PropertyData credits. Same-type, category A
 * (standard market) sales only, newest first.
 *
 * HONEST LIMITS: sector comps carry no distance — a sector can span a mile
 * or more — so the valuation layer treats them as low-confidence evidence.
 * Real evidence at low confidence beats a fabricated number at any
 * confidence. This source NEVER falls back to synthetic data: unavailable
 * means unavailable, and the caller decides what to do about that.
 */

import { parseSparqlSales, type SoldSale } from './arbitrage';
import type { PpdTransaction } from './hmlr';

const SPARQL_ENDPOINT = 'https://landregistry.data.gov.uk/landregistry/query';
const REQUEST_TIMEOUT_MS = 12_000;
/** Below this a row is a parse error or a non-market transfer, not a sale. */
const MIN_SALE_POUNDS = 50_000;
/** Sector results change slowly; a day's cache keeps re-appraisals free. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type SectorPropertyType =
  | 'detached'
  | 'semi-detached'
  | 'terraced'
  | 'flat';

/** lrcommon property-type URIs, as the Price Paid linked data publishes them. */
const PROPERTY_TYPE_URI: Record<SectorPropertyType, string> = {
  detached: 'http://landregistry.data.gov.uk/def/common/detached',
  'semi-detached': 'http://landregistry.data.gov.uk/def/common/semi-detached',
  terraced: 'http://landregistry.data.gov.uk/def/common/terraced',
  flat: 'http://landregistry.data.gov.uk/def/common/flat-maisonette',
};

/** A sector sale in the AVM's comp shape, plus the address for the audit trail. */
export type SectorTransaction = PpdTransaction & {
  address: string | null;
  postcode: string;
};

export interface SectorPricePaid {
  /** e.g. "SW16 3". Null when the postcode could not be parsed. */
  sector: string | null;
  transactions: SectorTransaction[];
  /** 'unavailable' = the endpoint failed; NOT the same as "no sales". */
  source: 'hmlr_ppd_sector' | 'unavailable';
}

export interface SectorPricePaidOptions {
  propertyType: SectorPropertyType;
  /** Sale-age window. Default 24 months — a sector needs a wider net than a postcode. */
  maxAgeMonths?: number;
  /** Newest-first cap on rows fetched. Default 60. */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

/**
 * "SW16 3AA" → "SW16 3". Returns null rather than guessing when the input
 * is not a full UK postcode (see CLAUDE.md: never fabricate identifiers).
 */
export function postcodeSector(postcode: string): string | null {
  const compact = postcode.toUpperCase().replace(/\s+/g, '');
  const m = /^([A-Z]{1,2}\d[A-Z\d]?)(\d)[A-Z]{2}$/.exec(compact);
  if (!m) return null;
  return `${m[1]} ${m[2]}`;
}

/**
 * SPARQL for same-type, category A sales in a sector since `fromIsoDate`,
 * newest first. The sector filter keeps its trailing digit so "SW16 3"
 * cannot swallow "SW16 30" (no such sector exists, but "SW1 3" vs "SW16 3"
 * is exactly the kind of prefix trap the arbitrage query documents).
 */
export function buildSectorSalesQuery(
  sector: string,
  propertyType: SectorPropertyType,
  fromIsoDate: string,
  limit = 60
): string {
  if (!/^[A-Z]{1,2}\d[A-Z\d]? \d$/.test(sector)) {
    throw new Error(`Not a UK postcode sector: ${sector}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromIsoDate)) {
    throw new Error(`Not an ISO date: ${fromIsoDate}`);
  }
  const typeUri = PROPERTY_TYPE_URI[propertyType];
  if (!typeUri) {
    throw new Error(`Unknown property type: ${propertyType}`);
  }
  return `
PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT ?amount ?date ?paon ?saon ?street ?postcode ?ptype ?newBuild
WHERE {
  ?txn lrppi:pricePaid ?amount ;
       lrppi:transactionDate ?date ;
       lrppi:transactionCategory lrppi:standardPricePaidTransaction ;
       lrppi:propertyType <${typeUri}> ;
       lrppi:propertyAddress ?addr .
  ?addr lrcommon:postcode ?postcode .
  OPTIONAL { ?addr lrcommon:paon ?paon }
  OPTIONAL { ?addr lrcommon:saon ?saon }
  OPTIONAL { ?addr lrcommon:street ?street }
  OPTIONAL { ?txn lrppi:newBuild ?newBuild }
  BIND(<${typeUri}> AS ?ptype)
  FILTER(STRSTARTS(?postcode, "${sector}"))
  FILTER(?date >= "${fromIsoDate}"^^xsd:date)
}
ORDER BY DESC(?date)
LIMIT ${Math.max(1, Math.min(200, Math.round(limit)))}
`.trim();
}

/**
 * Turn parsed SPARQL rows into AVM comps. Drops what is not a like-for-like
 * sale: new builds (a different product), sub-units of a house (a SAON on a
 * non-flat is a converted room, not the house), and sub-£50k transfers.
 */
export function toSectorTransactions(
  sales: SoldSale[],
  propertyType: SectorPropertyType
): SectorTransaction[] {
  const out: SectorTransaction[] = [];
  for (const s of sales) {
    if (s.newBuild) continue;
    if (s.pricePounds < MIN_SALE_POUNDS) continue;
    if (propertyType !== 'flat' && s.saon) continue;
    const address =
      [s.saon, s.paon, s.street].filter(Boolean).join(' ').trim() || null;
    out.push({
      price: s.pricePounds,
      date: s.date,
      propertyType: s.propertyType,
      newBuild: false,
      tenure: 'unknown',
      provenance: 'hmlr_ppd',
      address,
      postcode: s.postcode,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// IO
// ---------------------------------------------------------------------------

const cache = new Map<string, { value: SectorPricePaid; expiresAt: number }>();

async function sparqlSelect(query: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(SPARQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/sparql-results+json',
      },
      body: new URLSearchParams({ query }).toString(),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Land Registry SPARQL ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function monthsBackIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

/**
 * Same-type Land Registry sales across the subject's postcode sector.
 *
 * Never throws and never fabricates: an endpoint failure returns
 * `source: 'unavailable'` with no rows, so the caller can tell "no sales"
 * from "could not look".
 */
export async function getSectorPricePaid(
  postcode: string,
  opts: SectorPricePaidOptions
): Promise<SectorPricePaid> {
  const sector = postcodeSector(postcode);
  if (!sector) {
    return { sector: null, transactions: [], source: 'unavailable' };
  }
  const maxAgeMonths = opts.maxAgeMonths ?? 24;
  const limit = opts.limit ?? 60;
  const key = `${sector}|${opts.propertyType}|${maxAgeMonths}|${limit}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  try {
    const query = buildSectorSalesQuery(
      sector,
      opts.propertyType,
      monthsBackIso(maxAgeMonths),
      limit
    );
    const rows = parseSparqlSales(await sparqlSelect(query));
    const value: SectorPricePaid = {
      sector,
      transactions: toSectorTransactions(rows, opts.propertyType),
      source: 'hmlr_ppd_sector',
    };
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch (err) {
    console.warn(
      `[property-data/hmlr-sector] sector lookup failed for ${sector} (${(err as Error).message}) — returning unavailable (no synthetic)`
    );
    return { sector, transactions: [], source: 'unavailable' };
  }
}

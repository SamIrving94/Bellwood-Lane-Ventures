/**
 * Refurb-arbitrage measurement — Land Registry sales × EPC condition,
 * matched by address (arbitrage.ts)
 *
 * The prime district list in `packages/scouting/src/track.ts` is, by its own
 * admission, "a starting hypothesis, not a finding". The Aug 2026 deep
 * research confirmed the ranking we want — unmodernised vs refurbished
 * £/sqft per district — is published NOWHERE and must be built from free
 * primary data. This module is that build:
 *
 *   1. Pull every house sale in a postcode district from HM Land Registry
 *      Price Paid Data (SPARQL — free, no key).
 *   2. Match each sale to its EPC certificate by address (free, needs
 *      EPC_API_TOKEN), taking floor area + energy band.
 *   3. Split by condition PROXY: band F/G = unmodernised, A–C = refurbished,
 *      D/E = excluded as ambiguous.
 *   4. Median £/sqft per side; the gap is the measured arbitrage.
 *
 * PRECISION OVER RECALL, everywhere. A missed match costs one data point in
 * a median of dozens; a WRONG match poisons the statistic silently. So the
 * address matcher here is deliberately stricter than the fuzzy probate
 * matcher in `@repo/scouting` (which serves the opposite trade: a missed
 * probate match buries a lead). Ranges ("12-14"), flats (SAON), new builds
 * and unparseable designators are dropped, not guessed.
 *
 * HONEST LIMITS, stated once here rather than hedged everywhere:
 * - The EPC band is a CONDITION PROXY, not a survey. F/G strongly implies
 *   untouched heating/insulation (the research's own proxy); A–C after a
 *   sale implies money spent. D is genuinely ambiguous — a tired-but-heated
 *   terrace and a light refurb both land there — so D/E is excluded rather
 *   than forced into a side.
 * - The certificate CURRENT at match time may post-date the sale (sold
 *   unmodernised, re-certified after works). The medians still separate the
 *   populations because mispairs push BOTH medians toward each other —
 *   i.e. the measured spread is a conservative floor, not an exaggeration.
 * - Analysis outputs are in POUNDS (and £/sqft), not pence: nothing here is
 *   stored money; it is a ranking input read by humans.
 *
 * Pure module — no `server-only`, no network. IO lives in the callers
 * (`scripts/arbitrage-rank.mts` for the district sweep).
 */

import type { EpcSearchRow } from './epc';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/**
 * Below this many matched sales on EITHER side of a district's split, the
 * spread is reported as insufficient rather than ranked. Ranking districts
 * on three houses is how a hypothesis pretends to be a finding.
 */
export const MIN_BAND_SAMPLE = 5;

/** Sanity bounds — outside these, a pair is a parse error, not a house. */
const MIN_FLOOR_AREA_SQM = 20;
const MAX_FLOOR_AREA_SQM = 700;
const MIN_SALE_POUNDS = 50_000;

const SQFT_PER_SQM = 10.7639;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One Price Paid sale, as flattened from the SPARQL result. */
export interface SoldSale {
  /** Sale price in whole pounds (as PPD reports). */
  pricePounds: number;
  /** ISO YYYY-MM-DD. */
  date: string;
  /** Primary addressable object (house number or name). Null when absent. */
  paon: string | null;
  /** Secondary addressable object (flat/unit). Non-null means not a house. */
  saon: string | null;
  street: string | null;
  postcode: string;
  /** 'detached' | 'semi-detached' | 'terraced' | 'flat-maisonette' | 'other' | 'unknown' */
  propertyType: string;
  newBuild: boolean;
}

/** A sale paired with its EPC certificate's condition evidence. */
export interface ArbitragePair {
  pricePounds: number;
  date: string;
  /** From the FULL certificate, not the search row. */
  floorAreaSqm: number | null;
  band: string | null;
  /** Matched EPC address, kept for audit output. */
  epcAddress: string;
}

export type ConditionProxy = 'unmodernised' | 'refurbished';

export interface BandSummary {
  n: number;
  medianPoundsPerSqft: number | null;
}

export interface DistrictArbitrage {
  district: string;
  /** House-shaped sales in the window (post SAON/new-build/type filters). */
  houseSales: number;
  /** Sales that matched an EPC certificate. */
  matched: number;
  /** Matched sales that survived the sanity bounds AND had a usable proxy. */
  usable: number;
  unmodernised: BandSummary;
  refurbished: BandSummary;
  /** Refurbished median minus unmodernised median, £/sqft. Null when insufficient. */
  spreadPoundsPerSqft: number | null;
  /** Spread as a fraction of the refurbished median. Null when insufficient. */
  spreadPct: number | null;
  confidence: 'measured' | 'insufficient';
}

// ---------------------------------------------------------------------------
// SPARQL — query builder + result parser (pure, so both are testable)
// ---------------------------------------------------------------------------

/**
 * SPARQL for every standard price-paid transaction in a postcode district
 * since `fromIsoDate`. Category A only: category B (repossessions, receiver
 * and other non-market sales) would double-count distress on the
 * unmodernised side and skew the baseline this model exists to measure.
 *
 * The district filter is `STRSTARTS(?postcode, "SE2 ")` WITH the trailing
 * space — without it SE2 swallows SE22, SE23 and SE24 (and N1 swallows half
 * of north London).
 */
export function buildDistrictSalesQuery(
  district: string,
  fromIsoDate: string,
  { limit = 5000, offset = 0 }: { limit?: number; offset?: number } = {}
): string {
  const d = district.toUpperCase().trim();
  if (!/^[A-Z]{1,2}\d{1,2}[A-Z]?$/.test(d)) {
    throw new Error(`Not a UK postcode district: ${district}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromIsoDate)) {
    throw new Error(`Not an ISO date: ${fromIsoDate}`);
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
       lrppi:propertyAddress ?addr .
  ?addr lrcommon:postcode ?postcode .
  OPTIONAL { ?addr lrcommon:paon ?paon }
  OPTIONAL { ?addr lrcommon:saon ?saon }
  OPTIONAL { ?addr lrcommon:street ?street }
  OPTIONAL { ?txn lrppi:propertyType ?ptype }
  OPTIONAL { ?txn lrppi:newBuild ?newBuild }
  FILTER(STRSTARTS(?postcode, "${d} "))
  FILTER(?date >= "${fromIsoDate}"^^xsd:date)
}
ORDER BY ?date
LIMIT ${limit}
OFFSET ${offset}
`.trim();
}

/** Map a lrcommon property-type URI to a stable short label. */
function propertyTypeFromUri(uri: string | undefined): string {
  if (!uri) return 'unknown';
  const tail = uri.split('/').pop()?.toLowerCase() ?? '';
  if (tail.includes('semi')) return 'semi-detached';
  if (tail.includes('detached')) return 'detached';
  if (tail.includes('terraced')) return 'terraced';
  if (tail.includes('flat') || tail.includes('maisonette')) {
    return 'flat-maisonette';
  }
  return 'other';
}

type SparqlBinding = Record<string, { value?: string } | undefined>;

/** Flatten a SPARQL JSON result into SoldSale rows. Unusable rows dropped. */
export function parseSparqlSales(json: unknown): SoldSale[] {
  const bindings = (json as { results?: { bindings?: SparqlBinding[] } })
    ?.results?.bindings;
  if (!Array.isArray(bindings)) return [];

  const out: SoldSale[] = [];
  for (const b of bindings) {
    const price = Number(b.amount?.value);
    const postcode = b.postcode?.value?.toUpperCase().trim();
    const date = b.date?.value?.slice(0, 10);
    if (!(Number.isFinite(price) && price > 0 && postcode && date)) {
      continue;
    }
    out.push({
      pricePounds: price,
      date,
      paon: b.paon?.value?.trim() || null,
      saon: b.saon?.value?.trim() || null,
      street: b.street?.value?.trim() || null,
      postcode,
      propertyType: propertyTypeFromUri(b.ptype?.value),
      newBuild: b.newBuild?.value === 'true',
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// House filter
// ---------------------------------------------------------------------------

/**
 * The sales this model measures: houses, second-hand. A SAON means a flat or
 * sub-unit whatever the type column says; a new build is a different product
 * from a refurbished period house and belongs in neither band.
 */
export function isArbitrageHouse(sale: SoldSale): boolean {
  if (sale.saon) return false;
  if (sale.newBuild) return false;
  return (
    sale.propertyType === 'detached' ||
    sale.propertyType === 'semi-detached' ||
    sale.propertyType === 'terraced'
  );
}

// ---------------------------------------------------------------------------
// Address matching (strict by design — see the header)
// ---------------------------------------------------------------------------

const NON_ALNUM = /[^A-Z0-9 ]+/g;
const SPACES = /\s+/g;

function normalise(text: string): string {
  return text.toUpperCase().replace(NON_ALNUM, ' ').replace(SPACES, ' ').trim();
}

/**
 * The house designator from a PAON: "12" / "12A" as a number token, or a
 * house name. A range ("12 - 14") or an empty PAON returns null — matching
 * a range to one certificate is a guess, and we don't.
 */
export function primaryDesignator(
  paon: string | null
): { kind: 'number'; token: string } | { kind: 'name'; token: string } | null {
  if (!paon) return null;
  // Range check runs on the RAW string: normalise() strips the hyphen, which
  // would let "12-14" through as a confident "12".
  if (/\d\s*(?:-|–|TO)\s*\d/i.test(paon)) return null;
  const clean = normalise(paon);
  if (!clean) return null;
  const num = clean.match(/^(\d+[A-Z]?)\b/);
  if (num?.[1]) {
    // A second number token is a range/plot pair that survived cleaning.
    if (/\d/.test(clean.slice(num[1].length))) return null;
    return { kind: 'number', token: num[1] };
  }
  if (/\d/.test(clean)) return null; // number buried mid-name — ambiguous
  return { kind: 'name', token: clean };
}

/** Words too generic to serve as street evidence on their own. */
const WEAK_STREET_TOKENS = new Set([
  'THE',
  'ROAD',
  'STREET',
  'AVENUE',
  'LANE',
  'CLOSE',
  'GARDENS',
  'GROVE',
  'PARK',
  'HILL',
  'COURT',
  'TERRACE',
  'CRESCENT',
  'PLACE',
  'WAY',
  'DRIVE',
  'ROW',
  'SQUARE',
  'NORTH',
  'SOUTH',
  'EAST',
  'WEST',
  'UPPER',
  'LOWER',
]);

function streetEvidenceToken(street: string | null): string | null {
  if (!street) return null;
  for (const word of normalise(street).split(' ')) {
    if (word.length >= 3 && !WEAK_STREET_TOKENS.has(word)) return word;
  }
  return null;
}

/**
 * Match one house sale to its EPC search row, or null.
 *
 * Requires BOTH the designator (number token exactly bounded, so 12 never
 * matches 12A or 112; or the full house name) AND, when the sale has a
 * usable street name, a distinctive street token in the EPC address. When
 * several certificates match (re-lodgements over the years), the most
 * recently registered wins.
 */
export function matchSaleToEpcRow(
  sale: SoldSale,
  rows: EpcSearchRow[]
): EpcSearchRow | null {
  const designator = primaryDesignator(sale.paon);
  if (!designator) return null;
  const streetToken = streetEvidenceToken(sale.street);

  const candidates = rows.filter((row) => {
    const addr = normalise(row.address);
    if (!addr) return false;

    if (designator.kind === 'number') {
      // Exact-bounded number token: "12" matches "12 ACACIA ROAD" and
      // "12, ACACIA ROAD" but never "12A …", "112 …" or "FLAT 12 …" (the
      // FLAT prefix is sub-unit language — a house sale must not pair with
      // a flat's certificate).
      const bounded = new RegExp(`(?:^|\\s)${designator.token}(?:\\s|$)`);
      if (!bounded.test(addr)) return false;
      if (/\b(FLAT|APARTMENT|MAISONETTE|UNIT)\b/.test(addr)) return false;
    } else if (!addr.includes(designator.token)) {
      return false;
    }

    return streetToken === null || addr.includes(streetToken);
  });

  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) =>
    String(b.registrationDate ?? '').localeCompare(
      String(a.registrationDate ?? '')
    ) > 0
      ? b
      : a
  );
}

// ---------------------------------------------------------------------------
// Condition proxy + summary statistics
// ---------------------------------------------------------------------------

/**
 * EPC band → condition proxy. F/G = unmodernised (the deep-research proxy),
 * A–C = refurbished, D/E = null (ambiguous — excluded, not forced).
 */
export function conditionProxyFromBand(
  band: string | null | undefined
): ConditionProxy | null {
  switch (band?.toUpperCase()) {
    case 'F':
    case 'G':
      return 'unmodernised';
    case 'A':
    case 'B':
    case 'C':
      return 'refurbished';
    default:
      return null;
  }
}

export function median(values: number[]): number | null {
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

export function poundsPerSqft(
  pricePounds: number,
  floorAreaSqm: number
): number {
  return pricePounds / (floorAreaSqm * SQFT_PER_SQM);
}

/**
 * The district verdict: median £/sqft per condition proxy and the spread
 * between them. `houseSales`/`matched`/`usable` expose the funnel so a thin
 * result is visibly thin — a district can only be ranked on evidence it
 * actually produced.
 */
export function summariseDistrictArbitrage(
  district: string,
  houseSales: number,
  pairs: ArbitragePair[]
): DistrictArbitrage {
  const usablePairs: Array<{ psf: number; proxy: ConditionProxy }> = [];
  for (const p of pairs) {
    const proxy = conditionProxyFromBand(p.band);
    if (
      proxy &&
      typeof p.floorAreaSqm === 'number' &&
      p.floorAreaSqm >= MIN_FLOOR_AREA_SQM &&
      p.floorAreaSqm <= MAX_FLOOR_AREA_SQM &&
      p.pricePounds >= MIN_SALE_POUNDS
    ) {
      usablePairs.push({
        psf: poundsPerSqft(p.pricePounds, p.floorAreaSqm),
        proxy,
      });
    }
  }

  const side = (proxy: ConditionProxy): BandSummary => {
    const values = usablePairs
      .filter((p) => p.proxy === proxy)
      .map((p) => p.psf);
    const m = median(values);
    return {
      n: values.length,
      medianPoundsPerSqft: m === null ? null : Math.round(m),
    };
  };

  const unmodernised = side('unmodernised');
  const refurbished = side('refurbished');

  const enough =
    unmodernised.n >= MIN_BAND_SAMPLE && refurbished.n >= MIN_BAND_SAMPLE;
  const spread =
    enough &&
    unmodernised.medianPoundsPerSqft !== null &&
    refurbished.medianPoundsPerSqft !== null
      ? refurbished.medianPoundsPerSqft - unmodernised.medianPoundsPerSqft
      : null;

  return {
    district: district.toUpperCase(),
    houseSales,
    matched: pairs.length,
    usable: usablePairs.length,
    unmodernised,
    refurbished,
    spreadPoundsPerSqft: spread,
    spreadPct:
      spread !== null && refurbished.medianPoundsPerSqft
        ? Math.round((spread / refurbished.medianPoundsPerSqft) * 100) / 100
        : null,
    confidence: spread !== null ? 'measured' : 'insufficient',
  };
}

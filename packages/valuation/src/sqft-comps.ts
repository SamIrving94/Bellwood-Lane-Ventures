/**
 * £-per-square-foot evidence — sold comps × EPC floor areas (sqft-comps.ts)
 *
 * The founder's point (Sep 2026): size is one of the strongest single
 * predictors of value, and the AVM was ignoring it. The distance-weighted
 * CSA takes a median of WHOLE-HOUSE prices, so a 60 m² and a 120 m² terrace
 * on the same street counted the same. This module turns the comps into a
 * £/sqft rate and re-prices the subject by its own EPC floor area.
 *
 *   1. Match each sold comp to an EPC floor-area row (PropertyData
 *      /floor-areas, per postcode) by house designator + street evidence.
 *   2. £/sqft per matched comp = time-adjusted price ÷ (m² × 10.7639).
 *   3. Median per distance bucket, blended 60/40 near/far like the CSA.
 *   4. Subject estimate = blended £/sqft × subject sqft.
 *
 * PRECISION OVER RECALL, same trade as `@repo/property-data`'s arbitrage
 * matcher: a missed match costs one data point in a median; a WRONG match
 * silently poisons the rate. So "12" never matches "12A", "112" or "Flat
 * 12", and a comp with no postcode must also share a distinctive street
 * word with the row before it counts.
 *
 * REAL DATA OR NOTHING: no subject floor area ⇒ no sqft estimate. Fewer
 * than MIN_MATCHED comps ⇒ the rate is shown as evidence but the estimate
 * falls back to the area benchmark (PropertyData /prices-per-sqf) when one
 * exists, and to nothing when it doesn't. Money in POUNDS here — this is a
 * valuation input, not stored money — pence conversion happens at the edge.
 *
 * Pure module — no `server-only`, no network — so it is unit-testable.
 */

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

export const SQFT_PER_SQM = 10.7639;

/** Below this many matched comps the rate is evidence, not an estimate. */
export const MIN_MATCHED_COMPS = 2;

/** Sanity bounds — outside these a pair is a parse error, not a house. */
const MIN_FLOOR_AREA_SQM = 20;
const MAX_FLOOR_AREA_SQM = 700;
const MIN_POUNDS_PER_SQFT = 50;
const MAX_POUNDS_PER_SQFT = 3_000;

/** Same near/far blend the distance-weighted CSA uses. */
const NEAR_WEIGHT = 0.6;
const FAR_WEIGHT = 0.4;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A sold comp as the CSA already holds it (see distance-comps / base-valuation). */
export interface SqftCompInput {
  address: string | null;
  postcode: string | null;
  /** Time-adjusted sold price in PENCE (matches WeightedComp). */
  adjustedPricePence: number;
  distanceMiles: number | null;
  bucket?: 'near' | 'far';
}

/** One EPC floor-area row (PropertyData /floor-areas, per postcode). */
export interface FloorAreaRow {
  address: string;
  floorAreaSqm: number;
}

export interface MatchedSqftComp {
  address: string;
  postcode: string | null;
  adjustedPricePence: number;
  floorAreaSqm: number;
  /** Time-adjusted £ per square foot, rounded to the pound. */
  poundsPerSqft: number;
  distanceMiles: number | null;
  bucket: 'near' | 'far';
  /** The EPC row's address, kept for audit (carries the house number). */
  matchedAddress: string;
}

export type SqftEvidenceSource = 'matched_comps' | 'area_benchmark';

export interface SqftEvidence {
  /** Blended £/sqft from matched comps. Null when nothing matched. */
  poundsPerSqft: number | null;
  nearMedianPerSqft: number | null;
  farMedianPerSqft: number | null;
  matched: MatchedSqftComp[];
  matchedCount: number;
  /** Area £/sqft benchmark (PropertyData /prices-per-sqf), when supplied. */
  benchmarkPerSqft: number | null;
  subjectFloorAreaSqm: number | null;
  subjectFloorAreaSqft: number | null;
  /**
   * The size-based market value in POUNDS: rate × subject sqft. Null when
   * we have no subject size, or no rate that clears MIN_MATCHED_COMPS and no
   * benchmark to fall back to.
   */
  sqftEstimate: number | null;
  /** Which rate produced `sqftEstimate`. Null when there is no estimate. */
  source: SqftEvidenceSource | null;
  /**
   * Subject size relative to the median matched comp, as a fraction
   * (+0.25 = a quarter bigger). The one-line "why the CSA is off" read.
   */
  sizeVsCompsPct: number | null;
}

export interface BuildSqftEvidenceInput {
  comps: SqftCompInput[];
  /** Floor-area rows keyed by normalised postcode (no spaces, upper case). */
  floorAreasByPostcode: Map<string, FloorAreaRow[]>;
  /** The subject's postcode — comps with no postcode are matched here only. */
  subjectPostcode: string;
  subjectFloorAreaSqm: number | null | undefined;
  benchmarkPerSqft?: number | null;
}

// ---------------------------------------------------------------------------
// Address matching (strict by design — see the header)
// ---------------------------------------------------------------------------

const NON_ALNUM = /[^A-Z0-9 ]+/g;
const SPACES = /\s+/g;
/** "FLAT 3 12 …" — a sub-unit designator and, optionally, its building. */
const UNIT_DESIGNATOR =
  /^(FLAT|APARTMENT|APT|UNIT|MAISONETTE)\s+(\d+[A-Z]?)\b\s*(\d+[A-Z]?)?/;
/** "12 …" / "12A …" — a house number at the start of an address. */
const HOUSE_DESIGNATOR = /^(\d+[A-Z]?)\b/;
const STARTS_WITH_DIGIT = /^\d/;

function normalise(text: string): string {
  return text.toUpperCase().replace(NON_ALNUM, ' ').replace(SPACES, ' ').trim();
}

export function normalisePostcode(postcode: string | null | undefined): string {
  return (postcode ?? '').toUpperCase().replace(SPACES, '');
}

type Designator =
  | { kind: 'house'; token: string }
  | { kind: 'unit'; token: string; unit: string };

/**
 * The addressable designator at the START of an address: "12" / "12A" for a
 * house, or "FLAT 3" / "APARTMENT 3" / "UNIT 2" for a sub-unit. A unit
 * designator also captures the building number that follows ("FLAT 3 12
 * ACACIA ROAD" ⇒ unit 3 at 12) so two flats in different buildings never
 * pair. Null when the address has no leading designator — a street-only
 * comp cannot be matched without guessing, so we don't.
 */
export function addressDesignator(address: string): Designator | null {
  const clean = normalise(address);
  if (!clean) {
    return null;
  }
  const unit = clean.match(UNIT_DESIGNATOR);
  if (unit?.[2]) {
    return {
      kind: 'unit',
      unit: unit[2],
      token: unit[3] ?? '',
    };
  }
  const house = clean.match(HOUSE_DESIGNATOR);
  if (house?.[1]) {
    // "12 14 ACACIA ROAD" — a range that lost its hyphen. Ambiguous; skip.
    const rest = clean.slice(house[1].length).trim();
    if (STARTS_WITH_DIGIT.test(rest)) {
      return null;
    }
    return { kind: 'house', token: house[1] };
  }
  return null;
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
  'FLAT',
  'APARTMENT',
  'APT',
  'UNIT',
  'MAISONETTE',
  'LONDON',
]);

/** The first distinctive word after the designator — the street's name. */
export function streetEvidenceToken(address: string): string | null {
  for (const word of normalise(address).split(' ')) {
    if (STARTS_WITH_DIGIT.test(word)) {
      continue;
    }
    if (word.length >= 3 && !WEAK_STREET_TOKENS.has(word)) {
      return word;
    }
  }
  return null;
}

function designatorsEqual(a: Designator, b: Designator): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === 'unit' && b.kind === 'unit') {
    // Same flat number, and the same building when both say which.
    return a.unit === b.unit && (!a.token || !b.token || a.token === b.token);
  }
  return a.token === b.token;
}

/**
 * Match one comp to its EPC floor-area row, or null. Rows are searched in
 * the comp's own postcode; a comp with no postcode is tried in the subject
 * postcode only, and then MUST share a distinctive street word with the row
 * (the number alone would pair "12 Acacia Road" with "12 Beech Road").
 */
export function matchCompFloorArea(
  comp: SqftCompInput,
  floorAreasByPostcode: Map<string, FloorAreaRow[]>,
  subjectPostcode: string
): FloorAreaRow | null {
  if (!comp.address) {
    return null;
  }
  const designator = addressDesignator(comp.address);
  if (!designator) {
    return null;
  }

  const compPostcode = normalisePostcode(comp.postcode);
  const rows = floorAreasByPostcode.get(
    compPostcode || normalisePostcode(subjectPostcode)
  );
  if (!rows || rows.length === 0) {
    return null;
  }

  const streetToken = streetEvidenceToken(comp.address);
  const requireStreet = !compPostcode;

  const candidates = rows.filter((row) => {
    const rowDesignator = addressDesignator(row.address);
    if (!rowDesignator || !designatorsEqual(designator, rowDesignator)) {
      return false;
    }
    if (streetToken === null) {
      return !requireStreet;
    }
    const rowAddr = normalise(row.address);
    if (rowAddr.includes(streetToken)) {
      return true;
    }
    // Street word absent from the row — only tolerable when the postcode
    // already pins the street (a unit postcode is ~one street).
    return !requireStreet && streetEvidenceToken(row.address) === null;
  });

  // Several rows for one designator (re-lodged certificates) — take the
  // largest? No: take none unless they agree. Two certificates that
  // disagree on size are exactly the guess we refuse to make.
  if (candidates.length === 0) {
    return null;
  }
  const first = candidates[0] as FloorAreaRow;
  const agree = candidates.every(
    (c) => Math.abs(c.floorAreaSqm - first.floorAreaSqm) <= 2
  );
  return agree ? first : null;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (sorted.length % 2 === 0 && lower !== undefined && upper !== undefined) {
    return (lower + upper) / 2;
  }
  return upper ?? null;
}

export function sqmToSqft(sqm: number): number {
  return Math.round(sqm * SQFT_PER_SQM);
}

export function poundsPerSqft(
  pricePounds: number,
  floorAreaSqm: number
): number {
  return pricePounds / (floorAreaSqm * SQFT_PER_SQM);
}

/** Every comp we can pair with an EPC row, inside the sanity bounds. */
function matchComps(input: BuildSqftEvidenceInput): MatchedSqftComp[] {
  const matched: MatchedSqftComp[] = [];
  for (const comp of input.comps) {
    if (!comp.address || comp.adjustedPricePence <= 0) {
      continue;
    }
    const row = matchCompFloorArea(
      comp,
      input.floorAreasByPostcode,
      input.subjectPostcode
    );
    if (!row) {
      continue;
    }
    if (
      row.floorAreaSqm < MIN_FLOOR_AREA_SQM ||
      row.floorAreaSqm > MAX_FLOOR_AREA_SQM
    ) {
      continue;
    }
    const rate = poundsPerSqft(comp.adjustedPricePence / 100, row.floorAreaSqm);
    if (rate < MIN_POUNDS_PER_SQFT || rate > MAX_POUNDS_PER_SQFT) {
      continue;
    }
    // Bucket by distance the same way the CSA does. A comp with no bucket
    // and no distance came from the subject's own postcode ⇒ near.
    const bucket: 'near' | 'far' =
      comp.bucket ??
      (typeof comp.distanceMiles === 'number' && comp.distanceMiles > 0.25
        ? 'far'
        : 'near');
    matched.push({
      address: comp.address,
      postcode: comp.postcode,
      adjustedPricePence: comp.adjustedPricePence,
      floorAreaSqm: Math.round(row.floorAreaSqm),
      poundsPerSqft: Math.round(rate),
      distanceMiles: comp.distanceMiles,
      bucket,
      matchedAddress: row.address,
    });
  }
  return matched;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the £/sqft evidence block from the CSA's comps and the EPC floor
 * areas we could fetch for their postcodes. Never throws; a thin input
 * yields a thin (but honest) result.
 */
export function buildSqftEvidence(input: BuildSqftEvidenceInput): SqftEvidence {
  const subjectSqm =
    typeof input.subjectFloorAreaSqm === 'number' &&
    input.subjectFloorAreaSqm >= MIN_FLOOR_AREA_SQM &&
    input.subjectFloorAreaSqm <= MAX_FLOOR_AREA_SQM
      ? input.subjectFloorAreaSqm
      : null;
  const subjectSqft = subjectSqm ? sqmToSqft(subjectSqm) : null;
  const benchmark =
    typeof input.benchmarkPerSqft === 'number' &&
    input.benchmarkPerSqft >= MIN_POUNDS_PER_SQFT &&
    input.benchmarkPerSqft <= MAX_POUNDS_PER_SQFT
      ? Math.round(input.benchmarkPerSqft)
      : null;

  const matched = matchComps(input);

  const nearRates = matched
    .filter((c) => c.bucket === 'near')
    .map((c) => c.poundsPerSqft);
  const farRates = matched
    .filter((c) => c.bucket === 'far')
    .map((c) => c.poundsPerSqft);
  const nearMedian = median(nearRates);
  const farMedian = median(farRates);

  let blended: number | null = null;
  if (nearMedian != null && farMedian != null) {
    blended = nearMedian * NEAR_WEIGHT + farMedian * FAR_WEIGHT;
  } else {
    blended = nearMedian ?? farMedian;
  }
  const rate = blended != null ? Math.round(blended) : null;

  let sqftEstimate: number | null = null;
  let source: SqftEvidenceSource | null = null;
  if (subjectSqft) {
    if (rate != null && matched.length >= MIN_MATCHED_COMPS) {
      sqftEstimate = Math.round(rate * subjectSqft);
      source = 'matched_comps';
    } else if (benchmark != null) {
      sqftEstimate = Math.round(benchmark * subjectSqft);
      source = 'area_benchmark';
    }
  }

  const medianCompSqm = median(matched.map((c) => c.floorAreaSqm));
  const sizeVsCompsPct =
    subjectSqm && medianCompSqm
      ? Math.round((subjectSqm / medianCompSqm - 1) * 100) / 100
      : null;

  return {
    poundsPerSqft: rate,
    nearMedianPerSqft: nearMedian != null ? Math.round(nearMedian) : null,
    farMedianPerSqft: farMedian != null ? Math.round(farMedian) : null,
    matched: matched.sort(
      (a, b) => (a.distanceMiles ?? 0) - (b.distanceMiles ?? 0)
    ),
    matchedCount: matched.length,
    benchmarkPerSqft: benchmark,
    subjectFloorAreaSqm: subjectSqm,
    subjectFloorAreaSqft: subjectSqft,
    sqftEstimate,
    source,
    sizeVsCompsPct,
  };
}

// ---------------------------------------------------------------------------
// Triangulation weights — how much the size-based estimate moves the AVM
// ---------------------------------------------------------------------------

export interface TriangulationWeights {
  csa: number;
  hedonic: number;
  external: number;
  sqft: number;
}

/**
 * The AVM's source weights, extended with the size pillar, keyed
 * `csa / external / size` — every row sums to 1. The `none` rows are the
 * blends the AVM has always used: 60/25/15 (distance CSA, with external),
 * 70/30, 40/40/20 (HMLR CSA) and 50/50. A matched-comp £/sqft estimate
 * takes 25–30 points, mostly from the hedonic (which without a size was
 * only a bedroom nudge on the CSA); an area benchmark takes a smaller 15
 * because it is a postcode average, not this street's sold evidence.
 */
const WEIGHT_TABLE: Record<string, TriangulationWeights> = {
  'distance/ext/matched_comps': {
    csa: 0.45,
    hedonic: 0.15,
    external: 0.15,
    sqft: 0.25,
  },
  'distance/noext/matched_comps': {
    csa: 0.5,
    hedonic: 0.2,
    external: 0,
    sqft: 0.3,
  },
  'hmlr/ext/matched_comps': {
    csa: 0.35,
    hedonic: 0.25,
    external: 0.15,
    sqft: 0.25,
  },
  'hmlr/noext/matched_comps': {
    csa: 0.4,
    hedonic: 0.3,
    external: 0,
    sqft: 0.3,
  },
  'distance/ext/area_benchmark': {
    csa: 0.5,
    hedonic: 0.2,
    external: 0.15,
    sqft: 0.15,
  },
  'distance/noext/area_benchmark': {
    csa: 0.6,
    hedonic: 0.25,
    external: 0,
    sqft: 0.15,
  },
  'hmlr/ext/area_benchmark': {
    csa: 0.35,
    hedonic: 0.35,
    external: 0.15,
    sqft: 0.15,
  },
  'hmlr/noext/area_benchmark': {
    csa: 0.45,
    hedonic: 0.4,
    external: 0,
    sqft: 0.15,
  },
  'distance/ext/none': { csa: 0.6, hedonic: 0.25, external: 0.15, sqft: 0 },
  'distance/noext/none': { csa: 0.7, hedonic: 0.3, external: 0, sqft: 0 },
  'hmlr/ext/none': { csa: 0.4, hedonic: 0.4, external: 0.2, sqft: 0 },
  'hmlr/noext/none': { csa: 0.5, hedonic: 0.5, external: 0, sqft: 0 },
};

/** Look up the blend for this valuation's evidence mix. */
export function triangulationWeights(
  csaSource: 'distance' | 'hmlr' | 'fallback',
  hasExternal: boolean,
  sqftSource: SqftEvidenceSource | null
): TriangulationWeights {
  const csaKey = csaSource === 'distance' ? 'distance' : 'hmlr';
  const key = `${csaKey}/${hasExternal ? 'ext' : 'noext'}/${sqftSource ?? 'none'}`;
  return WEIGHT_TABLE[key] ?? { csa: 0.5, hedonic: 0.5, external: 0, sqft: 0 };
}

/**
 * UPRN resolution — one stable property ID for a lead or deal.
 *
 * A UPRN (Unique Property Reference Number) is the key every government
 * property dataset can join on. We resolve it from two ORIGINAL sources and
 * nothing else:
 *
 *   1. EPC register — most certificates carry the UPRN the assessor lodged.
 *   2. PropertyData /uprns — the postcode's homes from the AddressBase list.
 *      (Until Oct 2026 this was OS Places; its trial licence lapsed and every
 *      call failed silently, so nothing could reach "high".)
 *
 * Both answer "which addresses exist in this postcode"; we then match the
 * lead's address against each list ourselves. The match is strict by design:
 * house number exactly (12 never matches 12A or 112), flat exactly (a house
 * never pairs with "Flat 1, 12 …", and "12 Acacia Road" never picks one of
 * its flats), and a distinctive street word when the address has one.
 *
 * Returning null is better than guessing (the SW3 rule). An unresolved lead
 * keeps `uprn: null` plus a reason, so a person can see why. Flats are where
 * most misses land — check a sample by hand before trusting the hit rate.
 */

import { searchDomesticEpc } from './epc';

export type UprnSource = 'epc' | 'propertydata';

/**
 * high   — EPC and PropertyData independently found the same UPRN.
 * medium — one source found a single clean match; the other had none or
 *          couldn't answer.
 */
export type UprnConfidence = 'high' | 'medium';

export type UprnUnresolvedReason =
  /** Not a full unit postcode (e.g. outcode only) — nothing to search. */
  | 'no_full_postcode'
  /** No house number or name we can match on (or a range like 12-14). */
  | 'unparseable_address'
  /** The sources answered; no address matched. */
  | 'no_match'
  /** More than one property matched (often a house split into flats). */
  | 'ambiguous'
  /** EPC and PropertyData matched different UPRNs. */
  | 'sources_disagree'
  /** Neither source could answer (no keys, or both calls failed). */
  | 'sources_unavailable';

export interface UprnResolution {
  uprn: string | null;
  confidence: UprnConfidence | null;
  /** Sources whose match agreed with the stored UPRN. */
  sources: UprnSource[];
  reason: UprnUnresolvedReason | null;
}

/** A candidate address from any source, reduced to what matching needs. */
export interface UprnCandidate {
  uprn: string | null;
  address: string;
}

// ---------------------------------------------------------------------------
// Address keys (pure — exported for tests)
// ---------------------------------------------------------------------------
//
// Read token by token, keeping commas, because commas are what separate the
// house from the street from the town in every source we read. Every rule
// below fails CLOSED: when a part can't be read with certainty it is null,
// and a null part never matches anything. Hardened against a blind red-team
// (Oct 2026) whose wrong-match cases live in __tests__/uprn.redteam.test.ts.

const FULL_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/;
const POSTCODE_ANYWHERE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/g;
/** 12-14, 12–14, 12 TO 14, 12 & 14, 12/14, 12 AND 14, Flat 1-2 … */
const NUMBER_RANGE = /\d+[A-Z]?\s*(?:-|–|\/|&|\bTO\b|\bAND\b)\s*\d/;
/** Not a dwelling: a sale of land, a plot or a garage is never the house. */
const NON_DWELLING =
  /^(?:LAND|PLOT|PLOTS|SITE|GARAGE|GARAGES|PARKING|STORE|STORAGE|BUILDING PLOT)\b/;

const UNIT_WORDS = new Set([
  'FLAT',
  'APARTMENT',
  'APT',
  'UNIT',
  'MAISONETTE',
  'STUDIO',
]);
const FLOORS = new Set([
  'BASEMENT',
  'GROUND',
  'FIRST',
  'SECOND',
  'THIRD',
  'FOURTH',
  'TOP',
]);
/** Agent shorthand for floor flats. */
const FLOOR_SHORTHAND: Record<string, string> = {
  GFF: 'GROUND',
  FFF: 'FIRST',
  SFF: 'SECOND',
  TFF: 'TOP',
  LGF: 'LOWER GROUND',
  LGFF: 'LOWER GROUND',
  BSMT: 'BASEMENT',
};
/**
 * Last words of a block of flats' name. COURT is also a street type (Damery
 * Court is a road of houses), so a COURT only counts as a block where the
 * address shows a flat or a street after it.
 */
const BLOCK_WORDS = new Set([
  'HOUSE',
  'BUILDING',
  'APARTMENTS',
  'COURT',
  'MANSIONS',
  'TOWER',
  'MILL',
  'MILLS',
  'HALL',
  'LODGE',
  'POINT',
  'HEIGHTS',
  'CHAMBERS',
  'WHARF',
]);
const STREET_TYPES = new Set([
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
  'MEWS',
  'WALK',
  'VILLAS',
  'PARADE',
  'RISE',
  'VALE',
  'GREEN',
  'GATE',
  'YARD',
  'WHARF',
  'QUAY',
  'BROADWAY',
  'END',
  'VIEW',
]);
/** Words that make a different street when added: Park Road North. */
const STREET_QUALIFIERS = new Set([
  'NORTH',
  'SOUTH',
  'EAST',
  'WEST',
  'UPPER',
  'LOWER',
  'GREAT',
  'LITTLE',
  'OLD',
  'NEW',
]);
const ABBREVIATIONS: Record<string, string> = {
  RD: 'ROAD',
  AVE: 'AVENUE',
  AV: 'AVENUE',
  LN: 'LANE',
  CRES: 'CRESCENT',
  GDNS: 'GARDENS',
  TERR: 'TERRACE',
  TCE: 'TERRACE',
  PL: 'PLACE',
  SQ: 'SQUARE',
  DR: 'DRIVE',
  CT: 'COURT',
  GRV: 'GROVE',
  SAINT: 'ST',
};

const isNumberToken = (t: string | undefined) => !!t && /^\d+[A-Z]?$/.test(t);
// Flat ids: 2, 2A, B, A54 (Du Cane Court), 4.03 (floor.flat).
const isUnitId = (t: string | undefined) =>
  !!t && (/^[A-Z]?\d+(?:\.\d+)?[A-Z]?$/.test(t) || /^[A-Z]$/.test(t));

export interface AddressKey {
  /** "FLAT:2", "FLOOR:FIRST", "FLAT:?" (a flat, but which?), or null. */
  unit: string | null;
  /** The house number ("12", "12A") or the house name ("ROSE COTTAGE"). */
  designator: { kind: 'number' | 'name'; token: string } | null;
  /** The street as a phrase, abbreviations expanded ("ST JOHNS ROAD"). */
  street: string | null;
  /** The cleaned address, for display/debugging. */
  text: string;
}

function clean(text: string): string {
  return text
    .toUpperCase()
    .replace(/['’]/g, '')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isFullPostcode(postcode: string): boolean {
  return FULL_POSTCODE.test(postcode.toUpperCase().trim());
}

/**
 * Tokens with commas kept as their own "," token. A dot between digits stays
 * ("Flat 4.03" is one flat, not flat 4 of number 03).
 */
function tokenize(upper: string): string[] {
  return upper
    .replace(/['’]/g, '')
    .replace(/,/g, ' , ')
    .replace(/[^A-Z0-9,. ]+/g, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Expand abbreviations; ST is SAINT at the front of a phrase, else STREET. */
function normaliseStreet(words: string[]): string | null {
  if (words.length === 0) return null;
  const out = words.map((w, i) => {
    if (w === 'ST') return i === 0 && words.length > 1 ? 'ST' : 'STREET';
    return ABBREVIATIONS[w] ?? w;
  });
  return out.join(' ');
}

/**
 * Reduce a free-text address to its matching key. Same parser for the lead
 * and every candidate, so both sides are read the same way.
 */
export function addressKey(address: string): AddressKey {
  const upper = address.toUpperCase().replace(POSTCODE_ANYWHERE, ' ');
  const text = clean(upper);
  const none: AddressKey = { unit: null, designator: null, street: null, text };
  if (!text || NUMBER_RANGE.test(upper) || NON_DWELLING.test(text)) return none;

  let tokens = tokenize(upper);
  let unit: string | null = null;
  // Where the unit words were cut out, for "BUTLER COURT FLAT 16, …".
  let unitAt = -1;

  // 1. The unit (flat), wherever it sits — "12 Acacia Road, Flat 1" too.
  for (let i = 0; i < tokens.length && unit === null; i++) {
    const t = tokens[i] as string;
    // PropertyData writes some flats as "FLAT FLAT 29": one word too many.
    while (UNIT_WORDS.has(t) && UNIT_WORDS.has(tokens[i + 1] as string)) {
      tokens.splice(i + 1, 1);
    }
    const next = tokens[i + 1];
    const shorthand = FLOOR_SHORTHAND[t];
    unitAt = i;
    if (shorthand) {
      unit = `FLOOR:${shorthand}`;
      tokens.splice(i, 1);
    } else if (t === 'LOWER' && next === 'GROUND') {
      unit = 'FLOOR:LOWER GROUND';
      const n =
        tokens[i + 2] === 'FLOOR' ? (tokens[i + 3] === 'FLAT' ? 4 : 3) : 2;
      tokens.splice(i, n);
    } else if (FLOORS.has(t) && (next === 'FLOOR' || t === 'BASEMENT')) {
      // "Ground Floor Flat", "Top Floor", "Basement Flat", "Basement, 12 …"
      unit = `FLOOR:${t}`;
      let n = next === 'FLOOR' ? 2 : 1;
      if (tokens[i + n] === 'FLAT') n++;
      tokens.splice(i, n);
    } else if (UNIT_WORDS.has(t)) {
      if (next && FLOORS.has(next) && tokens[i + 2] === 'FLOOR') {
        // "Flat First Floor, 55 …" — the first-floor flat.
        unit = `FLOOR:${next}`;
        tokens.splice(i, 3);
      } else if (isUnitId(next)) {
        unit = `FLAT:${next}`;
        tokens.splice(i, 2);
      } else {
        // "Flat, 12 …", "Upper Maisonette, 12 …" — a flat, but which one?
        unit = 'FLAT:?';
        tokens.splice(i, 1);
      }
    }
  }
  if (unit === null) unitAt = -1;
  while (tokens[0] === ',') {
    tokens = tokens.slice(1);
    unitAt--;
  }

  // 2. The house: a number at the very front, or a name as the first segment.
  let designator: AddressKey['designator'] = null;
  let rest: string[] = [];
  const t0 = tokens[0];
  const after0 = tokens[1] === ',' ? tokens[2] : tokens[1];
  const blockBeforeUnit = unitAt > 0 ? tokens.slice(0, unitAt) : [];
  if (
    blockBeforeUnit.length > 0 &&
    tokens[unitAt] === ',' &&
    !blockBeforeUnit.some((w) => w === ',' || /\d/.test(w))
  ) {
    // "BUTLER COURT FLAT 16, HYDE LANE": the block's name, then its flat.
    designator = { kind: 'name', token: blockBeforeUnit.join(' ') };
    rest = tokens.slice(unitAt + 1);
  } else if (isNumberToken(t0)) {
    if (unit === null && isNumberToken(after0)) {
      // "2, 12 ACACIA ROAD": OS Places writes some flats as two bare
      // numbers. Flat 2 of number 12, never house number 2.
      unit = `FLAT:${t0}`;
      designator = { kind: 'number', token: after0 as string };
      rest = tokens.slice(tokens.indexOf(after0 as string, 1) + 1);
    } else if (
      tokens[1] &&
      /^[A-Z]$/.test(tokens[1]) &&
      tokens[2] &&
      tokens[2] !== ','
    ) {
      // "12 A Acacia Road": 12A, or 12 with a stray letter? Can't tell.
      return { ...none };
    } else {
      designator = { kind: 'number', token: t0 as string };
      rest = tokens.slice(1);
    }
  } else if (t0) {
    const comma = tokens.indexOf(',');
    let first = comma < 0 ? tokens : tokens.slice(0, comma);
    let streetNumber: string[] = [];
    // "WOODFORD COURT 33, SHEPHERDS BUSH GREEN": PropertyData glues the
    // block's street number onto its name. The register writes "Woodford
    // Court, 33 Shepherds Bush Green", so move the 33 onto the street.
    if (
      comma >= 0 &&
      first.length > 1 &&
      isNumberToken(first.at(-1)) &&
      !first.slice(0, -1).some((w) => /\d/.test(w))
    ) {
      streetNumber = first.slice(-1);
      first = first.slice(0, -1);
    }
    const last = first.at(-1);
    // A first segment ending in ROAD/STREET… is a street, not a house name
    // ("Acacia Road, London" has no house in it). A digit makes it neither.
    // Except a building: "Albert Court, 12 High Street", where a numbered
    // street follows.
    const looksLikeStreet =
      !!last &&
      (STREET_TYPES.has(ABBREVIATIONS[last] ?? last) || last === 'ST');
    const numberedStreetFollows =
      streetNumber.length > 0 ||
      (comma >= 0 && isNumberToken(tokens[comma + 1]));
    // "Flat 65, Ralph Court, Queensway": with a flat in front, a COURT is
    // the block, not the road.
    const blockWithFlat = unit !== null && !!last && BLOCK_WORDS.has(last);
    if (
      first.length > 0 &&
      !first.some((w) => /\d/.test(w)) &&
      (!looksLikeStreet || numberedStreetFollows || blockWithFlat)
    ) {
      designator = { kind: 'name', token: first.join(' ') };
      rest = comma < 0 ? [] : [...streetNumber, ...tokens.slice(comma + 1)];
    }
  }

  // 3. The street: the rest of the house's segment, else the next segment.
  while (rest[0] === ',') rest = rest.slice(1);
  const streetEnd = rest.indexOf(',');
  let streetWords = streetEnd < 0 ? rest : rest.slice(0, streetEnd);
  const after = streetEnd < 0 ? [] : rest.slice(streetEnd + 1);
  const nextEnd = after.indexOf(',');
  const nextSegment = nextEnd < 0 ? after : after.slice(0, nextEnd);
  // "Thackrah Court, 1, Squirrel Way": a bare number is the next street's.
  if (
    streetWords.length === 1 &&
    isNumberToken(streetWords[0]) &&
    nextSegment.length > 0
  ) {
    streetWords = [...streetWords, ...nextSegment];
  }
  // "20, HITHERLANDS 25, LITTLE DIMOCKS": a name carrying its own street
  // number, with the street after it, is a block, and the 20 its flat. The
  // register writes "Flat 20, Hitherlands, 25 Little Dimocks".
  const blockNumber =
    streetWords.length > 1 && isNumberToken(streetWords.at(-1))
      ? (streetWords.at(-1) as string)
      : null;
  if (blockNumber) streetWords = streetWords.slice(0, -1);
  if (
    blockNumber &&
    unit === null &&
    designator?.kind === 'number' &&
    nextSegment.length > 0 &&
    !streetWords.some((w) => /\d/.test(w))
  ) {
    return {
      unit: `FLAT:${designator.token}`,
      designator: { kind: 'name', token: streetWords.join(' ') },
      street: normaliseStreet([blockNumber, ...nextSegment]),
      text,
    };
  }
  const street = normaliseStreet(streetWords);

  return { unit, designator, street, text };
}

/**
 * Same street? Exact phrase, or one phrase is the other plus trailing town
 * words ("ACACIA ROAD LONDON" when a source left out the comma). The shorter
 * must end in a street type, and the extra words must not themselves make a
 * different street ("PARK ROAD" vs "PARK ROAD NORTH", "ACACIA" vs "ACACIA
 * ROAD").
 */
function sameStreet(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  const sw = short.split(' ');
  const lw = long.split(' ');
  if (!sw.every((w, i) => lw[i] === w)) return false;
  const lastShort = sw.at(-1) as string;
  if (!STREET_TYPES.has(lastShort)) return false;
  return lw
    .slice(sw.length)
    .every(
      (w) => !STREET_TYPES.has(w) && !STREET_QUALIFIERS.has(w) && w !== 'ST'
    );
}

/** "33 SHEPHERDS BUSH GREEN" → "SHEPHERDS BUSH GREEN". */
const streetName = (s: string) => s.replace(/^\d+[A-Z]? /, '');

/**
 * The ways one key can be written. "16 Butler Court" (number 16 on a road
 * called Butler Court) and "Flat 16, Butler Court" are the same home when
 * the "road" is a block: the register writes flats both ways, even within
 * one postcode. Only for block words, so "2 Acacia Road" never becomes
 * "Flat 2, Acacia Road".
 */
function readings(k: AddressKey): AddressKey[] {
  const d = k.designator;
  const last = k.street?.split(' ').at(-1);
  if (
    k.unit === null &&
    d?.kind === 'number' &&
    last &&
    BLOCK_WORDS.has(last)
  ) {
    return [
      k,
      {
        ...k,
        unit: `FLAT:${d.token}`,
        designator: { kind: 'name', token: k.street as string },
        street: null,
      },
    ];
  }
  return [k];
}

function keysMatch(lead: AddressKey, candidate: AddressKey): boolean {
  return readings(lead).some((l) =>
    readings(candidate).some((c) => keysMatchExact(l, c))
  );
}

function keysMatchExact(lead: AddressKey, candidate: AddressKey): boolean {
  const a = lead.designator;
  const b = candidate.designator;
  if (!(a && b)) return false;
  if (lead.unit === 'FLAT:?' || candidate.unit === 'FLAT:?') return false;
  if (lead.unit !== candidate.unit) return false;
  // Exact: 12 ≠ 12A, "ROSE COTTAGE" ≠ "ROSE COTTAGE BARN".
  if (a.kind !== b.kind || a.token !== b.token) return false;

  if (a.kind === 'number') {
    // A number means nothing without its street.
    return (
      !!(lead.street && candidate.street) &&
      sameStreet(lead.street, candidate.street)
    );
  }
  // A named house may come without a street; when both give one it must
  // agree. A block's street number is often left off ("Crompton Court,
  // Brompton Road" vs "Crompton Court, 276 Brompton Road"), so it is not
  // compared.
  return (
    !(lead.street && candidate.street) ||
    sameStreet(streetName(lead.street), streetName(candidate.street))
  );
}

/**
 * Does `candidate` describe the same home as `address`? Same strict rules as
 * UPRN matching (exact number, exact flat, street word). Used to pick THIS
 * home's sales out of a postcode's Land Registry records.
 */
export function sameHome(address: string, candidate: string): boolean {
  return keysMatch(addressKey(address), addressKey(candidate));
}

type SourceOutcome =
  | { kind: 'match'; uprn: string }
  | { kind: 'ambiguous' }
  | { kind: 'none' }
  | { kind: 'unavailable' };

/**
 * Match one lead key against one source's candidates. Several rows with the
 * SAME UPRN (EPC re-lodgements over the years) still count as one match.
 */
export function matchCandidates(
  lead: AddressKey,
  candidates: UprnCandidate[] | null
): SourceOutcome {
  if (candidates === null) return { kind: 'unavailable' };
  const uprns = new Set<string>();
  for (const c of candidates) {
    if (c.uprn && keysMatch(lead, addressKey(c.address))) uprns.add(c.uprn);
  }
  if (uprns.size === 1) return { kind: 'match', uprn: [...uprns][0] as string };
  return uprns.size > 1 ? { kind: 'ambiguous' } : { kind: 'none' };
}

/** Combine the two sources' outcomes into one decision. */
export function combineOutcomes(
  epc: SourceOutcome,
  pd: SourceOutcome
): UprnResolution {
  const unresolved = (reason: UprnUnresolvedReason): UprnResolution => ({
    uprn: null,
    confidence: null,
    sources: [],
    reason,
  });

  if (epc.kind === 'match' && pd.kind === 'match') {
    return epc.uprn === pd.uprn
      ? {
          uprn: epc.uprn,
          confidence: 'high',
          sources: ['epc', 'propertydata'],
          reason: null,
        }
      : unresolved('sources_disagree');
  }
  // One clean match is enough only when the other source didn't see
  // several candidates — an ambiguous answer is a warning, not silence.
  if (epc.kind === 'ambiguous' || pd.kind === 'ambiguous') {
    return unresolved('ambiguous');
  }
  if (epc.kind === 'match') {
    return {
      uprn: epc.uprn,
      confidence: 'medium',
      sources: ['epc'],
      reason: null,
    };
  }
  if (pd.kind === 'match') {
    return {
      uprn: pd.uprn,
      confidence: 'medium',
      sources: ['propertydata'],
      reason: null,
    };
  }
  if (epc.kind === 'unavailable' && pd.kind === 'unavailable') {
    return unresolved('sources_unavailable');
  }
  return unresolved('no_match');
}

// ---------------------------------------------------------------------------
// Live resolution
// ---------------------------------------------------------------------------

export interface UprnLookups {
  /** EPC certificates in the postcode; null when the register can't answer. */
  epc: (postcode: string) => Promise<UprnCandidate[] | null>;
  /** PropertyData's homes in the postcode; null when it can't answer. */
  addresses: (postcode: string) => Promise<UprnCandidate[] | null>;
}

const liveLookups: UprnLookups = {
  async epc(postcode) {
    // searchDomesticEpc returns [] without a token; that's "can't answer",
    // not "no certificates".
    if (!process.env.EPC_API_TOKEN) return null;
    const rows = await searchDomesticEpc(postcode);
    return rows.map((r) => ({ uprn: r.uprn, address: r.address }));
  },
  async addresses(postcode) {
    // Loaded on first use: propertydata.ts is server-only, and scripts that
    // pass their own lookups (the golden-set pre-fill) must not pull it in.
    const { getPostcodeUprnsResult } = await import('./propertydata');
    const res = await getPostcodeUprnsResult(postcode);
    if (res.outcome === 'ok') return res.value;
    // 404 is a real "no homes here"; a failure is "couldn't answer".
    return res.outcome === 'not_found' ? [] : null;
  },
};

/**
 * Resolve a lead's address to a UPRN, or null with a reason. Two lookups per
 * call: an EPC search (free) and PropertyData /uprns (6-9 credits per
 * postcode, cached 60 days). An address with no house in it is refused
 * before either is called, so a street-only lead costs nothing.
 */
export async function resolveUprn(
  input: { address: string; postcode: string },
  lookups: UprnLookups = liveLookups
): Promise<UprnResolution> {
  const postcode = input.postcode.toUpperCase().trim();
  if (!isFullPostcode(postcode)) {
    return {
      uprn: null,
      confidence: null,
      sources: [],
      reason: 'no_full_postcode',
    };
  }
  const key = addressKey(input.address);
  if (!key.designator) {
    return {
      uprn: null,
      confidence: null,
      sources: [],
      reason: 'unparseable_address',
    };
  }

  const [epcRows, pdRows] = await Promise.all([
    lookups.epc(postcode).catch(() => null),
    lookups.addresses(postcode).catch(() => null),
  ]);
  return combineOutcomes(
    matchCandidates(key, epcRows),
    matchCandidates(key, pdRows)
  );
}

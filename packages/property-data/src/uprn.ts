/**
 * UPRN resolution — one stable property ID for a lead or deal.
 *
 * A UPRN (Unique Property Reference Number) is the key every government
 * property dataset can join on. We resolve it from two ORIGINAL sources and
 * nothing else:
 *
 *   1. EPC register — most certificates carry the UPRN the assessor lodged.
 *   2. OS Places    — the canonical address list for the postcode.
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
import { listPostcodeAddresses } from './os-places';

export type UprnSource = 'epc' | 'os_places';

/**
 * high   — EPC and OS Places independently found the same UPRN.
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
  /** EPC and OS Places matched different UPRNs. */
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
const isUnitId = (t: string | undefined) =>
  !!t && (/^\d+[A-Z]?$/.test(t) || /^[A-Z]$/.test(t));

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

/** Tokens with commas kept as their own "," token. */
function tokenize(upper: string): string[] {
  return upper
    .replace(/['’]/g, '')
    .replace(/,/g, ' , ')
    .replace(/[^A-Z0-9, ]+/g, ' ')
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

  // 1. The unit (flat), wherever it sits — "12 Acacia Road, Flat 1" too.
  for (let i = 0; i < tokens.length && unit === null; i++) {
    const t = tokens[i] as string;
    const next = tokens[i + 1];
    const shorthand = FLOOR_SHORTHAND[t];
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
      if (isUnitId(next)) {
        unit = `FLAT:${next}`;
        tokens.splice(i, 2);
      } else {
        // "Flat, 12 …", "Upper Maisonette, 12 …" — a flat, but which one?
        unit = 'FLAT:?';
        tokens.splice(i, 1);
      }
    }
  }
  while (tokens[0] === ',') tokens = tokens.slice(1);

  // 2. The house: a number at the very front, or a name as the first segment.
  let designator: AddressKey['designator'] = null;
  let rest: string[] = [];
  const t0 = tokens[0];
  const after0 = tokens[1] === ',' ? tokens[2] : tokens[1];
  if (isNumberToken(t0)) {
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
    const first = comma < 0 ? tokens : tokens.slice(0, comma);
    const last = first.at(-1);
    // A first segment ending in ROAD/STREET… is a street, not a house name
    // ("Acacia Road, London" has no house in it). A digit makes it neither.
    // Except a building: "Albert Court, 12 High Street", where a numbered
    // street follows.
    const looksLikeStreet =
      !!last &&
      (STREET_TYPES.has(ABBREVIATIONS[last] ?? last) || last === 'ST');
    const numberedStreetFollows =
      comma >= 0 && isNumberToken(tokens[comma + 1]);
    if (
      first.length > 0 &&
      !first.some((w) => /\d/.test(w)) &&
      (!looksLikeStreet || numberedStreetFollows)
    ) {
      designator = { kind: 'name', token: first.join(' ') };
      rest = comma < 0 ? [] : tokens.slice(comma + 1);
    }
  }

  // 3. The street: the rest of the house's segment, else the next segment.
  while (rest[0] === ',') rest = rest.slice(1);
  const streetEnd = rest.indexOf(',');
  const street = normaliseStreet(
    streetEnd < 0 ? rest : rest.slice(0, streetEnd)
  );

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

function keysMatch(lead: AddressKey, candidate: AddressKey): boolean {
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
  // A named house may come without a street; when both give one it must agree.
  return (
    !(lead.street && candidate.street) ||
    sameStreet(lead.street, candidate.street)
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
  os: SourceOutcome
): UprnResolution {
  const unresolved = (reason: UprnUnresolvedReason): UprnResolution => ({
    uprn: null,
    confidence: null,
    sources: [],
    reason,
  });

  if (epc.kind === 'match' && os.kind === 'match') {
    return epc.uprn === os.uprn
      ? {
          uprn: epc.uprn,
          confidence: 'high',
          sources: ['epc', 'os_places'],
          reason: null,
        }
      : unresolved('sources_disagree');
  }
  // One clean match is enough only when the other source didn't see
  // several candidates — an ambiguous answer is a warning, not silence.
  if (epc.kind === 'ambiguous' || os.kind === 'ambiguous') {
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
  if (os.kind === 'match') {
    return {
      uprn: os.uprn,
      confidence: 'medium',
      sources: ['os_places'],
      reason: null,
    };
  }
  if (epc.kind === 'unavailable' && os.kind === 'unavailable') {
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
  /** OS Places addresses in the postcode; null when OS can't answer. */
  os: (postcode: string) => Promise<UprnCandidate[] | null>;
}

const liveLookups: UprnLookups = {
  async epc(postcode) {
    // searchDomesticEpc returns [] without a token; that's "can't answer",
    // not "no certificates".
    if (!process.env.EPC_API_TOKEN) return null;
    const rows = await searchDomesticEpc(postcode);
    return rows.map((r) => ({ uprn: r.uprn, address: r.address }));
  },
  async os(postcode) {
    const rows = await listPostcodeAddresses(postcode);
    return (
      rows?.map((r) => ({ uprn: r.uprn, address: r.address ?? '' })) ?? null
    );
  },
};

/**
 * Resolve a lead's address to a UPRN, or null with a reason. Two lookups per
 * call (EPC search + OS Places postcode), both free-tier.
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

  const [epcRows, osRows] = await Promise.all([
    lookups.epc(postcode).catch(() => null),
    lookups.os(postcode).catch(() => null),
  ]);
  return combineOutcomes(
    matchCandidates(key, epcRows),
    matchCandidates(key, osRows)
  );
}

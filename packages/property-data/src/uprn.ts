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

import { streetEvidenceToken } from './arbitrage';
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

const FULL_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/;
const POSTCODE_ANYWHERE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/g;
const NUMBER_RANGE = /\b\d+[A-Z]?\s*(?:-|–|TO)\s*\d+/;
const UNIT_PREFIX =
  /\b(?:FLAT|APARTMENT|APT|UNIT|MAISONETTE|STUDIO)\s+([0-9]+[A-Z]?|[A-Z])\b/;
const FLOOR_FLAT =
  /\b(BASEMENT|LOWER GROUND|GROUND|FIRST|SECOND|THIRD|FOURTH|TOP)\s+FLOOR(?:\s+FLAT)?\b/;
const UNIT_WORD = /\b(?:FLAT|APARTMENT|APT|MAISONETTE|STUDIO)\b/;
// "Acacia Road, London" has no house in it — its first segment is a street,
// and treating that as a house name would match every door on the road.
const STREET_SUFFIX =
  /\b(?:ROAD|RD|STREET|ST|AVENUE|AVE|LANE|CLOSE|GARDENS|GROVE|PARK|HILL|TERRACE|CRESCENT|PLACE|WAY|DRIVE|ROW|SQUARE|MEWS|WALK|VILLAS|PARADE|RISE|VALE)$/;

export interface AddressKey {
  /** "FLAT:2", "FLOOR:FIRST", or null for a whole house/building. */
  unit: string | null;
  /** The house number ("12", "12A") or name ("ROSE COTTAGE"). */
  designator: { kind: 'number' | 'name'; token: string } | null;
  /** A distinctive street word, or null when there isn't one. */
  street: string | null;
  /** The cleaned address, for name containment checks. */
  text: string;
}

function clean(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isFullPostcode(postcode: string): boolean {
  return FULL_POSTCODE.test(postcode.toUpperCase().trim());
}

/**
 * Reduce a free-text address to its matching key. Same parser for the lead
 * and every candidate, so both sides are read the same way.
 */
export function addressKey(address: string): AddressKey {
  const upper = address.toUpperCase().replace(POSTCODE_ANYWHERE, ' ');
  const text = clean(upper);

  let unit: string | null = null;
  let rest = text;
  const floorMatch = text.match(FLOOR_FLAT);
  // "FIRST FLOOR FLAT 12 …" names the floor; the 12 is the house. Only when
  // the floor phrase ends in FLAT does it outrank a "FLAT n" reading.
  const floorFlat = Boolean(floorMatch?.[0].endsWith('FLAT'));
  const unitMatch = floorFlat ? null : text.match(UNIT_PREFIX);
  if (unitMatch?.[1]) {
    unit = `FLAT:${unitMatch[1]}`;
    rest = text.replace(unitMatch[0], ' ');
  } else if (floorMatch?.[1]) {
    unit = `FLOOR:${floorMatch[1]}`;
    rest = text.replace(floorMatch[0], ' ');
  } else if (UNIT_WORD.test(text)) {
    // "Flat, 12 Acacia Road" — says it's a flat but not which one. Mark it
    // so it can never pair with the whole house or a specific flat.
    unit = 'FLAT:?';
    rest = text.replace(UNIT_WORD, ' ');
  }
  rest = rest.replace(/\s+/g, ' ').trim();

  // A range on the raw text, because clean() strips the hyphen and would
  // let "12-14" through as a confident "12".
  const rawRest = unitMatch ? upper.replace(UNIT_PREFIX, ' ') : upper;
  const rawForName = floorMatch
    ? clean(upper).replace(floorMatch[0], ' ')
    : rawRest;
  let designator: AddressKey['designator'] = null;
  let streetPart = rest;
  const pair = unit ? null : rest.match(/^(\d+[A-Z]?) (\d+[A-Z]?)(?=\s|$)/);
  if (NUMBER_RANGE.test(rawRest)) {
    // leave designator null
  } else if (pair?.[1] && pair[2]) {
    // "2, 12 ACACIA ROAD" — OS Places writes some flats as two bare numbers.
    // Read it as flat 2 of number 12, never as house number 2.
    unit = `FLAT:${pair[1]}`;
    designator = { kind: 'number', token: pair[2] };
    streetPart = rest.slice(pair[0].length);
  } else {
    const num = rest.match(/(?:^|\s)(\d+[A-Z]?)(?=\s|$)/);
    if (num?.[1]) {
      designator = { kind: 'number', token: num[1] };
      streetPart = rest.slice((num.index ?? 0) + num[0].length);
    } else {
      // Named house: the first comma segment, when it carries no digits.
      const firstSegment = clean(rawForName.split(',')[0] ?? '');
      if (
        firstSegment &&
        !/\d/.test(firstSegment) &&
        !STREET_SUFFIX.test(firstSegment)
      ) {
        designator = { kind: 'name', token: firstSegment };
        streetPart = rest.slice(firstSegment.length);
      }
    }
  }

  return { unit, designator, street: streetEvidenceToken(streetPart), text };
}

function keysMatch(lead: AddressKey, candidate: AddressKey): boolean {
  if (!(lead.designator && candidate.designator)) return false;
  if (lead.unit === 'FLAT:?' || candidate.unit === 'FLAT:?') return false;
  if (lead.unit !== candidate.unit) return false;

  if (lead.designator.kind === 'number') {
    if (candidate.designator.kind !== 'number') return false;
    if (lead.designator.token !== candidate.designator.token) return false;
  } else if (!candidate.text.includes(lead.designator.token)) {
    return false;
  }

  return lead.street === null || candidate.text.includes(lead.street);
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

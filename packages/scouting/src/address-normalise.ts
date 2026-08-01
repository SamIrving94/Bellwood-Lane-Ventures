/**
 * UK address normalisation + fuzzy matching (address-normalise.ts)
 *
 * Pure, deterministic helpers that turn free-text UK addresses (Gazette prose,
 * HM Land Registry records, listings) into a comparable canonical form, and
 * score how confidently two addresses refer to the SAME property.
 *
 * Used by the probate → Land Registry matcher (hmlr-match.ts) to attach a real
 * last-sale price/date to a Gazette deceased-estate notice with a defensible
 * confidence, and reusable anywhere an address needs cleaning.
 *
 * Pure module (no 'server-only') so it is unit-testable and usable either side.
 */

// Matches a UK postcode, capturing outward + inward parts. Tolerant of a
// missing space ("SK44AP") and mixed case.
const UK_POSTCODE_RE = /([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})/i;

// Common street-type abbreviations → canonical full form, so "Sevenoaks Ave"
// and "Sevenoaks Avenue" compare equal.
const STREET_ABBR: Record<string, string> = {
  rd: 'road',
  st: 'street',
  ave: 'avenue',
  av: 'avenue',
  ln: 'lane',
  cl: 'close',
  ct: 'court',
  dr: 'drive',
  gdns: 'gardens',
  gdn: 'garden',
  gro: 'grove',
  pl: 'place',
  sq: 'square',
  ter: 'terrace',
  cres: 'crescent',
  wy: 'way',
  pk: 'park',
  hts: 'heights',
};

// Locality noise words we don't want to dominate a fuzzy street comparison.
const STOP_WORDS = new Set(['the', 'of', 'and', 'lately']);

export type MatchConfidence = 'confident' | 'fuzzy' | 'none';

export interface NormalisedAddress {
  /** Leading house number, e.g. "12" or "12a" (lowercased). null if none. */
  houseNumber: string | null;
  /** Canonicalised street line without the number, e.g. "sevenoaks avenue". */
  street: string | null;
  /** Postcode with a single space, uppercased, e.g. "SK4 4AP". null if none. */
  postcode: string | null;
  /** Canonical comparison key: "houseNumber|street|postcode". */
  key: string;
  /** Cleaned street tokens used for fuzzy comparison. */
  tokens: string[];
}

/** Pull the first UK postcode out of any string, normalised to "AAAN NAA". */
export function extractPostcode(raw: string): string | null {
  const m = (raw ?? '').match(UK_POSTCODE_RE);
  if (!m) return null;
  return `${m[1]} ${m[2]}`.toUpperCase();
}

function canonicaliseTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .map((w) => STREET_ABBR[w] ?? w);
}

/**
 * Normalise a free-text UK address into comparable parts. Best-effort and
 * lossy by design — it extracts the postcode, a leading house number, and a
 * canonical street line; the rest becomes fuzzy tokens.
 */
export function normaliseUkAddress(raw: string): NormalisedAddress {
  const cleaned = (raw ?? '').replace(/\s+/g, ' ').trim();
  const postcode = extractPostcode(cleaned);

  // Remove the postcode from the working body so it can't leak into the street.
  let body = postcode
    ? cleaned.replace(UK_POSTCODE_RE, '').replace(/,\s*$/, '').trim()
    : cleaned;
  body = body.replace(/\s*,\s*/g, ', ').replace(/,\s*,/g, ',').trim();

  // House number = a leading number, optionally with a single letter (12A).
  const numMatch = body.match(/^(\d+\s?[a-z]?)\b[\s,]*/i);
  let houseNumber: string | null = null;
  let afterNum = body;
  if (numMatch?.[1]) {
    houseNumber = numMatch[1].replace(/\s+/g, '').toLowerCase();
    afterNum = body.slice(numMatch[0].length).trim();
  }

  // Street = the first comma-segment after the number (best effort).
  const firstSeg = afterNum.split(',')[0]?.trim() ?? '';
  const streetTokens = firstSeg ? canonicaliseTokens(firstSeg) : [];
  const street = streetTokens.length ? streetTokens.join(' ') : null;

  const key = [houseNumber ?? '', street ?? '', postcode ?? ''].join('|');
  return { houseNumber, street, postcode, key, tokens: streetTokens };
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Score 0–1 that two normalised addresses are the SAME property.
 *
 *   postcode match (both present, equal) .............. +0.40
 *   postcode present on both but different ............  → 0 (hard gate)
 *   house number match (both present, equal) .......... +0.35
 *   house numbers both present but different .......... capped low (diff house)
 *   street-token overlap (Jaccard) .................... +0.25 × overlap
 *
 * Max 1.0. Deterministic and side-effect free.
 */
export function addressMatchScore(
  a: NormalisedAddress,
  b: NormalisedAddress,
): number {
  // Hard gate: two known-but-different postcodes can't be the same property.
  if (a.postcode && b.postcode && a.postcode !== b.postcode) return 0;

  let score = 0;
  if (a.postcode && b.postcode && a.postcode === b.postcode) score += 0.4;

  if (a.houseNumber && b.houseNumber) {
    if (a.houseNumber === b.houseNumber) {
      score += 0.35;
    } else {
      // Same street, different house → explicitly NOT the same property.
      const overlap = jaccard(new Set(a.tokens), new Set(b.tokens));
      return Math.min(0.2, score + overlap * 0.05);
    }
  }

  const overlap = jaccard(new Set(a.tokens), new Set(b.tokens));
  score += overlap * 0.25;

  return Math.min(1, Math.round(score * 100) / 100);
}

/** Map a raw match score to a confidence band for storage/display. */
export function classifyConfidence(score: number): MatchConfidence {
  if (score >= 0.85) return 'confident';
  if (score >= 0.5) return 'fuzzy';
  return 'none';
}

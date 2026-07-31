/**
 * Probate → Land Registry sale matcher (hmlr-match.ts)
 *
 * Takes a probate/deceased-estate address (e.g. from a Gazette notice) and
 * finds THAT property's real last sale in HM Land Registry Price Paid Data,
 * with a defensible confidence score. This is the enrichment the founder can
 * act on: "the deceased's home last sold for £X in YYYY".
 *
 * REAL DATA OR NOTHING: backed by getPricePaidWithAddresses, which never
 * synthesises. No confident/fuzzy match → `confidence: 'none'` and null sale
 * fields, so a letter is never sent off a fabricated price.
 *
 * Money is returned in PENCE to match the rest of the codebase.
 */

import 'server-only';

import { getPricePaidWithAddresses } from '@repo/property-data/src/hmlr';
import {
  type MatchConfidence,
  addressMatchScore,
  classifyConfidence,
  normaliseUkAddress,
} from './address-normalise';

export interface ProbateSaleMatch {
  /** Best-matched HMLR address, or null when nothing matched. */
  matchedAddress: string | null;
  /** Last sale price of the matched property, in PENCE. Null when no match. */
  lastSalePricePence: number | null;
  /** Last sale date (ISO YYYY-MM-DD) of the matched property. Null when none. */
  lastSaleDate: string | null;
  /** Confidence band for the match. */
  confidence: MatchConfidence;
  /** Raw 0–1 match score (rounded) — kept for audit/tuning. */
  matchScore: number;
  /** How many HMLR sales were considered in this postcode. */
  candidatesConsidered: number;
}

const NO_MATCH: ProbateSaleMatch = {
  matchedAddress: null,
  lastSalePricePence: null,
  lastSaleDate: null,
  confidence: 'none',
  matchScore: 0,
  candidatesConsidered: 0,
};

// Per-process cache so a scouting run that touches many leads in the same
// postcode only hits HMLR once. Keyed by uppercased postcode.
const recordCache = new Map<string, Awaited<ReturnType<typeof getPricePaidWithAddresses>>>();

async function recordsFor(postcode: string) {
  const key = postcode.toUpperCase().trim();
  const cached = recordCache.get(key);
  if (cached) return cached;
  const records = await getPricePaidWithAddresses(key);
  recordCache.set(key, records);
  return records;
}

/**
 * Match a probate address to its Land Registry last sale.
 *
 * Picks the highest-scoring sale in the postcode. When several sales share the
 * winning address (repeat sales of the same house), the most RECENT is used as
 * the "last sale". Returns NO_MATCH when nothing clears the fuzzy threshold.
 */
export async function matchProbateAddressToSale(input: {
  address: string;
  postcode: string;
}): Promise<ProbateSaleMatch> {
  if (!input.postcode?.trim()) return NO_MATCH;

  const records = await recordsFor(input.postcode);
  if (records.length === 0) return NO_MATCH;

  const subject = normaliseUkAddress(`${input.address}, ${input.postcode}`);

  // Score every candidate (pure), then pick the best by score.
  const scored = records.map((r) => ({
    record: r,
    score: addressMatchScore(
      subject,
      normaliseUkAddress(`${r.address}, ${r.postcode ?? input.postcode}`),
    ),
  }));
  const best = scored.reduce((a, b) => (b.score > a.score ? b : a));

  if (classifyConfidence(best.score) === 'none') {
    return { ...NO_MATCH, candidatesConsidered: records.length };
  }

  // All sales at the winning address; take the most recent as the "last sale".
  const winningKey = best.record.address;
  const last = scored
    .filter((s) => s.record.address === winningKey)
    .sort((a, b) => b.record.date.localeCompare(a.record.date))[0]?.record;
  if (!last) return { ...NO_MATCH, candidatesConsidered: records.length };

  return {
    matchedAddress: last.address,
    lastSalePricePence: Math.round(last.price * 100),
    lastSaleDate: last.date || null,
    confidence: classifyConfidence(best.score),
    matchScore: Math.round(best.score * 100) / 100,
    candidatesConsidered: records.length,
  };
}

/** Test/maintenance hook: clear the per-process HMLR record cache. */
export function _clearHmlrMatchCache() {
  recordCache.clear();
}

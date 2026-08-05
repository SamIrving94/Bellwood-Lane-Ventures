/**
 * Two-track classification — which business a lead belongs to.
 *
 * `volume` — the high-volume sourcing business: smaller tickets, released to
 * investors for a fee. The default, and the only track the automated
 * sourcing gate applies to.
 *
 * `prime`  — high-value stock (~£700k+ purchase, ~£1M+ post-refurb exit,
 * architect-led) Kept buys for its own book. Scarce by nature, so prime
 * leads BYPASS the volume sourcing threshold: a human decides, not the gate.
 *
 * `block`  — multi-unit stock: blocks of flats, freehold buildings,
 * portfolios. Also bypasses the gate, and additionally survives the
 * "development site" drop and the commercial `unit` flag that would
 * otherwise discard or mis-badge it.
 *
 * The classification is deliberately keyword + threshold based (no LLM):
 * it runs on every sourced listing every day, and a false `prime` costs one
 * founder glance while a false `volume` silently buries a £1M opportunity —
 * so thresholds lean inclusive.
 */

export type DealTrackValue = 'volume' | 'prime' | 'block';

/**
 * Purchase price / estate value at which a lead stops being volume stock.
 * ~£700k under-market entry supports a ~£1M+ post-refurb exit in the
 * London/South-East prime patch.
 */
export const PRIME_MIN_VALUE_PENCE = 700_000_00;

/**
 * Multi-unit / portfolio language. Word-boundary matched and kept specific:
 * a single "flat" or "apartment" must NOT match — only language that implies
 * the whole building or several units is changing hands.
 */
const BLOCK_PATTERN =
  /\bblocks? of (?:\d+\s+)?(?:flats|apartments|maisonettes)\b|\bportfolio of\b|\bproperty portfolio\b|\bfreehold (?:block|building|investment)\b|\bentire (?:block|building)\b|\bwhole building\b|\b\d+\s*x\s*(?:flats|apartments|units)\b|\bself-contained (?:flats|units)\b|\bhmo\b|\bmulti[- ]unit\b|\bground rents?\b|\b\d+\s+(?:net\s+)?dwellings\b/i;

/** True when listing text reads as a whole block / portfolio, not one home. */
export function isBlockText(text: string | null | undefined): boolean {
  if (!text) return false;
  return BLOCK_PATTERN.test(text);
}

export function classifyTrack(input: {
  /** Asking/estate/guide value in pence, if known. */
  valuePence?: number | null;
  /** Any listing text — address, title, summary — concatenated is fine. */
  text?: string | null;
  propertyType?: string | null;
}): DealTrackValue {
  const haystack = [input.text ?? '', input.propertyType ?? ''].join(' ');
  if (isBlockText(haystack)) return 'block';
  if (
    typeof input.valuePence === 'number' &&
    input.valuePence >= PRIME_MIN_VALUE_PENCE
  ) {
    return 'prime';
  }
  return 'volume';
}

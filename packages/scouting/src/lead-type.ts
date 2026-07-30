/**
 * Lead-type derivation for listing-sourced leads.
 *
 * ## The bug this exists to fix
 *
 * `enrichLead` derives `leadType` like this:
 *
 *   leadTypeHint ?? (grantType === 'letters_of_administration'
 *     ? 'probate_admin'
 *     : 'probate')
 *
 * That default is correct for the probate feeds it was written for (HMCTS,
 * The Gazette) — everything arriving there really is a probate grant. But
 * PropertyData `/sourced-properties` rows arrive with `grantType: 'unknown'`
 * and no hint, so **every listing on the market silently collected the full
 * 20-point `probate` motivation credit** it had done nothing to earn.
 *
 * Two consequences, both bad:
 *
 *   1. A flat 20 points under every listing compresses the pre-appraisal
 *      distribution — leads stop being separable, which is what made the
 *      sourcing gate feel arbitrary in the first place.
 *   2. It is simply false. "This flat is listed for sale" is not evidence
 *      anybody died, and the whole sourcing thesis rests on motivation being
 *      real rather than assumed.
 *
 * ## What we do instead
 *
 * PropertyData tells us WHICH distress list a property came from, and that is
 * genuine (if weaker) motivation evidence. We map the list slug to the lead
 * type it actually implies, and fall back to `unknown` — never `probate` —
 * when the list says nothing about why the owner might sell.
 *
 * Deliberately conservative: where a list is ambiguous we take the weaker
 * reading. Under-crediting a real lead costs us one lead; over-crediting
 * every listing is what produced this bug.
 */

import type { SourcedListType } from '@repo/property-data/src/propertydata';

/**
 * PropertyData list slug → lead type, keyed to `ScorerConfig.leadTypeScores`.
 *
 * Every value here must be a real key in `leadTypeScores`, or the scorer
 * silently drops to `leadTypeFallback` — the exact failure mode that made
 * `probate_admin` score 4. There is a test asserting that.
 */
const LISTING_LEAD_TYPES: Record<SourcedListType, string> = {
  // Forced sale by a lender. The strongest motivation on the feed.
  'repossessed-properties': 'repossession',
  // The seller has self-declared they need speed.
  'quick-sale-properties': 'distressed_sale',
  // Sold at auction — a deliberate choice of certainty over price.
  'auction-properties': 'distressed_sale',
  // Unmortgageable, so the buyer pool collapses to cash. The owner is stuck
  // whether or not they are otherwise motivated.
  'cash-buyers-only-properties': 'distressed_sale',
  // A price cut is motivation, but the SIZE of the cut is already scored
  // separately (reductionCount / discountPercent). Crediting it again here
  // would double-count, so this earns only the weak generic credit.
  'reduced-properties': 'unknown',
  // Time on market is likewise already a scored signal (daysOnMarketBands).
  'slow-to-sell-properties': 'unknown',
  // A sale that fell through — most often a broken chain.
  'back-on-market': 'chain_break',
  // No onward chain: often an empty or inherited property, but equally often
  // just a landlord selling up. Weak on its own.
  'properties-with-no-chain': 'chain_break',
  // Condition signals. Derelict implies nobody is living there; unmodernised
  // only implies it is dated, which is a refurb opportunity, not motivation.
  'derelict-properties': 'empty_property',
  'unmodernised-properties': 'unknown',
  // Handled upstream by the short-lease scout, which sets its own hint and
  // carries per-lead lease data. Mapped for completeness.
  'short-lease-properties': 'lease_expiry',
  // An EPC problem is a cost the owner faces, not a reason to sell.
  'poor-epc-score': 'unknown',
};

/**
 * The lead type implied by a PropertyData list slug.
 *
 * Returns `'unknown'` for anything unrecognised — including new list slugs
 * PropertyData may add later. That is the safe direction: an unmapped list
 * gets the weak generic credit rather than inheriting whatever the previous
 * default happened to be.
 */
export function leadTypeForListing(
  listingType: string | null | undefined
): string {
  if (!listingType) return 'unknown';
  return LISTING_LEAD_TYPES[listingType as SourcedListType] ?? 'unknown';
}

/** Exposed for tests — the full slug → lead-type mapping. */
export const LISTING_LEAD_TYPE_MAP: Readonly<Record<string, string>> =
  LISTING_LEAD_TYPES;

/**
 * Motivation-signal vocabulary for the listing-text read (motivation-llm.ts).
 *
 * Kept in its own dependency-free module so the scorer can label factors
 * from it without pulling the LLM client (and its server-only imports)
 * into the pure scoring path or its tests.
 *
 * The vocabulary is CLOSED on purpose. The model may only pick from this
 * list, so a signal is either one we have decided means something or it
 * does not exist — no free-text categories drifting into the score.
 */

export const MOTIVATION_SIGNALS = [
  'executor_sale',
  'deceased_estate',
  'no_onward_chain',
  'cash_buyers_only',
  'quick_sale_wanted',
  'needs_modernisation',
  'tenant_in_situ',
  'vacant',
  'relocation',
  'divorce_separation',
  'repossession',
  'landlord_selling_up',
  'retirement_downsizing',
  'short_lease',
  'auction_previously',
] as const;

export type MotivationSignal = (typeof MOTIVATION_SIGNALS)[number];

/** Plain-English labels for factor lines and the lead page. */
export const MOTIVATION_SIGNAL_LABELS: Record<MotivationSignal, string> = {
  executor_sale: 'executor sale',
  deceased_estate: 'deceased estate',
  no_onward_chain: 'no onward chain',
  cash_buyers_only: 'cash buyers only',
  quick_sale_wanted: 'quick sale wanted',
  needs_modernisation: 'needs modernisation',
  tenant_in_situ: 'tenant in situ',
  vacant: 'vacant',
  relocation: 'relocation',
  divorce_separation: 'divorce or separation',
  repossession: 'repossession',
  landlord_selling_up: 'landlord selling up',
  retirement_downsizing: 'retirement or downsizing',
  short_lease: 'short lease',
  auction_previously: 'previously at auction',
};

/**
 * Lead types the read may propose. Every value MUST be a key of
 * `ScorerConfig.leadTypeScores`, or the scorer silently drops it to the
 * fallback — the same failure lead-type.ts guards against. Tested.
 */
export const MOTIVATION_LEAD_TYPES = [
  'probate',
  'chain_break',
  'distressed_sale',
  'repossession',
  'relocation',
  'divorce',
  'empty_property',
  'lease_expiry',
  'downsizing',
] as const;

export type MotivationLeadType = (typeof MOTIVATION_LEAD_TYPES)[number];

export type MotivationLevel = 'strong' | 'some' | 'none';

/** What the read stamps onto a lead. Stored verbatim on rawPayload. */
export interface MotivationRead {
  level: MotivationLevel;
  signals: MotivationSignal[];
  /** The seller reason the text states outright, if any. */
  leadType: MotivationLeadType | null;
  /** Short quote from the listing backing the call. */
  evidence: string;
}

/**
 * The lead type the lead should carry after the read: the proposed type
 * only when the text states it plainly (level 'strong') AND it earns more
 * acquisition points than the type the source list implied. Never
 * downgrades — a weak read costs nothing, a wrong upgrade costs a
 * shortlist slot.
 */
export function strongerLeadType(
  current: string,
  read: Pick<MotivationRead, 'level' | 'leadType'>,
  leadTypeScores: Record<string, number>,
  leadTypeFallback: number
): string {
  if (read.level !== 'strong' || !read.leadType) {
    return current;
  }
  const currentPts = leadTypeScores[current] ?? leadTypeFallback;
  const proposedPts = leadTypeScores[read.leadType] ?? leadTypeFallback;
  return proposedPts > currentPts ? read.leadType : current;
}

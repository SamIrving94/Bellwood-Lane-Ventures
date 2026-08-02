/**
 * The canonical seller-situation taxonomy for the public site.
 *
 * The UX review found three hand-maintained lists drifting apart (the Kept
 * Score form, the agent quick form, and the routing page). The API enum on
 * /api/quote is the contract; this module is the single place the site
 * spells it, so every surface imports from here and drift shows up as a
 * type error instead of a copy bug.
 *
 * The agent quick form keeps its own agent-phrased trigger labels ("Buyer
 * pulled out") because agents describe events, not categories — but its api
 * values are typed against this union.
 */

export type SituationValue =
  | 'chain_break'
  | 'probate'
  | 'repossession'
  | 'relocation'
  | 'short_lease'
  | 'problem_property'
  | 'other';

/** Canonical display labels, in default display order. */
export const SITUATIONS: Array<{ value: SituationValue; label: string }> = [
  { value: 'chain_break', label: 'Chain break' },
  { value: 'probate', label: 'Probate' },
  { value: 'relocation', label: 'Relocation' },
  { value: 'short_lease', label: 'Short lease' },
  { value: 'problem_property', label: 'Problem property' },
  { value: 'repossession', label: 'Repossession / LPA' },
  { value: 'other', label: 'Other / standard' },
];

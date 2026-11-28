/**
 * The seller situations Kept serves, as the live site names them
 * (apps/web/lib/site-map.ts, apps/web/lib/situation-content.ts).
 *
 * The live site wins (CLAUDE.md "Public promises"): `path` is the
 * situation's own page and `honest` is that page's own "who we're wrong
 * for" line, quoted as published. When a page changes, change this with it
 * (CLAUDE.md derived-docs table lists this package).
 */

export const SITUATIONS = [
  'inherited',
  'chain_break',
  'separation',
  'relocation',
  'problem_property',
  'care_or_health',
  'other',
] as const;

export type Situation = (typeof SITUATIONS)[number];

export interface SituationInfo {
  /** Plain-English name, as a seller would say it. */
  label: string;
  /** The situation's page on the live site. */
  path: string;
  /** The QuoteRequest.sellerSituation value the site's own forms use. */
  sellerSituation: string;
  /** The page's own honest line: when Kept is the wrong choice. */
  honest: string;
}

export const SITUATION_INFO: Record<Situation, SituationInfo> = {
  inherited: {
    label: 'An inherited home',
    path: '/probate',
    sellerSituation: 'probate',
    honest:
      'If the estate is under no time pressure, the property is in good condition, and the beneficiaries want every pound of value, a good local agent on the open market will very likely net more.',
  },
  chain_break: {
    label: 'A sale that fell through',
    path: '/chain-break',
    sellerSituation: 'chain_break',
    honest:
      'If your onward purchase is safe and you can put the house back on the market for a few more months, the open market will almost certainly get you a better price.',
  },
  separation: {
    label: 'A separation',
    path: '/separation',
    sellerSituation: 'other',
    honest:
      'If both of you want to maximise every pound and you can live with the wait and the viewings, a good local agent is the better route.',
  },
  relocation: {
    label: 'Moving away',
    path: '/relocation',
    sellerSituation: 'relocation',
    honest:
      'If the property is in excellent condition and high demand, and your move can absorb a few months of chain risk, a good high-street agent will very likely net you more.',
  },
  problem_property: {
    label: 'A property with a problem, or one that needs work',
    path: '/problem-property',
    sellerSituation: 'problem_property',
    honest:
      'If the issue is cosmetic and you have the money and the time, a modest refurbishment and a good local agent will very likely net you more than we will.',
  },
  care_or_health: {
    label: 'A move into care, or a change in health',
    path: '/your-situation',
    sellerSituation: 'other',
    honest:
      'If you can wait, and the house is in good shape, a good local agent will very likely net you more.',
  },
  other: {
    label: 'Something else',
    path: '/your-situation',
    sellerSituation: 'other',
    honest:
      'If you can wait, and the house is in good shape, a good local agent will very likely net you more.',
  },
};

/**
 * Who Kept is wrong for when debt is the problem, from the live site
 * (/why-we-wont-buy-any-home and /your-situation): a fast sale does not fix
 * a debt larger than the home is worth.
 */
export const DEBT_EXCEEDS_VALUE = {
  message:
    'You owe more than the property is likely to fetch. Selling fast does not solve the debt problem and may make it worse. Talk to StepChange or Citizens Advice first: they are free, and they will not judge.',
  freeHelp: {
    label: 'Talk to StepChange first (free debt advice)',
    url: 'https://www.stepchange.org',
  },
} as const;

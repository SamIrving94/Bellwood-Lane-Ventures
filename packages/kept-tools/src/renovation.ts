/**
 * Renovation cost estimate — light / full / heavy budget bands for a home,
 * from its floor area and any problems the user already knows about.
 *
 * Uses the same cost tables as the internal deal model and Keyhole
 * (@repo/valuation refurb.ts), so the plugin never quotes a number the
 * founders would not stand behind. Budget bands, not quotes. Never a value
 * for the home.
 */

import { FLAG_COST, estimateRefurb } from '@repo/valuation/src/refurb';
import { formatPounds } from './money';
import { SOURCES, type Source } from './sources';

/** Problems a user can tick. Keys match @repo/valuation FLAG_COST. */
export const KNOWN_ISSUES = {
  no_kitchen: 'No usable kitchen',
  no_bathroom: 'No usable bathroom',
  roof_damage: 'Roof damage',
  damp_visible: 'Visible damp',
  structural_concern: 'Structural concern (e.g. cracks, movement)',
  fire_damage: 'Fire damage',
  broken_windows: 'Broken or boarded windows',
  overgrown_garden: 'Overgrown garden',
} as const;

export type KnownIssue = keyof typeof KNOWN_ISSUES;

const LEVELS = [
  {
    key: 'light',
    condition: 'fair',
    label: 'Light cosmetic',
    covers: 'Decorating, flooring, tidy-up.',
  },
  {
    key: 'full',
    condition: 'tired',
    label: 'Full refurbishment',
    covers: 'New kitchen and bathroom, decoration, flooring.',
  },
  {
    key: 'heavy',
    condition: 'derelict',
    label: 'Heavy or structural',
    covers:
      'Major works, which may include rewiring, replumbing and structural repair.',
  },
] as const;

export interface RenovationInput {
  /** Floor area in m². Defaults to 75 m² (flagged) when unknown. */
  floorAreaSqm?: number | null;
  knownIssues?: KnownIssue[];
}

export interface RenovationBand {
  key: 'light' | 'full' | 'heavy';
  label: string;
  covers: string;
  /** Base work over the floor area, rounded to £100. */
  basePence: number;
  /** Base plus known-issue lines. */
  totalPence: number;
}

export interface RenovationEstimate {
  floorAreaSqm: number;
  assumedFloorArea: boolean;
  bands: RenovationBand[];
  issueLines: Array<{ label: string; pence: number }>;
  notes: string[];
  sources: Source[];
}

export function estimateRenovation(input: RenovationInput): RenovationEstimate {
  const issues = Array.from(new Set(input.knownIssues ?? [])).filter(
    (i): i is KnownIssue => i in KNOWN_ISSUES
  );
  const issueLines = issues
    .map((i) => ({ label: KNOWN_ISSUES[i], pence: FLAG_COST[i] ?? 0 }))
    .filter((l) => l.pence > 0);

  let floorAreaSqm = 0;
  let assumedFloorArea = true;
  const bands: RenovationBand[] = LEVELS.map((level) => {
    const base = estimateRefurb({
      condition: level.condition,
      floorAreaSqm: input.floorAreaSqm ?? null,
    });
    // The heavy base already includes a new kitchen and bathroom
    // (refurb.ts BASE_SUBSUMES_FITTINGS); estimateRefurb applies that
    // rule when it gets the flags, so ask it for the full total.
    const withIssues = estimateRefurb({
      condition: level.condition,
      floorAreaSqm: input.floorAreaSqm ?? null,
      flags: issues,
    });
    floorAreaSqm = base.floorAreaSqm;
    assumedFloorArea = base.assumedFloorArea;
    return {
      key: level.key,
      label: level.label,
      covers: level.covers,
      basePence: base.totalPence,
      totalPence: withIssues.totalPence,
    };
  });

  const notes = [
    'Budget bands, not quotes. Get quotes from local trades before deciding.',
    `Based on ${Math.round(floorAreaSqm)} m²${assumedFloorArea ? ' (assumed: no floor area given)' : ''}.`,
  ];
  if (issues.some((i) => i === 'no_kitchen' || i === 'no_bathroom')) {
    notes.push(
      'The heavy band already includes a new kitchen and bathroom, so it does not add them again.'
    );
  }
  if (issueLines.length > 0) {
    notes.push(
      `Includes ${issueLines.length} known issue${issueLines.length === 1 ? '' : 's'}: ${issueLines.map((l) => `${l.label} ${formatPounds(l.pence)}`).join(', ')}.`
    );
  }

  return {
    floorAreaSqm,
    assumedFloorArea,
    bands,
    issueLines,
    notes,
    sources: [SOURCES.refurbTables],
  };
}

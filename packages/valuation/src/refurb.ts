/**
 * Photo-driven refurb estimator (refurb.ts)
 *
 * Turns the vision screener's read of a property (condition + specific defect
 * flags + floor area) into a **transparent, line-by-line refurb estimate** —
 * so the deal model's refurb figure is a real, explainable starting number
 * rather than a flat "12% of value" guess the founder can't trust.
 *
 * The estimate is built two ways, both shown:
 *   1. A **base** cost = £/m² for the overall condition × floor area. This is
 *      the whole-property cosmetic/structural baseline (a tired flat needs a
 *      full cosmetic refurb; a derelict shell needs heavy works).
 *   2. **Defect line-items** for specific things the photos flagged (no
 *      kitchen, damp, roof damage, structural concern, …) that cost extra on
 *      top of the cosmetic baseline.
 *
 * Every number is returned as a labelled line so the UI can show exactly how
 * the total was built — the founder trusts it because he can see it, and edits
 * any line he disagrees with. All figures are founder-tunable starting points
 * (UK rule-of-thumb) and money is in PENCE.
 *
 * Pure module (no `server-only`) so the what-if UI can run it client-side.
 */

// ---------------------------------------------------------------------------
// Tunable cost tables (UK rule-of-thumb; calibrate against real jobs)
// ---------------------------------------------------------------------------

/** Whole-property base refurb cost per m², by the vision condition band. */
export const CONDITION_COST_PER_SQM: Record<string, number> = {
  pristine: 0,
  fair: 300_00, // light cosmetic — decorate, tidy
  tired: 550_00, // full cosmetic — new kitchen, bathroom, decor, flooring
  distressed: 850_00, // full refurb incl. some rewire/replumb
  derelict: 1_300_00, // heavy / structural
};

/** Fallback condition when the photos didn't yield one. */
export const DEFAULT_REFURB_CONDITION = 'tired';

/** Assumed floor area (m²) when EPC didn't give one — a modest UK flat/terrace. */
export const DEFAULT_FLOOR_AREA_SQM = 75;

/** Extra cost (pence) for a specific defect the photos flagged. */
export const FLAG_COST: Record<string, number> = {
  no_kitchen: 8_000_00,
  no_bathroom: 6_000_00,
  roof_damage: 12_000_00,
  damp_visible: 6_000_00,
  structural_concern: 20_000_00,
  fire_damage: 25_000_00,
  boarded_windows: 3_000_00,
  broken_windows: 3_000_00,
  squatting_signs: 4_000_00,
  overgrown_garden: 1_500_00,
  // recent_refurb is a positive signal, not a cost — no line.
};

const FLAG_LABELS: Record<string, string> = {
  no_kitchen: 'Missing kitchen',
  no_bathroom: 'Missing bathroom',
  roof_damage: 'Roof damage',
  damp_visible: 'Damp treatment',
  structural_concern: 'Structural works',
  fire_damage: 'Fire damage',
  boarded_windows: 'Boarded windows',
  broken_windows: 'Broken windows',
  squatting_signs: 'Clearance / security',
  overgrown_garden: 'Garden clearance',
};

// A missing kitchen / bathroom is already covered by the heavy base cost for
// distressed & derelict properties, so we don't double-count those defect lines
// at those condition levels.
const BASE_SUBSUMES_FITTINGS = new Set(['distressed', 'derelict']);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RefurbInput {
  /** Vision condition (pristine|fair|tired|distressed|derelict) or null. */
  condition?: string | null;
  /** Vision defect flags (e.g. ['no_kitchen','damp_visible']). */
  flags?: string[] | null;
  /** Internal floor area in m² (from EPC). Null → a default is assumed. */
  floorAreaSqm?: number | null;
}

export interface RefurbLine {
  label: string;
  pence: number;
}

export interface RefurbEstimate {
  /** Total refurb estimate, pence (rounded to the nearest £100). */
  totalPence: number;
  /** Every component, in order — the transparent "how we got this" breakdown. */
  lines: RefurbLine[];
  conditionUsed: string;
  floorAreaSqm: number;
  /** True when floorAreaSqm was defaulted (lowers confidence). */
  assumedFloorArea: boolean;
  /** One-line plain-English basis, ready to render. */
  basis: string;
}

// ---------------------------------------------------------------------------
// Estimator
// ---------------------------------------------------------------------------

function roundTo100Pounds(pence: number): number {
  return Math.round(pence / 10_000) * 10_000;
}

/** Founder-tunable cost overrides (from the saved valuation config). */
export interface RefurbConfig {
  perSqm?: Record<string, number>;
  flagCost?: Record<string, number>;
  defaultFloorAreaSqm?: number;
}

/**
 * Build a transparent refurb estimate from a photo-condition read. An optional
 * config overrides the default cost tables (so the in-app methodology page can
 * tune them).
 */
export function estimateRefurb(
  input: RefurbInput,
  config: RefurbConfig = {},
): RefurbEstimate {
  const perSqmTable = config.perSqm ?? CONDITION_COST_PER_SQM;
  const flagCostTable = config.flagCost ?? FLAG_COST;
  const defaultArea = config.defaultFloorAreaSqm ?? DEFAULT_FLOOR_AREA_SQM;

  const conditionUsed =
    input.condition && input.condition in perSqmTable
      ? input.condition
      : DEFAULT_REFURB_CONDITION;

  const assumedFloorArea =
    typeof input.floorAreaSqm !== 'number' || input.floorAreaSqm <= 0;
  const floorAreaSqm = assumedFloorArea
    ? defaultArea
    : (input.floorAreaSqm as number);

  const perSqm = perSqmTable[conditionUsed] ?? 0;
  const lines: RefurbLine[] = [];

  const basePence = Math.round(perSqm * floorAreaSqm);
  if (basePence > 0) {
    lines.push({
      label: `Base refurb · ${conditionUsed} · £${Math.round(perSqm / 100)}/m² × ${Math.round(floorAreaSqm)}m²`,
      pence: basePence,
    });
  }

  // Defect line-items from the photo flags.
  const flags = Array.isArray(input.flags) ? input.flags : [];
  const subsumeFittings = BASE_SUBSUMES_FITTINGS.has(conditionUsed);
  for (const flag of flags) {
    if (subsumeFittings && (flag === 'no_kitchen' || flag === 'no_bathroom')) {
      continue; // already in the heavy base cost
    }
    const cost = flagCostTable[flag];
    if (cost && cost > 0) {
      lines.push({ label: FLAG_LABELS[flag] ?? flag, pence: cost });
    }
  }

  const rawTotal = lines.reduce((sum, l) => sum + l.pence, 0);
  const totalPence = roundTo100Pounds(rawTotal);

  const flagCount = lines.length - (basePence > 0 ? 1 : 0);
  const areaText = assumedFloorArea
    ? `assumed ${floorAreaSqm}m² (no EPC floor area)`
    : `${Math.round(floorAreaSqm)}m²`;
  const basis =
    `From the photos: ${conditionUsed} condition over ${areaText}` +
    (flagCount > 0
      ? `, plus ${flagCount} flagged item${flagCount === 1 ? '' : 's'}.`
      : '.');

  return {
    totalPence,
    lines,
    conditionUsed,
    floorAreaSqm,
    assumedFloorArea,
    basis,
  };
}

/**
 * Tweakable valuation config (valuation-config.ts)
 *
 * The valuation engine has a handful of judgement-call levers — how much a
 * tired property is discounted, what a refurb costs per m², what specific
 * defects add, the target return. These used to be hard-coded constants. This
 * module lifts them into a typed, DB-storable config so the founder can tune
 * them from the in-app "Valuation methodology" page WITHOUT a code change, and
 * the numbers stay honest as real deals calibrate them.
 *
 * `DEFAULT_VALUATION_CONFIG` reproduces the hard-coded defaults exactly, so a
 * run with no saved config is unchanged. `mergeValuationConfig` defensively
 * deep-merges an untrusted partial (whatever the DB holds) over the defaults —
 * a malformed value falls back to the default rather than breaking valuation.
 *
 * Money is in PENCE throughout.
 */

import { CONDITION_DISCOUNTS, type ConditionLevel } from './gdv';
import {
  CONDITION_COST_PER_SQM,
  DEFAULT_FLOOR_AREA_SQM,
  FLAG_COST,
} from './refurb';

export interface ValuationConfig {
  /** As-is discount off the comp value, by deal-model condition level (GDV). */
  conditionDiscounts: Record<ConditionLevel, number>;
  /** Base refurb cost per m², by the vision condition band. */
  refurbPerSqm: Record<string, number>;
  /** Extra refurb cost (pence) for a specific photo-flagged defect. */
  refurbFlagCosts: Record<string, number>;
  /** Floor area (m²) assumed when EPC gives none. */
  defaultFloorAreaSqm: number;
  /** Target cash ROI the max-offer solver aims for (e.g. 0.20 = 20%). */
  targetCashRoi: number;
}

export const DEFAULT_VALUATION_CONFIG: ValuationConfig = {
  conditionDiscounts: { ...CONDITION_DISCOUNTS },
  refurbPerSqm: { ...CONDITION_COST_PER_SQM },
  refurbFlagCosts: { ...FLAG_COST },
  defaultFloorAreaSqm: DEFAULT_FLOOR_AREA_SQM,
  targetCashRoi: 0.2,
};

// ---------------------------------------------------------------------------
// Defensive merge of an untrusted partial over the defaults
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Merge numeric overrides for known keys only; unknown/bad values are dropped. */
function mergeNumberMap(
  base: Record<string, number>,
  raw: unknown,
  {
    min = 0,
    max = Number.POSITIVE_INFINITY,
  }: { min?: number; max?: number } = {}
): Record<string, number> {
  const out = { ...base };
  if (isRecord(raw)) {
    for (const key of Object.keys(base)) {
      const v = raw[key];
      if (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max) {
        out[key] = v;
      }
    }
  }
  return out;
}

function num(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
    ? value
    : fallback;
}

/**
 * Deep-merge a partial (untrusted) valuation config over the defaults.
 */
export function mergeValuationConfig(raw: unknown): ValuationConfig {
  const d = DEFAULT_VALUATION_CONFIG;
  if (!isRecord(raw)) return d;

  return {
    // Discounts are fractions 0–0.6.
    conditionDiscounts: mergeNumberMap(
      d.conditionDiscounts,
      raw.conditionDiscounts,
      {
        min: 0,
        max: 0.6,
      }
    ) as Record<ConditionLevel, number>,
    refurbPerSqm: mergeNumberMap(d.refurbPerSqm, raw.refurbPerSqm),
    refurbFlagCosts: mergeNumberMap(d.refurbFlagCosts, raw.refurbFlagCosts),
    defaultFloorAreaSqm: num(
      raw.defaultFloorAreaSqm,
      d.defaultFloorAreaSqm,
      10,
      1000
    ),
    targetCashRoi: num(raw.targetCashRoi, d.targetCashRoi, 0, 1),
  };
}

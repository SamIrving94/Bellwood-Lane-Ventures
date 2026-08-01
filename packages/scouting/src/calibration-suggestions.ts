/**
 * Calibration → concrete scorer-config suggestions.
 *
 * The calibration page already knows which scoring factors are over/under-
 * weighted (leads where a factor fired average ≤2.5★ or ≥4★). This module
 * closes the loop: it maps a biased factor LABEL back to the actual
 * ScorerConfig knob that produced it and proposes a specific new value, so
 * the founder can apply the change with one click instead of hand-editing
 * the config.
 *
 * Only unambiguous label → knob mappings produce suggestions — a factor we
 * can't trace to a single knob is skipped rather than guessed at. Nothing
 * here auto-applies; suggestions are evidence + a proposed value, and the
 * human activates them ("steps vs thoughts").
 */

import type { ScorerConfig } from './scorer-config';

export type SuggestionChange =
  | {
      kind: 'scalar';
      key:
        | 'distressBonus'
        | 'solicitorBonus'
        | 'lettersOfAdminBonus'
        | 'marriageValueBase'
        | 'velocityMax';
    }
  | { kind: 'leadType'; key: string }
  | { kind: 'condition'; key: string }
  | { kind: 'domBand'; label: string };

export type ScorerSuggestion = {
  change: SuggestionChange;
  /** Human title, e.g. "Trim 'Distressed sale signal' 5 → 4". */
  title: string;
  /** Evidence line, e.g. "Averages 2.1★ across 6 rated leads." */
  evidence: string;
  currentValue: number;
  suggestedValue: number;
  direction: 'trim' | 'raise';
};

export type FactorBiasRow = {
  label: string;
  appearances: number;
  avgRating: number;
  bias: 'over-weighted' | 'under-weighted' | 'aligned';
};

/** Mirror of the scorer's listing-type → display-label map (scorer.ts). */
const CONDITION_LABEL_TO_SLUG: Record<string, string> = {
  Derelict: 'derelict-properties',
  Unmodernised: 'unmodernised-properties',
  'Poor EPC': 'poor-epc-score',
  'Price reduced': 'reduced-properties',
  'Quick sale': 'quick-sale-properties',
  'Stale listing': 'slow-to-sell-properties',
};

/** Scalar factor labels emitted verbatim by the scorer. */
const SCALAR_LABELS: Record<
  string,
  Extract<SuggestionChange, { kind: 'scalar' }>['key']
> = {
  'Distressed sale signal': 'distressBonus',
  'Solicitor identified': 'solicitorBonus',
  'Letters of administration (unplanned)': 'lettersOfAdminBonus',
  'Short lease motivates sale (marriage value)': 'marriageValueBase',
};

/** leadTypeLabel() in scorer.ts: snake_case key → Title Case label. */
function labelToLeadTypeKey(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '_');
}

/** Resolve a factor label to the config knob that produced it, or null. */
function resolveKnob(
  label: string,
  config: ScorerConfig
): { change: SuggestionChange; currentValue: number } | null {
  const scalarKey = SCALAR_LABELS[label];
  if (scalarKey) {
    return {
      change: { kind: 'scalar', key: scalarKey },
      currentValue: config[scalarKey],
    };
  }

  if (label.startsWith('Accelerating price drops')) {
    return {
      change: { kind: 'scalar', key: 'velocityMax' },
      currentValue: config.velocityMax,
    };
  }

  // Days-on-market factors render as `${band.label} (${days}d)`.
  const domMatch = label.match(/^(.*) \(\d+d\)$/);
  if (domMatch?.[1]) {
    const bandLabel = domMatch[1];
    const band = config.daysOnMarketBands.find((b) => b.label === bandLabel);
    if (band && band.points > 0) {
      return {
        change: { kind: 'domBand', label: bandLabel },
        currentValue: band.points,
      };
    }
  }

  const conditionSlug = CONDITION_LABEL_TO_SLUG[label];
  if (conditionSlug && typeof config.conditionScores[conditionSlug] === 'number') {
    return {
      change: { kind: 'condition', key: conditionSlug },
      currentValue: config.conditionScores[conditionSlug],
    };
  }

  const leadTypeKey = labelToLeadTypeKey(label);
  if (typeof config.leadTypeScores[leadTypeKey] === 'number') {
    return {
      change: { kind: 'leadType', key: leadTypeKey },
      currentValue: config.leadTypeScores[leadTypeKey],
    };
  }

  return null;
}

/**
 * Propose a nudged value: ±25% rounded, always at least 1 point of change,
 * never below 0. Deliberately small steps — the loop iterates weekly, so
 * conservative nudges converge without oscillating.
 */
export function nudgeValue(current: number, direction: 'trim' | 'raise'): number {
  const step = Math.max(1, Math.round(Math.abs(current) * 0.25));
  const next = direction === 'trim' ? current - step : current + step;
  return Math.max(0, next);
}

/**
 * Build one-click suggestions from the calibration bias rows. Pure —
 * tested. Aligned factors and unmappable labels produce nothing.
 */
export function buildScorerSuggestions(
  rows: FactorBiasRow[],
  config: ScorerConfig
): ScorerSuggestion[] {
  const out: ScorerSuggestion[] = [];
  for (const row of rows) {
    if (row.bias === 'aligned') continue;
    const resolved = resolveKnob(row.label, config);
    if (!resolved) continue;

    const direction = row.bias === 'over-weighted' ? 'trim' : 'raise';
    const suggestedValue = nudgeValue(resolved.currentValue, direction);
    if (suggestedValue === resolved.currentValue) continue;

    out.push({
      change: resolved.change,
      title: `${direction === 'trim' ? 'Trim' : 'Raise'} "${row.label}" ${resolved.currentValue} → ${suggestedValue}`,
      evidence: `Leads with this factor average ${row.avgRating.toFixed(1)}★ across ${row.appearances} rating${row.appearances === 1 ? '' : 's'}.`,
      currentValue: resolved.currentValue,
      suggestedValue,
      direction,
    });
  }
  return out;
}

/**
 * Apply an accepted suggestion to a config, returning a NEW config object.
 * Used by the one-click apply action before saving a new EvalConfig version.
 */
export function applySuggestionChange(
  config: ScorerConfig,
  change: SuggestionChange,
  value: number
): ScorerConfig {
  const safe = Math.max(0, Math.round(value));
  switch (change.kind) {
    case 'scalar':
      return { ...config, [change.key]: safe };
    case 'leadType':
      return {
        ...config,
        leadTypeScores: { ...config.leadTypeScores, [change.key]: safe },
      };
    case 'condition':
      return {
        ...config,
        conditionScores: { ...config.conditionScores, [change.key]: safe },
      };
    case 'domBand':
      return {
        ...config,
        daysOnMarketBands: config.daysOnMarketBands.map((b) =>
          b.label === change.label ? { ...b, points: safe } : b
        ),
      };
    default:
      return config;
  }
}

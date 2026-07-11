/**
 * Scorer configuration (scorer-config.ts)
 *
 * The lead scorer's tunable weights, versionable via the `EvalConfig` table
 * (evalType = "lead_scoring") so the founder can retune WITHOUT a code change.
 *
 * MODEL (two-stage, two-pillar). The score answers the two questions the
 * business actually runs on, and every input is surfaced for transparency:
 *
 *   Pillar 1 — ACQUISITION LIKELIHOOD (cap 45): can we buy it cheap / will they
 *     deal? Driven by lead type (probate…), days on market, unmodernised
 *     condition, price reductions, chain-free/cash-only distress.
 *
 *   Pillar 2 — ROI / DEAL QUALITY (cap 40): how much do we make? Driven by the
 *     BMV discount (asking vs AVM market value) and the deal-model cash ROI.
 *     Only available AFTER appraisal, so it is added in a second stage.
 *
 *   Modifiers: market trend (cap 10) and risk (±10: flood/EPC/lease/planning).
 *
 * Contact quality is deliberately NOT scored — a strong deal with no phone
 * number yet is still a strong deal; contact readiness is surfaced separately.
 *
 * The golden/"hot probate window" recency bonus has been removed: grant-date
 * recency was an unreliable proxy for motivation.
 *
 * Design rules (unchanged): DEFAULT_SCORER_CONFIG is the single source of
 * truth; mergeScorerConfig deep-merges a partial, untrusted override and can
 * never crash the cron — a malformed value falls back to the default.
 */

export interface EquityBand {
  /** Inclusive lower bound on the metric. */
  minRatio: number;
  points: number;
  label: string;
}

export interface ScorerConfig {
  /** Per-pillar caps. Component scorers clamp to these. */
  dimensionCaps: {
    acquisition: number;
    roi: number;
    marketTrend: number;
    /** Risk is signed; clamped to [riskMin, riskMax]. */
    riskMin: number;
    riskMax: number;
  };

  // ── Pillar 1: acquisition likelihood ──────────────────────────────────
  /** Lead-type → points. Unknown types fall back to `leadTypeFallback`. */
  leadTypeScores: Record<string, number>;
  leadTypeFallback: number;
  /** Days-on-market bands (days → points), evaluated high → low. */
  daysOnMarketBands: EquityBand[];
  /** Condition/unmodernised points by PropertyData listing type. */
  conditionScores: Record<string, number>;
  /** Max points from price-reduction velocity. */
  velocityMax: number;
  /** Flat bonus for chain-free / cash-only / repossession distress signals. */
  distressBonus: number;
  /** Bonus when a solicitor/administrator is identified (probate execution). */
  solicitorBonus: number;
  /** Letters of administration = unplanned estate. */
  lettersOfAdminBonus: number;
  /** Short-lease marriage-value motivation (base + urgency-scaled). */
  marriageValueBase: number;
  marriageValueUrgencyMax: number;

  // ── Pillar 2: ROI / deal quality (applied at appraisal) ───────────────
  /** BMV discount bands: (1 - offer/AVM) as a %, high → low. */
  bmvBands: EquityBand[];
  /** Cash-ROI bands: deal-model cash ROI as a %, high → low. */
  roiBands: EquityBand[];
  /** Fallback equity bands (estate value ÷ area avg) used pre-appraisal. */
  equityBands: EquityBand[];
  equityNoComparable: number;

  /**
   * Confidence gate on the ROI pillar. A thin/low-confidence AVM makes the BMV
   * discount and cash ROI unreliable, so its credit is multiplied down (and a
   * 0-comp AVM earns none) — this stops a lead reading STRONG off one comp.
   */
  roiConfidenceMultiplier: { high: number; medium: number; low: number };

  // ── Modifiers ─────────────────────────────────────────────────────────
  marketTrend: { rising: number; stable: number; declining: number; unknown: number };

  /** Total-score thresholds for the verdict bands (evaluated high → low). */
  verdictThresholds: { strong: number; viable: number; thin: number };
}

export const DEFAULT_SCORER_CONFIG: ScorerConfig = {
  dimensionCaps: {
    acquisition: 45,
    roi: 40,
    marketTrend: 10,
    riskMin: -10,
    riskMax: 10,
  },

  // Pillar 1 — acquisition likelihood
  leadTypeScores: {
    probate: 20,
    repossession: 18,
    distressed_sale: 18,
    mortgage_default: 16,
    divorce: 14,
    lease_expiry: 14,
    empty_property: 12,
    chain_break: 11,
    downsizing: 9,
    relocation: 8,
    unknown: 4,
  },
  leadTypeFallback: 4,
  daysOnMarketBands: [
    { minRatio: 180, points: 12, label: 'On market 180+ days (very stale)' },
    { minRatio: 90, points: 8, label: 'On market 90+ days (stale)' },
    { minRatio: 60, points: 4, label: 'On market 60+ days' },
    { minRatio: 0, points: 0, label: 'Freshly listed' },
  ],
  conditionScores: {
    'derelict-properties': 10,
    'unmodernised-properties': 10,
    'poor-epc-score': 6,
    'reduced-properties': 5,
    'quick-sale-properties': 5,
    'slow-to-sell-properties': 4,
  },
  velocityMax: 6,
  distressBonus: 5,
  solicitorBonus: 4,
  lettersOfAdminBonus: 3,
  marriageValueBase: 10,
  marriageValueUrgencyMax: 8,

  // Pillar 2 — ROI / deal quality
  bmvBands: [
    { minRatio: 20, points: 25, label: '≥20% below market' },
    { minRatio: 15, points: 20, label: '15–20% below market' },
    { minRatio: 10, points: 14, label: '10–15% below market' },
    { minRatio: 5, points: 8, label: '5–10% below market' },
    { minRatio: 0, points: 3, label: 'At/just below market' },
  ],
  roiBands: [
    { minRatio: 25, points: 15, label: 'Cash ROI ≥25%' },
    { minRatio: 20, points: 12, label: 'Cash ROI 20–25%' },
    { minRatio: 15, points: 8, label: 'Cash ROI 15–20%' },
    { minRatio: 10, points: 4, label: 'Cash ROI 10–15%' },
    { minRatio: 0, points: 0, label: 'Cash ROI <10%' },
  ],
  equityBands: [
    { minRatio: 1.5, points: 15, label: 'Strong equity (1.5× area average)' },
    { minRatio: 1.2, points: 12, label: 'Solid equity (1.2× area average)' },
    { minRatio: 1.0, points: 9, label: 'Equity at area average' },
    { minRatio: 0.75, points: 6, label: 'Borderline equity (75% of area)' },
    { minRatio: 0.5, points: 3, label: 'Thin equity (50% of area)' },
    { minRatio: 0, points: 1, label: 'Low equity vs area average' },
  ],
  equityNoComparable: 4,

  roiConfidenceMultiplier: { high: 1, medium: 0.6, low: 0.3 },

  // Modifiers
  marketTrend: { rising: 10, stable: 6, declining: 3, unknown: 5 },

  verdictThresholds: { strong: 70, viable: 50, thin: 30 },
};

// ─────────────────────────────────────────────────────────────────────────
// Safe partial-merge of an untrusted JSON config over the defaults.
// ─────────────────────────────────────────────────────────────────────────

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeNumberMap(
  raw: unknown,
  base: Record<string, number>,
): Record<string, number> {
  const out = { ...base };
  if (isRecord(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    }
  }
  return out;
}

function mergeBands(raw: unknown, base: EquityBand[]): EquityBand[] {
  if (!Array.isArray(raw)) return base;
  const parsed = raw
    .filter(
      (b): b is Record<string, unknown> =>
        isRecord(b) &&
        typeof b.minRatio === 'number' &&
        typeof b.points === 'number',
    )
    .map((b) => ({
      minRatio: b.minRatio as number,
      points: b.points as number,
      label: typeof b.label === 'string' ? b.label : 'band',
    }))
    .sort((a, b) => b.minRatio - a.minRatio);
  return parsed.length > 0 ? parsed : base;
}

/**
 * Deep-merge a partial (untrusted) config over DEFAULT_SCORER_CONFIG. Every
 * field is read defensively so a malformed DB config degrades to defaults
 * rather than throwing.
 */
export function mergeScorerConfig(raw: unknown): ScorerConfig {
  const d = DEFAULT_SCORER_CONFIG;
  if (!isRecord(raw)) return d;

  const caps = isRecord(raw.dimensionCaps) ? raw.dimensionCaps : {};
  const mt = isRecord(raw.marketTrend) ? raw.marketTrend : {};
  const vt = isRecord(raw.verdictThresholds) ? raw.verdictThresholds : {};
  const rcm = isRecord(raw.roiConfidenceMultiplier) ? raw.roiConfidenceMultiplier : {};

  return {
    dimensionCaps: {
      acquisition: num(caps.acquisition, d.dimensionCaps.acquisition),
      roi: num(caps.roi, d.dimensionCaps.roi),
      marketTrend: num(caps.marketTrend, d.dimensionCaps.marketTrend),
      riskMin: num(caps.riskMin, d.dimensionCaps.riskMin),
      riskMax: num(caps.riskMax, d.dimensionCaps.riskMax),
    },
    leadTypeScores: mergeNumberMap(raw.leadTypeScores, d.leadTypeScores),
    leadTypeFallback: num(raw.leadTypeFallback, d.leadTypeFallback),
    daysOnMarketBands: mergeBands(raw.daysOnMarketBands, d.daysOnMarketBands),
    conditionScores: mergeNumberMap(raw.conditionScores, d.conditionScores),
    velocityMax: num(raw.velocityMax, d.velocityMax),
    distressBonus: num(raw.distressBonus, d.distressBonus),
    solicitorBonus: num(raw.solicitorBonus, d.solicitorBonus),
    lettersOfAdminBonus: num(raw.lettersOfAdminBonus, d.lettersOfAdminBonus),
    marriageValueBase: num(raw.marriageValueBase, d.marriageValueBase),
    marriageValueUrgencyMax: num(
      raw.marriageValueUrgencyMax,
      d.marriageValueUrgencyMax,
    ),
    bmvBands: mergeBands(raw.bmvBands, d.bmvBands),
    roiBands: mergeBands(raw.roiBands, d.roiBands),
    equityBands: mergeBands(raw.equityBands, d.equityBands),
    equityNoComparable: num(raw.equityNoComparable, d.equityNoComparable),
    roiConfidenceMultiplier: {
      high: num(rcm.high, d.roiConfidenceMultiplier.high),
      medium: num(rcm.medium, d.roiConfidenceMultiplier.medium),
      low: num(rcm.low, d.roiConfidenceMultiplier.low),
    },
    marketTrend: {
      rising: num(mt.rising, d.marketTrend.rising),
      stable: num(mt.stable, d.marketTrend.stable),
      declining: num(mt.declining, d.marketTrend.declining),
      unknown: num(mt.unknown, d.marketTrend.unknown),
    },
    verdictThresholds: {
      strong: num(vt.strong, d.verdictThresholds.strong),
      viable: num(vt.viable, d.verdictThresholds.viable),
      thin: num(vt.thin, d.verdictThresholds.thin),
    },
  };
}

/**
 * Scorer configuration (scorer-config.ts)
 *
 * The lead scorer used to hard-code every weight and threshold. This module
 * extracts the dominant tunable levers into a typed, versionable config so the
 * `EvalConfig` table (evalType = "lead_scoring") can override them WITHOUT a
 * code change — closing the feedback loop between the calibration page and the
 * live scorer.
 *
 * Design rules:
 *  - `DEFAULT_SCORER_CONFIG` reproduces the previous hard-coded behaviour
 *    EXACTLY, so a run with no active config is byte-for-byte unchanged.
 *  - `mergeScorerConfig` deep-merges a *partial* override (whatever shape the
 *    DB happens to hold) over the defaults. Unknown / malformed keys are
 *    ignored — a bad config can never crash the cron, only no-op.
 *  - Only the high-leverage knobs are exposed (lead-type weights, golden
 *    window, equity bands, market trend, contact, dimension caps, verdict
 *    thresholds). Fine-grained risk/velocity sub-bands stay internal to the
 *    scorer; they refine within a cap and aren't worth versioning yet.
 */

export interface EquityBand {
  /** Inclusive lower bound on (estateValue / areaAverage). */
  minRatio: number;
  points: number;
  label: string;
}

export interface ScorerConfig {
  /** Per-dimension caps. The component scorers clamp to these. */
  dimensionCaps: {
    motivation: number;
    equity: number;
    marketTrend: number;
    contactQuality: number;
    /** Risk is signed; it's clamped to [riskMin, riskMax]. */
    riskMin: number;
    riskMax: number;
  };
  /** Lead-type → motivation points. Unknown types fall back to `leadTypeFallback`. */
  leadTypeScores: Record<string, number>;
  leadTypeFallback: number;
  /** Golden-window probate timing bonus. */
  goldenWindow: {
    hot: number;
    warm: number;
    cool: number;
  };
  /** Motivation bonuses for estate-context signals. */
  solicitorBonus: number;
  lettersOfAdminBonus: number;
  /** Equity vs area-average bands, evaluated high → low (first match wins). */
  equityBands: EquityBand[];
  /** Equity points when an estate value exists but there's no area comparable. */
  equityNoComparable: number;
  /** Market-trend (HPI) points by trend label. */
  marketTrend: {
    rising: number;
    stable: number;
    declining: number;
    unknown: number;
  };
  /** Contact-quality points per available channel. */
  contact: {
    name: number;
    phone: number;
    email: number;
  };
  /** Total-score thresholds for the verdict bands (evaluated high → low). */
  verdictThresholds: {
    strong: number;
    viable: number;
    thin: number;
  };
}

export const DEFAULT_SCORER_CONFIG: ScorerConfig = {
  dimensionCaps: {
    motivation: 40,
    equity: 25,
    marketTrend: 15,
    contactQuality: 10,
    riskMin: -10,
    riskMax: 10,
  },
  leadTypeScores: {
    probate: 25,
    distressed_sale: 22,
    mortgage_default: 20,
    lease_expiry: 18,
    divorce: 18,
    repossession: 22,
    empty_property: 15,
    downsizing: 12,
    chain_break: 14,
    relocation: 10,
    unknown: 5,
  },
  leadTypeFallback: 5,
  goldenWindow: { hot: 12, warm: 8, cool: 4 },
  solicitorBonus: 5,
  lettersOfAdminBonus: 3,
  equityBands: [
    { minRatio: 1.5, points: 25, label: 'Strong equity (1.5× area average)' },
    { minRatio: 1.2, points: 20, label: 'Solid equity (1.2× area average)' },
    { minRatio: 1.0, points: 15, label: 'Equity at area average' },
    { minRatio: 0.75, points: 10, label: 'Borderline equity (75% of area)' },
    { minRatio: 0.5, points: 5, label: 'Thin equity (50% of area)' },
    { minRatio: 0, points: 2, label: 'Low equity vs area average' },
  ],
  equityNoComparable: 6,
  marketTrend: { rising: 15, stable: 10, declining: 6, unknown: 7 },
  contact: { name: 3, phone: 4, email: 3 },
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

/**
 * Deep-merge a partial (untrusted) config over DEFAULT_SCORER_CONFIG.
 * Every field is read defensively: a missing or wrong-typed value falls back
 * to the default, so a malformed DB config degrades to default behaviour
 * rather than throwing.
 */
export function mergeScorerConfig(raw: unknown): ScorerConfig {
  const d = DEFAULT_SCORER_CONFIG;
  if (!isRecord(raw)) return d;

  const caps = isRecord(raw.dimensionCaps) ? raw.dimensionCaps : {};
  const gw = isRecord(raw.goldenWindow) ? raw.goldenWindow : {};
  const mt = isRecord(raw.marketTrend) ? raw.marketTrend : {};
  const contact = isRecord(raw.contact) ? raw.contact : {};
  const vt = isRecord(raw.verdictThresholds) ? raw.verdictThresholds : {};

  // Lead-type scores: merge keys over the defaults, keep only numeric values.
  const leadTypeScores: Record<string, number> = { ...d.leadTypeScores };
  if (isRecord(raw.leadTypeScores)) {
    for (const [k, v] of Object.entries(raw.leadTypeScores)) {
      if (typeof v === 'number' && Number.isFinite(v)) leadTypeScores[k] = v;
    }
  }

  // Equity bands: only accept a well-formed array; otherwise keep defaults.
  let equityBands = d.equityBands;
  if (Array.isArray(raw.equityBands)) {
    const parsed = raw.equityBands
      .filter(
        (b): b is Record<string, unknown> =>
          isRecord(b) &&
          typeof b.minRatio === 'number' &&
          typeof b.points === 'number',
      )
      .map((b) => ({
        minRatio: b.minRatio as number,
        points: b.points as number,
        label: typeof b.label === 'string' ? b.label : 'Equity vs area average',
      }))
      .sort((a, b) => b.minRatio - a.minRatio);
    if (parsed.length > 0) equityBands = parsed;
  }

  return {
    dimensionCaps: {
      motivation: num(caps.motivation, d.dimensionCaps.motivation),
      equity: num(caps.equity, d.dimensionCaps.equity),
      marketTrend: num(caps.marketTrend, d.dimensionCaps.marketTrend),
      contactQuality: num(caps.contactQuality, d.dimensionCaps.contactQuality),
      riskMin: num(caps.riskMin, d.dimensionCaps.riskMin),
      riskMax: num(caps.riskMax, d.dimensionCaps.riskMax),
    },
    leadTypeScores,
    leadTypeFallback: num(raw.leadTypeFallback, d.leadTypeFallback),
    goldenWindow: {
      hot: num(gw.hot, d.goldenWindow.hot),
      warm: num(gw.warm, d.goldenWindow.warm),
      cool: num(gw.cool, d.goldenWindow.cool),
    },
    solicitorBonus: num(raw.solicitorBonus, d.solicitorBonus),
    lettersOfAdminBonus: num(raw.lettersOfAdminBonus, d.lettersOfAdminBonus),
    equityBands,
    equityNoComparable: num(raw.equityNoComparable, d.equityNoComparable),
    marketTrend: {
      rising: num(mt.rising, d.marketTrend.rising),
      stable: num(mt.stable, d.marketTrend.stable),
      declining: num(mt.declining, d.marketTrend.declining),
      unknown: num(mt.unknown, d.marketTrend.unknown),
    },
    contact: {
      name: num(contact.name, d.contact.name),
      phone: num(contact.phone, d.contact.phone),
      email: num(contact.email, d.contact.email),
    },
    verdictThresholds: {
      strong: num(vt.strong, d.verdictThresholds.strong),
      viable: num(vt.viable, d.verdictThresholds.viable),
      thin: num(vt.thin, d.verdictThresholds.thin),
    },
  };
}

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
 * TWO THRESHOLDS, TWO JOBS. `verdictThresholds` band a COMPLETE score and are
 * only meaningful once the ROI pillar is real (post-appraisal). The scouting
 * pipeline's keep/drop decision happens BEFORE that, so it uses its own
 * `sourcingThreshold` against the normalised `sourcingScore` — see the field
 * docs below and ScoreBreakdown.sourcingScore in scorer.ts.
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
  /**
   * Acquisition penalty for a non-residential listing (pub, shop, office,
   * restaurant, warehouse). Negative. The scout already detects these and
   * badges them, but the signal never reached the scorer, so a pub competed
   * for a shortlist slot on equal terms with a three-bed semi.
   */
  commercialPenalty: number;
  /** Short-lease marriage-value motivation (base + urgency-scaled). */
  marriageValueBase: number;
  marriageValueUrgencyMax: number;

  // ── Pillar 2: ROI / deal quality (applied at appraisal) ───────────────
  /** BMV discount bands: (1 - offer/AVM) as a %, high → low. */
  bmvBands: EquityBand[];
  /** Cash-ROI bands: deal-model cash ROI as a %, high → low. */
  roiBands: EquityBand[];
  /** Fallback equity bands (estate value ÷ area avg) used pre-appraisal. */
  /**
   * Two-sided pre-appraisal ROI proxy (replaced the monotonic equity bands,
   * 6 Sep 2026 — founder: "this is wild"). The old bands scored a lead's
   * value AGAINST the area average rising: 1.5× the street earned 15 points
   * while 40% UNDER the street earned 3 — five-to-one the wrong way round
   * for a business whose whole thesis is buying below the street. Points by
   * position, all founder-tunable:
   *
   *  - ABOVE the area: modest equity credit (real, but no discount thesis).
   *  - BELOW the area WITH condition evidence (modernisation signal or an
   *    unmodernised/derelict/poor-EPC badge): the deeper the discount, the
   *    more points — this is the thesis as a number.
   *  - BELOW the area with NO evidence: low points and the honest
   *    "check why" label — an unexplained discount is the pattern that
   *    hides an unfixable problem (bad plot, railway, short lease).
   *  - FAR below (under 40% of the street, the classifyTrack house-shape
   *    floor): a token, whatever the evidence — that price is usually a
   *    flat or a plot wearing a house's postcode, not comparable stock.
   */
  equityProxy: {
    /** Ratio ≥ 1.2 — clearly above the street. */
    aboveAreaHigh: number;
    /** Ratio 1.05–1.2. */
    aboveArea: number;
    /** Ratio 0.95–1.05 — parity; the comparable confirms the value. */
    nearArea: number;
    /** ≥5% below the street, condition evidence present. */
    discountEdge: number;
    /** ≥15% below, evidence present. */
    discountSolid: number;
    /** ≥30% below, evidence present — the gold-dust shape. */
    discountDeep: number;
    /** ≥5% below with NO condition evidence — the check-why case. */
    discountNoReason: number;
    /** Ratio < 0.40 — likely not comparable stock, whatever the evidence. */
    notComparableFloor: number;
  };
  equityNoComparable: number;

  /**
   * Confidence gate on the ROI pillar. A thin/low-confidence AVM makes the BMV
   * discount and cash ROI unreliable, so its credit is multiplied down (and a
   * 0-comp AVM earns none) — this stops a lead reading STRONG off one comp.
   */
  roiConfidenceMultiplier: { high: number; medium: number; low: number };

  // ── Modifiers ─────────────────────────────────────────────────────────
  marketTrend: {
    rising: number;
    stable: number;
    declining: number;
    unknown: number;
  };

  /** Total-score thresholds for the verdict bands (evaluated high → low). */
  verdictThresholds: { strong: number; viable: number; thin: number };

  /**
   * Sourcing gate — the minimum NORMALISED pre-appraisal score (0–100) a lead
   * must clear to be kept by the scouting pipeline.
   *
   * Deliberately NOT one of `verdictThresholds`. Those bands describe a fully
   * scored lead: post-appraisal all ~95 earnable points are live. At sourcing
   * the ROI pillar (cap 40) is structurally blank — there is no AVM yet — so
   * comparing a raw sourcing total against a post-appraisal band gates on
   * MISSING DATA rather than lead quality. In practice two identical leads
   * landed either side of the old score-30 cut purely on whether their postcode
   * happened to have HM Land Registry price-paid data (9 points of equity proxy
   * vs the 4-point no-comparable stub).
   *
   * The gate therefore compares `ScoreBreakdown.sourcingScore` — the total
   * renormalised onto the points that were actually earnable for that lead.
   *
   * 50 is calibrated, not picked: a lead carrying NOTHING but its lead-type
   * credit and an unknown market normalises to 49 whatever data existed for it
   * (20 + 4 stub out of 59 achievable = 49; 20 + 9 area-average band out of 70
   * = 49). So 50 is exactly the line "must be better than a lead we know
   * nothing about", and it is the point at which the with-comparable and
   * without-comparable curves cross — i.e. where price-paid availability has
   * the least influence on the decision. On the synthetic population in
   * __tests__/sourcing-gate-volume.test.ts it holds volume at ~parity with the
   * old raw-30 gate, so the appraisal bill does not move.
   */
  sourcingThreshold: number;
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
    // Letters of administration — died intestate, no will. `enrichLead` has
    // always emitted this leadType, but it was never a key here, so it fell
    // through to `leadTypeFallback: 4` and the highest-intent probate cohort
    // scored lowest of all. Set level with `probate`; the separate
    // `lettersOfAdminBonus` is what lifts it above, as designed.
    probate_admin: 20,
    // Receiver/administrator MUST sell — the most motivated vendor class.
    receivership: 19,
    repossession: 18,
    distressed_sale: 18,
    mortgage_default: 16,
    divorce: 14,
    lease_expiry: 14,
    empty_property: 12,
    // Consented-but-unbuilt brownfield site, years past grant: the owner
    // paid for a permission they haven't used. Moderate — stalled is not
    // always selling.
    lapsing_consent: 12,
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
  commercialPenalty: -12,
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
  // The ladder, deliberately: explained discounts (10/12/15) sit ABOVE
  // parity (9), which sits above premium pricing (6/8) — an at-average
  // comparable CONFIRMS the value (that 9 also keeps the sourcing-gate
  // normalisation calibrated, see scorer-sourcing-score.test.ts), while an
  // above-average asking is unproven premium. Unexplained discounts (3)
  // and sub-40% prices (2) stay near the floor.
  equityProxy: {
    aboveAreaHigh: 8,
    aboveArea: 6,
    nearArea: 9,
    discountEdge: 10,
    discountSolid: 12,
    discountDeep: 15,
    discountNoReason: 3,
    notComparableFloor: 2,
  },
  equityNoComparable: 4,

  roiConfidenceMultiplier: { high: 1, medium: 0.6, low: 0.3 },

  // Modifiers
  marketTrend: { rising: 10, stable: 6, declining: 3, unknown: 5 },

  verdictThresholds: { strong: 70, viable: 50, thin: 30 },

  sourcingThreshold: 50,
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
  base: Record<string, number>
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
        typeof b.points === 'number'
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
  const rcm = isRecord(raw.roiConfidenceMultiplier)
    ? raw.roiConfidenceMultiplier
    : {};

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
    commercialPenalty: num(raw.commercialPenalty, d.commercialPenalty),
    marriageValueBase: num(raw.marriageValueBase, d.marriageValueBase),
    marriageValueUrgencyMax: num(
      raw.marriageValueUrgencyMax,
      d.marriageValueUrgencyMax
    ),
    bmvBands: mergeBands(raw.bmvBands, d.bmvBands),
    roiBands: mergeBands(raw.roiBands, d.roiBands),
    equityProxy: (() => {
      const ep = isRecord(raw.equityProxy) ? raw.equityProxy : {};
      return {
        aboveAreaHigh: num(ep.aboveAreaHigh, d.equityProxy.aboveAreaHigh),
        aboveArea: num(ep.aboveArea, d.equityProxy.aboveArea),
        nearArea: num(ep.nearArea, d.equityProxy.nearArea),
        discountEdge: num(ep.discountEdge, d.equityProxy.discountEdge),
        discountSolid: num(ep.discountSolid, d.equityProxy.discountSolid),
        discountDeep: num(ep.discountDeep, d.equityProxy.discountDeep),
        discountNoReason: num(
          ep.discountNoReason,
          d.equityProxy.discountNoReason
        ),
        notComparableFloor: num(
          ep.notComparableFloor,
          d.equityProxy.notComparableFloor
        ),
      };
    })(),
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
    // Read defensively like every other field: rows written before the sourcing
    // gate existed simply have no `sourcingThreshold` key, and must keep merging
    // to the default rather than producing an undefined gate (which would let
    // every scored lead through).
    sourcingThreshold: num(raw.sourcingThreshold, d.sourcingThreshold),
  };
}

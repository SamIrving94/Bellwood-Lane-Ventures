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
 * The old golden/"hot probate window" recency bonus (fresher = hotter) was
 * removed as an unreliable proxy. Its successor is `propensityCurves`: per-
 * lead-type curves anchored on the UK statutory timelines (founder research,
 * Aug 2026), which say the OPPOSITE for probate — a fresh notice is a seller
 * who legally cannot sell yet; the window opens weeks 8–16 later.
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

/**
 * One breakpoint on a per-lead-type propensity curve. Curves are evaluated by
 * `propensityForLeadType` (propensity.ts): linear interpolation between
 * breakpoints, first/last value held beyond the ends, and the `label` of the
 * latest breakpoint at-or-before the day is the phase the founder sees
 * ("Entering the grant window").
 */
export interface PropensityBreakpoint {
  /** Days since the lead's t=0 signal (Gazette notice / insolvency filing / receiver appointment). */
  day: number;
  /** Propensity to transact, 0–1. Scaled by `propensityMax` into acquisition points. */
  value: number;
  /** Founder-facing phase label — shown verbatim as the score-factor "why". */
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

  /**
   * Statutory-timeline propensity curves (founder research, Aug 2026), keyed
   * by leadType. These time ATTENTION and OUTREACH — never capture: the
   * factor they feed is additive-only (0 points at low propensity), so a
   * freshly-noticed lead scores exactly what it scored before curves existed
   * and can never be pushed under the sourcing gate for being early.
   *
   * t=0 anchors: probate = Gazette s.27 notice date; insolvency = the
   * appointment/filing date; receivership = the appointment notice date.
   *
   * CALIBRATION CAVEAT (probate): a s.27 notice may be placed before OR
   * after the Grant of Probate, so "weeks 8–16 after notice" is a
   * statutory-timeline prior, not a measured fact about our leads. Verify
   * the shape against our own daysSinceSignal-at-conversion data (logged on
   * lead→deal conversion) before trusting it hard.
   */
  propensityCurves: Record<string, PropensityBreakpoint[]>;
  /** Acquisition points at propensity 1.0 (moderate — below leadType credit). */
  propensityMax: number;
  /**
   * Propensity at/above which a lead counts as IN its high-propensity window
   * — the line the resurfacing cron watches for leads crossing upward.
   */
  propensityHighThreshold: number;

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
    // Companies House insolvency/administration filing. Split out from
    // `distressed_sale` (same weight, so no score change) because it runs on
    // a statutory clock — the Insolvency Act proposal deadline and 12-month
    // cap — which the propensity curve below keys on. Quick-sale listings,
    // which still map to `distressed_sale`, have no such clock and their
    // `daysSinceGrant` is really days-on-market.
    insolvency: 18,
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

  // Statutory-timeline propensity curves (founder research, Aug 2026).
  // Values are 0–1; days are since the lead-type's t=0 signal. Linear
  // interpolation between rows; the label of the latest row at-or-before the
  // day is the phase shown to the founder.
  propensityCurves: {
    // t=0 = Gazette s.27 notice. Weeks 0–6 the executor has no legal
    // authority to sell (no Grant yet); the Grant typically lands weeks
    // 8–16 after notice; estates realise through months 6–9, then decay.
    // See the calibration caveat on the interface — the notice/Grant
    // ordering is unverified against our own conversions.
    probate: [
      { day: 0, value: 0.05, label: 'Pre-grant — executor cannot yet sell' },
      { day: 42, value: 0.1, label: 'Pre-grant — executor cannot yet sell' },
      { day: 56, value: 0.45, label: 'Entering the grant window' },
      { day: 112, value: 1, label: 'Grant window — estate can now sell' },
      { day: 180, value: 0.95, label: 'Estate realisation plateau' },
      { day: 270, value: 0.8, label: 'Estate realisation plateau' },
      { day: 365, value: 0.4, label: 'Cooling — estate likely resolved' },
      { day: 540, value: 0.15, label: 'Cold — estate long resolved' },
    ],
    // Letters of administration follow the same grant machinery (the grant
    // of letters replaces the grant of probate). Separate key so it can be
    // tuned apart if intestate estates prove to move differently.
    probate_admin: [
      {
        day: 0,
        value: 0.05,
        label: 'Pre-grant — administrator not yet appointed',
      },
      {
        day: 42,
        value: 0.1,
        label: 'Pre-grant — administrator not yet appointed',
      },
      { day: 56, value: 0.45, label: 'Entering the grant window' },
      { day: 112, value: 1, label: 'Grant window — estate can now sell' },
      { day: 180, value: 0.95, label: 'Estate realisation plateau' },
      { day: 270, value: 0.8, label: 'Estate realisation plateau' },
      { day: 365, value: 0.4, label: 'Cooling — estate likely resolved' },
      { day: 540, value: 0.15, label: 'Cold — estate long resolved' },
    ],
    // t=0 = appointment/filing. Two peaks: ~week 3 (strategy forms once the
    // moratorium settles) and week 8 (the Insolvency Act statutory proposal
    // deadline — disposal decisions get made to hit it). Administration is
    // capped at 12 months, so propensity tails off toward day 365.
    insolvency: [
      { day: 0, value: 0.25, label: 'Moratorium — administrator taking stock' },
      { day: 21, value: 0.8, label: 'Post-moratorium strategy window' },
      { day: 35, value: 0.5, label: 'Between statutory milestones' },
      {
        day: 56,
        value: 1,
        label: 'Statutory proposals due — disposals decided now',
      },
      { day: 90, value: 0.6, label: 'Proposals filed — execution phase' },
      { day: 180, value: 0.45, label: 'Mid-administration' },
      { day: 300, value: 0.35, label: 'Approaching the 12-month cap' },
      { day: 365, value: 0.2, label: 'Administration expired or extended' },
    ],
    // LPA (Law of Property Act 1925) receivers carry NO statutory clock —
    // researched Aug 2026: powers come from ss.101–109 plus the mortgage
    // deed, with no statutory sale deadline. In practice receivers push for
    // fast cash sales (typically 3–6 months appointment-to-sale), so the
    // curve is monotone decay from appointment: hottest immediately, stale
    // receiverships are likely under offer or stalled.
    receivership: [
      { day: 0, value: 1, label: 'Receiver appointed — mandated to sell' },
      { day: 90, value: 0.85, label: 'Receiver actively disposing' },
      { day: 180, value: 0.55, label: 'Late receivership' },
      {
        day: 270,
        value: 0.3,
        label: 'Long receivership — likely stalled or under offer',
      },
      { day: 365, value: 0.15, label: 'Cold receivership' },
    ],
  },
  propensityMax: 8,
  propensityHighThreshold: 0.75,

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
 * Merge an untrusted propensity-curve map over the defaults. Per-curve
 * all-or-nothing: a curve row must be a non-empty array of valid breakpoints
 * (finite day ≥ 0, finite value clamped to 0–1) or the default for that lead
 * type survives — a half-valid curve is worse than the researched one.
 * Breakpoints are re-sorted by day so a hand-edited EvalConfig row can't
 * make interpolation run backwards. New lead-type keys are accepted.
 */
function mergePropensityCurves(
  raw: unknown,
  base: Record<string, PropensityBreakpoint[]>,
): Record<string, PropensityBreakpoint[]> {
  const out: Record<string, PropensityBreakpoint[]> = { ...base };
  if (!isRecord(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!Array.isArray(value) || value.length === 0) continue;
    const parsed: PropensityBreakpoint[] = [];
    let valid = true;
    for (const bp of value) {
      if (
        !isRecord(bp) ||
        typeof bp.day !== 'number' ||
        !Number.isFinite(bp.day) ||
        bp.day < 0 ||
        typeof bp.value !== 'number' ||
        !Number.isFinite(bp.value)
      ) {
        valid = false;
        break;
      }
      parsed.push({
        day: bp.day,
        value: Math.max(0, Math.min(1, bp.value)),
        label: typeof bp.label === 'string' ? bp.label : 'Propensity window',
      });
    }
    if (valid) out[key] = parsed.sort((a, b) => a.day - b.day);
  }
  return out;
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
    commercialPenalty: num(raw.commercialPenalty, d.commercialPenalty),
    marriageValueBase: num(raw.marriageValueBase, d.marriageValueBase),
    marriageValueUrgencyMax: num(
      raw.marriageValueUrgencyMax,
      d.marriageValueUrgencyMax,
    ),
    propensityCurves: mergePropensityCurves(
      raw.propensityCurves,
      d.propensityCurves,
    ),
    propensityMax: num(raw.propensityMax, d.propensityMax),
    propensityHighThreshold: num(
      raw.propensityHighThreshold,
      d.propensityHighThreshold,
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
    // Read defensively like every other field: rows written before the sourcing
    // gate existed simply have no `sourcingThreshold` key, and must keep merging
    // to the default rather than producing an undefined gate (which would let
    // every scored lead through).
    sourcingThreshold: num(raw.sourcingThreshold, d.sourcingThreshold),
  };
}

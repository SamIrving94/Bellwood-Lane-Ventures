/**
 * Per-lead-type propensity curves (propensity.ts)
 *
 * How likely is this vendor to transact, given how long it has been since
 * their t=0 signal? Anchored on UK statutory timelines (founder research,
 * Aug 2026):
 *
 *   Probate (t=0 = Gazette s.27 notice): near-zero weeks 0–6 (no Grant, so
 *     the executor has no legal authority to sell), sharp rise weeks 8–16
 *     (the Grant of Probate window), plateau to month 6–9, then decay.
 *
 *   Insolvency/administration (t=0 = appointment/filing): two peaks — ~week 3
 *     (post-moratorium strategy) and week 8 (the Insolvency Act statutory
 *     proposal deadline); administration is capped at 12 months.
 *
 *   Receivership (t=0 = appointment notice): LPA 1925 receivers carry NO
 *     statutory clock (ss.101–109 + the mortgage deed; researched Aug 2026),
 *     so the curve is monotone decay — receivers are mandated to sell and
 *     move fastest immediately after appointment (3–6 months to sale in
 *     practice).
 *
 * DESIGN RULE — propensity NEVER gates capture. Leads are captured at t=0
 * exactly as before (be known early); the curve times ATTENTION (score
 * bonus, resurfacing actions) and OUTREACH (touch schedule). The score
 * factor it feeds is additive-only, so a low early propensity cannot push a
 * lead under the sourcing gate.
 *
 * CALIBRATION CAVEAT: the probate t=0 anchor is the Gazette notice date, and
 * a s.27 notice may be placed before OR after the Grant. The curve shape is
 * a statutory prior, not yet a measured fact about our own leads — verify it
 * against daysSinceSignal-at-conversion data (logged when a lead converts to
 * a deal) before trusting it hard. There is a test carrying this caveat.
 *
 * Curve breakpoints live in ScorerConfig (`propensityCurves`), so the founder
 * can retune them from the EvalConfig table without a deploy.
 */

import {
  DEFAULT_SCORER_CONFIG,
  type PropensityBreakpoint,
  type ScorerConfig,
} from './scorer-config';

export type { PropensityBreakpoint } from './scorer-config';

export interface PropensityResult {
  /** True when this lead type has a statutory-timeline curve configured. */
  hasCurve: boolean;
  /** Propensity to transact, 0–1. 0 when `hasCurve` is false. */
  value: number;
  /** Founder-facing phase label ("Entering the grant window"). Empty when no curve. */
  label: string;
}

const NO_CURVE: PropensityResult = { hasCurve: false, value: 0, label: '' };

/**
 * Pure lookup: propensity for `leadType` at `daysSinceSignal` days after its
 * t=0 signal. Linear interpolation between breakpoints; the first/last value
 * is held beyond the curve's ends; the label is the latest breakpoint at or
 * before the day. Lead types with no curve (listing-derived types, whose
 * "days since" is really days-on-market) return `hasCurve: false`.
 */
export function propensityForLeadType(
  leadType: string,
  daysSinceSignal: number,
  config: ScorerConfig = DEFAULT_SCORER_CONFIG
): PropensityResult {
  const key = leadType.toLowerCase().replace(/\s+/g, '_');
  const curve = config.propensityCurves[key];
  if (!curve || curve.length === 0) return NO_CURVE;

  const day = Number.isFinite(daysSinceSignal)
    ? Math.max(0, daysSinceSignal)
    : 0;

  // mergeScorerConfig sorts curves, but defend against a hand-built config.
  const points: PropensityBreakpoint[] = [...curve].sort(
    (a, b) => a.day - b.day
  );
  const first = points[0]!;
  const last = points[points.length - 1]!;

  // The phase label is the latest breakpoint at or before the day — so a day
  // sitting exactly ON a breakpoint gets THAT phase, not the one it just left.
  let label = first.label;
  for (const p of points) {
    if (p.day <= day) label = p.label;
    else break;
  }

  if (day <= first.day) {
    return { hasCurve: true, value: first.value, label };
  }
  if (day >= last.day) {
    return { hasCurve: true, value: last.value, label };
  }

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (day >= a.day && day <= b.day) {
      const span = b.day - a.day;
      const t = span === 0 ? 1 : (day - a.day) / span;
      return {
        hasCurve: true,
        value: a.value + t * (b.value - a.value),
        label,
      };
    }
  }
  // Unreachable given the guards above, but never throw from scoring.
  return { hasCurve: true, value: last.value, label };
}

/**
 * Did this lead ENTER its high-propensity window within the last
 * `windowDays` days? True when propensity is at/above the configured high
 * threshold today but was below it `windowDays` ago — the resurfacing cron's
 * trigger ("N probate leads entering the grant window this week"). Leads
 * captured weeks ago at low propensity come back to the founder exactly when
 * the statutory clock says they are worth attention.
 */
export function isEnteringHighPropensityWindow(
  leadType: string,
  daysSinceSignal: number,
  windowDays = 7,
  config: ScorerConfig = DEFAULT_SCORER_CONFIG
): boolean {
  const now = propensityForLeadType(leadType, daysSinceSignal, config);
  if (!now.hasCurve || now.value < config.propensityHighThreshold) {
    return false;
  }
  const before = propensityForLeadType(
    leadType,
    Math.max(0, daysSinceSignal - windowDays),
    config
  );
  return before.value < config.propensityHighThreshold;
}

// ---------------------------------------------------------------------------
// Recommended touch schedule (outreach timing)
// ---------------------------------------------------------------------------

// A `type` (not `interface`) so it stays assignable to Prisma's
// InputJsonValue when embedded in FounderAction metadata — interfaces lack
// the implicit index signature Prisma's JSON input type requires.
export type TouchScheduleStep = {
  /** When, in plain English, anchored on the lead's t=0 signal. */
  timing: string;
  /** What the touch is. Drafts only — everything is held for founder review. */
  touch: string;
};

/**
 * The outreach cadence the statutory timeline recommends for a lead type, or
 * null for types with no timeline curve. Attached to dispatch_campaign
 * action metadata so the marketer's draft brief carries the timing rationale.
 * Timing only — every draft is still held for founder approval (OutreachHold).
 */
export function recommendedTouchSchedule(
  leadType: string
): TouchScheduleStep[] | null {
  const key = leadType.toLowerCase().replace(/\s+/g, '_');
  switch (key) {
    case 'probate':
    case 'probate_admin':
      return [
        {
          timing: 'At notice (t=0)',
          touch:
            'Soft intro only — introduce ourselves, no ask. The executor cannot legally sell yet.',
        },
        {
          timing: 'Weeks 10–14 after notice',
          touch:
            'Direct approach — the Grant of Probate window, when the estate can transact.',
        },
        {
          timing: 'Months 6–9 after notice',
          touch:
            'Follow-up if unsold — estate realisation plateau before interest decays.',
        },
      ];
    case 'insolvency':
      return [
        {
          timing: 'Week 3 after filing',
          touch:
            'First approach — the administrator is forming strategy once the moratorium settles.',
        },
        {
          timing: 'Week 8 after filing',
          touch:
            'Direct approach — statutory proposal deadline; disposal decisions are being made now.',
        },
      ];
    case 'receivership':
      return [
        {
          timing: 'Immediately on appointment',
          touch:
            'Direct approach — no statutory clock; the receiver is mandated to sell and moves fastest early.',
        },
        {
          timing: 'Month 3 if unsold',
          touch: 'Follow-up — receivers typically dispose within 3–6 months.',
        },
      ];
    default:
      return null;
  }
}

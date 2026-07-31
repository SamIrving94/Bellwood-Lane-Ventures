/**
 * Auto-GDV — derive the after-refurb end value (GDV) and the current as-is
 * value straight from the AVM, so the deal model never needs a hand-typed GDV.
 *
 * Why the AVM point estimate is the right anchor:
 *   `runAVM` produces `avmPointEstimate` from distance-weighted sold comps for a
 *   NORMAL-condition property of this type / size / area. The condition, EPC and
 *   environmental discounts feed the OFFER calc (offer-calculation.ts), NOT the
 *   point estimate. So the point estimate already represents roughly what a
 *   sound, sellable ("done-up") version of the property is worth — which is
 *   exactly what GDV means.
 *
 * Two numbers fall out of one AVM run:
 *
 *   asIsValue = today's value in current condition = AVM × (1 − conditionDiscount)
 *   gdv       = end value after the planned refurb  = AVM × (1 + premiumUplift)
 *
 *   conditionDiscount — how far BELOW the comp-typical level the property sits
 *     today. A tired / unmodernised flat is worth less than the comp median
 *     until it is brought up to standard.
 *   premiumUplift — how far ABOVE comp-typical the FINISHED product lands. 0 for
 *     a standard refurb that just restores it to the comp baseline; positive
 *     when the works genuinely add value (extension, extra bedroom, high spec).
 *
 * Both levers are founder-tunable — the model proposes, the founder owns the
 * final GDV judgment ("Steps vs Thoughts": automate the estimate, protect the
 * call). Money is in PENCE throughout.
 *
 * Pure module (no `server-only`) so a what-if UI can import and run it
 * client-side, like deal-model.ts and offer-config.ts.
 */

import {
  type AcquisitionRoute,
  type DealAppraisal,
  type DealCostConfig,
  appraiseDeal,
  maxOfferForRoi,
} from './deal-model';

// ---------------------------------------------------------------------------
// Condition → as-is discount off comp-typical value
// ---------------------------------------------------------------------------

/**
 * How tired the property is TODAY, relative to the comp-typical condition the
 * AVM point estimate represents. Drives the discount applied to reach the
 * current as-is value.
 */
export type ConditionLevel =
  | 'turnkey' // ready to let/live — at or above comp standard
  | 'dated' // sound but old kitchen/bathroom/decor
  | 'tired' // needs a full cosmetic refurb
  | 'unmodernised' // original throughout, rewire/replumb likely
  | 'derelict'; // uninhabitable, major works

/**
 * Fraction knocked off the AVM (comp-typical) value to reach the current as-is
 * value, by condition. These are deliberately moderate, founder-tunable
 * starting points — the refurb spend and the founder's eye are the real
 * arbiters. A turnkey property is already at comp standard, so no discount.
 */
export const CONDITION_DISCOUNTS: Record<ConditionLevel, number> = {
  turnkey: 0,
  dated: 0.06,
  tired: 0.12,
  unmodernised: 0.18,
  derelict: 0.28,
};

export const DEFAULT_CONDITION: ConditionLevel = 'tired';

/**
 * Map the vision screener's condition label (pristine/fair/tired/distressed/
 * derelict — see @repo/auctions screenPropertyCondition) onto the deal-model's
 * ConditionLevel, so a photo-inferred condition can pre-fill the GDV inputs.
 */
export function mapVisualConditionToLevel(
  visual: string | null | undefined,
): ConditionLevel | null {
  switch (visual) {
    case 'pristine':
      return 'turnkey';
    case 'fair':
      return 'dated';
    case 'tired':
      return 'tired';
    case 'distressed':
      return 'unmodernised';
    case 'derelict':
      return 'derelict';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// GDV estimate
// ---------------------------------------------------------------------------

export interface GdvInput {
  /** AVM point estimate (comp-typical market value), pence. */
  avmPointEstimatePence: number;
  /** Current condition. Default 'tired'. Ignored if conditionDiscountFraction set. */
  conditionLevel?: ConditionLevel;
  /** Explicit as-is discount fraction, overriding the conditionLevel lookup. */
  conditionDiscountFraction?: number;
  /**
   * How far above comp-typical the FINISHED product lands (0–~0.3). Default 0:
   * a standard refurb restores the property to the comp baseline the AVM
   * already reflects. Raise it when the works add real value.
   */
  premiumUpliftFraction?: number;
  /**
   * Override the per-condition as-is discount table (from the saved valuation
   * config). Falls back to CONDITION_DISCOUNTS when omitted.
   */
  conditionDiscounts?: Partial<Record<ConditionLevel, number>>;
}

export interface GdvEstimate {
  /** The AVM anchor (comp-typical market value), pence. */
  avmPointEstimatePence: number;
  /** Today's value in current condition, pence. */
  asIsValuePence: number;
  /** End value after refurb to spec, pence. */
  gdvPence: number;
  /** Value the project creates: gdv − asIs, pence. */
  upliftPence: number;
  conditionLevel: ConditionLevel | null;
  conditionDiscountFraction: number;
  premiumUpliftFraction: number;
  /** One-line plain-English basis, ready to render. */
  basis: string;
}

function clampFraction(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, value));
}

/**
 * Estimate the as-is value and the after-refurb GDV from an AVM point estimate.
 */
export function estimateGdv(input: GdvInput): GdvEstimate {
  const avm = Math.max(0, Math.round(input.avmPointEstimatePence));

  const conditionLevel =
    input.conditionDiscountFraction === undefined
      ? (input.conditionLevel ?? DEFAULT_CONDITION)
      : null;

  const discountTable = {
    ...CONDITION_DISCOUNTS,
    ...(input.conditionDiscounts ?? {}),
  };
  const conditionDiscountFraction = clampFraction(
    input.conditionDiscountFraction ??
      discountTable[conditionLevel ?? DEFAULT_CONDITION],
    0.6
  );
  const premiumUpliftFraction = clampFraction(
    input.premiumUpliftFraction ?? 0,
    0.5
  );

  const asIsValuePence = Math.round(avm * (1 - conditionDiscountFraction));
  const gdvPence = Math.round(avm * (1 + premiumUpliftFraction));
  const upliftPence = gdvPence - asIsValuePence;

  const conditionText = conditionLevel
    ? `${conditionLevel} condition (−${Math.round(conditionDiscountFraction * 100)}%)`
    : `−${Math.round(conditionDiscountFraction * 100)}% as-is`;
  const upliftText =
    premiumUpliftFraction > 0
      ? `, +${Math.round(premiumUpliftFraction * 100)}% refurb uplift`
      : '';
  const basis = `GDV anchored on the AVM comp value; as-is reflects ${conditionText}${upliftText}.`;

  return {
    avmPointEstimatePence: avm,
    asIsValuePence,
    gdvPence,
    upliftPence,
    conditionLevel,
    conditionDiscountFraction,
    premiumUpliftFraction,
    basis,
  };
}

// ---------------------------------------------------------------------------
// Convenience: AVM → GDV → deal appraisal in one call
// ---------------------------------------------------------------------------

export interface DealFromAvmInput extends GdvInput {
  /** Planned refurb spend, pence. */
  refurbPence: number;
  /** Price we would pay, pence. Omit to solve for the max offer only. */
  offerPence?: number;
  /** Acquisition route — drives auction fees. Default private_treaty. */
  route?: AcquisitionRoute;
  /** Capital cost of a lease extension incl. fees, pence. */
  leaseExtensionPence?: number;
  /** Buyer is genuinely SDLT-exempt (rare — NOT probate). Default false. */
  sdltExempt?: boolean;
  /** Target cash ROI for the max-offer solve. Defaults to the model's hurdle. */
  targetRoi?: number;
  /** Override cost assumptions (e.g. bridge term for an earlier-exit what-if). */
  config?: DealCostConfig;
}

export interface DealFromAvmResult {
  gdv: GdvEstimate;
  /** Appraisal at the supplied offer — null when no offer was given. */
  appraisal: DealAppraisal | null;
  /** Highest offer that still clears the target cash ROI, pence. */
  maxOfferPence: number;
  /** The target cash ROI used for the max-offer solve. */
  targetRoi: number;
}

/**
 * Run the full chain: estimate GDV from the AVM, then appraise the deal at the
 * given offer (if any) AND solve for the walk-away max offer at the target ROI.
 * This is what a lead/deal what-if screen calls — one AVM in, the headline
 * numbers out.
 */
export function appraiseDealFromAvm(
  input: DealFromAvmInput
): DealFromAvmResult {
  const gdv = estimateGdv(input);

  const shared = {
    gdvPence: gdv.gdvPence,
    refurbPence: input.refurbPence,
    route: input.route,
    leaseExtensionPence: input.leaseExtensionPence,
    sdltExempt: input.sdltExempt,
    config: input.config,
  };

  const solved = maxOfferForRoi({ ...shared, targetRoi: input.targetRoi });

  const appraisal =
    input.offerPence === undefined
      ? null
      : appraiseDeal({ ...shared, offerPence: input.offerPence });

  return {
    gdv,
    appraisal,
    maxOfferPence: solved.maxOfferPence,
    targetRoi: solved.targetRoi,
  };
}

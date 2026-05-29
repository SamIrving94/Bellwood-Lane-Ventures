/**
 * Offer configuration (offer-config.ts)
 *
 * The offer calculator used to hard-code every acquisition margin and guard
 * rail. This module extracts the founder-facing levers into a typed,
 * versionable config so the `EvalConfig` table (evalType = "avm_confidence")
 * can override them WITHOUT a code change — the same pattern the lead scorer
 * uses via scorer-config.
 *
 * Design rules:
 *  - `DEFAULT_OFFER_CONFIG` reproduces the previous hard-coded behaviour
 *    EXACTLY, so a run with no active config is byte-for-byte unchanged.
 *  - `mergeOfferConfig` deep-merges a *partial* override (whatever shape the
 *    DB holds) over the defaults. Unknown / malformed keys are ignored — a bad
 *    config can never crash the AVM, only no-op to defaults.
 *  - Pure module (no `server-only`) so the founder editor can import the type
 *    and defaults client-side.
 */

import type { InvestmentGrade, SellerType } from './offer-calculation';

export interface OfferConfig {
  /** Base acquisition margin (fraction BELOW AVM) per seller type. */
  sellerTypeMargin: Record<SellerType, number>;
  /** Margin nudge per investment grade (negative = more competitive). */
  gradeAdjustment: Record<InvestmentGrade, number>;
  /** Effective base margin can never fall below this floor after grade nudge. */
  minEffectiveMargin: number;
  /** Offer floor as a fraction of AVM — below this, escalate to CEO. */
  floorFraction: number;
  /** Offer ceiling as a fraction of AVM — never offer above this. */
  ceilingFraction: number;
  /** Cap on the sum of risk discount lines (applied to AVM). */
  totalDiscountCap: number;
  /** How many days an issued offer stays valid. */
  offerValidityDays: number;
}

export const DEFAULT_OFFER_CONFIG: OfferConfig = {
  sellerTypeMargin: {
    probate: 0.2,
    chain_break: 0.2,
    short_lease: 0.15,
    repossession: 0.25,
    relocation: 0.2,
    standard: 0.22,
  },
  gradeAdjustment: {
    'A+': -0.03,
    A: 0,
    B: 0,
    C: 0.03,
    D: 0.05,
  },
  minEffectiveMargin: 0.1,
  floorFraction: 0.6,
  ceilingFraction: 0.88,
  totalDiscountCap: 0.4,
  offerValidityDays: 14,
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
 * Deep-merge a partial (untrusted) config over DEFAULT_OFFER_CONFIG. Every
 * field is read defensively: a missing or wrong-typed value falls back to the
 * default, so a malformed DB config degrades to default behaviour rather than
 * throwing.
 */
export function mergeOfferConfig(raw: unknown): OfferConfig {
  const d = DEFAULT_OFFER_CONFIG;
  if (!isRecord(raw)) return d;

  const stm = isRecord(raw.sellerTypeMargin) ? raw.sellerTypeMargin : {};
  const ga = isRecord(raw.gradeAdjustment) ? raw.gradeAdjustment : {};

  const sellerTypeMargin: Record<SellerType, number> = {
    probate: num(stm.probate, d.sellerTypeMargin.probate),
    chain_break: num(stm.chain_break, d.sellerTypeMargin.chain_break),
    short_lease: num(stm.short_lease, d.sellerTypeMargin.short_lease),
    repossession: num(stm.repossession, d.sellerTypeMargin.repossession),
    relocation: num(stm.relocation, d.sellerTypeMargin.relocation),
    standard: num(stm.standard, d.sellerTypeMargin.standard),
  };

  const gradeAdjustment: Record<InvestmentGrade, number> = {
    'A+': num(ga['A+'], d.gradeAdjustment['A+']),
    A: num(ga.A, d.gradeAdjustment.A),
    B: num(ga.B, d.gradeAdjustment.B),
    C: num(ga.C, d.gradeAdjustment.C),
    D: num(ga.D, d.gradeAdjustment.D),
  };

  return {
    sellerTypeMargin,
    gradeAdjustment,
    minEffectiveMargin: num(raw.minEffectiveMargin, d.minEffectiveMargin),
    floorFraction: num(raw.floorFraction, d.floorFraction),
    ceilingFraction: num(raw.ceilingFraction, d.ceilingFraction),
    totalDiscountCap: num(raw.totalDiscountCap, d.totalDiscountCap),
    offerValidityDays: num(raw.offerValidityDays, d.offerValidityDays),
  };
}

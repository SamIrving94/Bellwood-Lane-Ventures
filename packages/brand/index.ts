/**
 * Kept. — canonical brand identity. Single source of truth for the rebrand.
 *
 * The public-facing name is transitioning from "Bellwoods Lane" to "Kept."
 * This module makes that flip ONE value (`BRAND_PHASE`) instead of a
 * find-and-replace across ~90 hardcoded strings. Every surface — the public
 * site, the offer PDF, the emails — should read its name/domain/email from
 * here so the whole ecosystem turns over together.
 *
 * See docs/brand/KEPT.md for the brand rules, and the Kept. Claude Design
 * project for the visual spec.
 *
 * GATED: `BRAND_PHASE` must stay `'legacy'` in production until the class-36
 * trademark search clears and the founders give the go. With `'legacy'`, the
 * resolved `brand.name` is byte-for-byte "Bellwoods Lane", so wiring copy to
 * `brand.name` changes nothing visible — the copy-integrity guard passes —
 * and the eventual flip is a single, reviewable change.
 */

export type BrandPhase =
  /** Pre-flip. Still "Bellwoods Lane". Current production. */
  | 'legacy'
  /** 90-day transition: "Kept, formerly Bellwoods Lane". */
  | 'dual'
  /** Post-transition: "Kept." only. */
  | 'kept';

export type BrandIdentity = {
  /** Human name used in prose and titles. */
  name: string;
  /** The typeset mark (lowercase; the full stop is the logo). */
  mark: string;
  /** Registered/trading entity for legal copy and documents. */
  legalName: string;
  domain: string;
  url: string;
  email: string;
  /** Deal/offer correspondence address. */
  dealsEmail: string;
};

/**
 * Kept. — the target identity.
 * Legal/trading entity is TBC (trademark class 36 search pending); until it is
 * incorporated, `legalName` intentionally mirrors the trading name.
 */
export const KEPT: BrandIdentity = {
  name: 'Kept',
  mark: 'kept.',
  legalName: 'Kept',
  domain: 'wearekept.co.uk',
  url: 'https://wearekept.co.uk',
  email: 'hello@wearekept.co.uk',
  dealsEmail: 'deals@wearekept.co.uk',
};

/**
 * Bellwoods Lane — the outgoing identity, captured EXACTLY as it appears in
 * production today (including the two pre-existing inconsistencies, so that
 * `'legacy'` output is unchanged):
 *   • public site says "Bellwood**s** Lane" (with the s)
 *   • the legal entity + offer PDF say "Bellwood Lane Ventures Ltd" (no s)
 *   • the PDF's deals address is @bellwoodlane.co.uk (no s)
 * The rebrand resolves all of this to the single clean Kept. identity above.
 */
export const BELLWOODS: BrandIdentity = {
  name: 'Bellwoods Lane',
  mark: 'Bellwoods Lane',
  legalName: 'Bellwood Lane Ventures Ltd',
  domain: 'bellwoodslane.co.uk',
  url: 'https://bellwoodslane.co.uk',
  email: 'hello@bellwoodslane.co.uk',
  dealsEmail: 'deals@bellwoodlane.co.uk',
};

/**
 * The active rebrand phase. Defaults to `'legacy'`; an optional public env var
 * lets ops advance it at deploy time without a code change (Next inlines
 * NEXT_PUBLIC_* at build; node surfaces read it at runtime).
 *
 * Do NOT set this to `'dual'`/`'kept'` in production before the gate clears.
 */
const envPhase = process.env.NEXT_PUBLIC_BRAND_PHASE as BrandPhase | undefined;
export const BRAND_PHASE: BrandPhase =
  envPhase === 'dual' || envPhase === 'kept' ? envPhase : 'legacy';

export type ActiveBrand = BrandIdentity & {
  phase: BrandPhase;
  /** Name to render in UI — carries the dual-name string during transition. */
  displayName: string;
  /** The prior name, once there is one to reference; otherwise null. */
  former: string | null;
};

function resolve(phase: BrandPhase): ActiveBrand {
  switch (phase) {
    case 'kept':
      return { ...KEPT, phase, displayName: KEPT.name, former: BELLWOODS.name };
    case 'dual':
      return {
        ...KEPT,
        phase,
        displayName: `${KEPT.name}, formerly ${BELLWOODS.name}`,
        former: BELLWOODS.name,
      };
    default:
      return { ...BELLWOODS, phase: 'legacy', displayName: BELLWOODS.name, former: null };
  }
}

/** The resolved, active brand. Import this everywhere a name/domain is shown. */
export const brand: ActiveBrand = resolve(BRAND_PHASE);

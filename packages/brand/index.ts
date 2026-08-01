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
 * FLIPPED 2026-07-30 on founder instruction: the default phase is now
 * `'kept'`. `NEXT_PUBLIC_BRAND_PHASE` can still force `'legacy'` or `'dual'`
 * as an emergency rollback without a code change. Note the old-domain 301 in
 * apps/web/next.config.ts keys off the env var directly, so it stays inert
 * until wearekept.co.uk DNS is attached and the env var is set explicitly.
 */

export type BrandPhase =
  /** Pre-flip. Still "Bellwoods Lane". Rollback lever only. */
  | 'legacy'
  /** 90-day transition: "Kept, formerly Bellwoods Lane". */
  | 'dual'
  /** Post-transition: "Kept." only. */
  | 'kept';

export type BrandIdentity = {
  /** Human name used in prose and titles. */
  name: string;
  /** Bare short form used mid-sentence (e.g. "instructed by Bellwood"). */
  shortName: string;
  /** The typeset mark (lowercase; the full stop is the logo). */
  mark: string;
  /** Registered/trading entity for legal copy and documents. */
  legalName: string;
  /** Companies House registration number of the entity behind the brand. */
  companyNumber: string;
  domain: string;
  url: string;
  email: string;
  /** Deal/offer correspondence address. */
  dealsEmail: string;
};

/**
 * Kept. — the target identity.
 * "Kept" is a trading name, not a registered company: the entity behind it is
 * BELLWOODS LANE VENTURES LTD (Companies House 16454416, incorporated
 * 2025-05-15, registered office 20 Wenlock Road, London N1 7GU — verified
 * against the register 2026-07-31). Legal copy and binding documents must name
 * the registered entity, so `legalName` carries it until/unless a Kept entity
 * is incorporated.
 */
export const KEPT: BrandIdentity = {
  name: 'Kept',
  shortName: 'Kept',
  mark: 'kept.',
  legalName: 'Bellwoods Lane Ventures Ltd',
  companyNumber: '16454416',
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
 *   • the legal entity + offer PDF say "Bellwood Lane Ventures Ltd" (no s) —
 *     which does not match the register: the company is BELLWOODS LANE
 *     VENTURES LTD (16454416). Kept as-is here because this object records
 *     what legacy production actually printed.
 *   • the PDF's deals address is @bellwoodlane.co.uk (no s)
 * The rebrand resolves all of this to the single clean Kept. identity above.
 */
export const BELLWOODS: BrandIdentity = {
  name: 'Bellwoods Lane',
  shortName: 'Bellwood',
  mark: 'Bellwoods Lane',
  legalName: 'Bellwood Lane Ventures Ltd',
  companyNumber: '16454416',
  domain: 'bellwoodslane.co.uk',
  url: 'https://bellwoodslane.co.uk',
  email: 'hello@bellwoodslane.co.uk',
  dealsEmail: 'deals@bellwoodlane.co.uk',
};

/**
 * The active rebrand phase. Defaults to `'kept'` — the founder gave the go on
 * 2026-07-30 and the name is flipped. The public env var remains as an
 * emergency lever: set it to `'legacy'` or `'dual'` to roll back at deploy
 * time without a code change (Next inlines NEXT_PUBLIC_* at build; node
 * surfaces read it at runtime).
 */
const envPhase = process.env.NEXT_PUBLIC_BRAND_PHASE as BrandPhase | undefined;
export const BRAND_PHASE: BrandPhase =
  envPhase === 'legacy' || envPhase === 'dual' ? envPhase : 'kept';

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
      return {
        ...BELLWOODS,
        phase: 'legacy',
        displayName: BELLWOODS.name,
        former: null,
      };
  }
}

/** The resolved, active brand. Import this everywhere a name/domain is shown. */
export const brand: ActiveBrand = resolve(BRAND_PHASE);

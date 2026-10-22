/**
 * Evidence-disagreement checks (evidence-checks.ts) — the Clarendon Rise lesson.
 *
 * Oct 2026: a 75 m² flat that sold for £495k in 2023 was valued at £409k
 * with 92% confidence. The interval-width check (uncertainty.ts) stayed
 * quiet because the range was narrow. But the AVM's own evidence disagreed
 * with itself: two nearby sales said ~£320k, fifteen a little further out
 * said ~£450k, and the home's own sale said £495k. These checks look for
 * that kind of disagreement and ask a person to look before any offer.
 *
 *   1. RING GAP — the near (≤0.25 mi) and far ring medians differ by
 *      ≥ RING_GAP_MIN while the near ring, which carries 60% of the comp
 *      figure, has ≤ RING_THIN_MAX_NEAR sales. Measured on 24 radius-path
 *      appraisals (22 Oct 2026): a gap alone fired on half of them (prime
 *      streets really do differ); gap + thin ring fired on 7.
 *   2. OWN SALE — the home sold within OWN_SALE_MAX_YEARS and the estimate
 *      is ≥ OWN_SALE_GAP from that price moved forward by local UK HPI.
 *      Measured: 1 of 159 appraised homes (Clarendon Rise, −17.5%).
 *   3. TYPE — the property type we valued as disagrees with the home's own
 *      EPC: flat vs house, or detached vs terraced. Neighbouring forms
 *      (semi vs end-terrace) don't count. Measured: 2 of 24 checkable homes
 *      (a maisonette valued as a terrace; an end-terrace valued as detached).
 *
 * FLAGS ONLY. Nothing here changes a valuation, a range or an offer. A flag
 * raises `secondCheckRequired` and says why, in plain English, so the
 * founder checks the comps by hand. Pure module — no network.
 */

import type { PropertyType } from './base-valuation';

/** Near and far ring medians this far apart (either way) are a disagreement… */
export const RING_GAP_MIN = 0.25;
/** …but only when the near ring is this thin, since it carries 60%. */
export const RING_THIN_MAX_NEAR = 3;
/** Only a sale this recent is compared. */
export const OWN_SALE_MAX_YEARS = 5;
/** The estimate this far from the HPI-indexed own sale is a disagreement. */
export const OWN_SALE_GAP = 0.1;

export type EvidenceFlagCode = 'ring_gap' | 'own_sale_gap' | 'type_mismatch';

export interface EvidenceFlag {
  code: EvidenceFlagCode;
  /** One plain-English sentence for the founder. */
  message: string;
}

/** What each check saw — kept even when it didn't fire, for later tuning. */
export interface EvidenceChecks {
  ringGap: {
    nearMedian: number | null;
    farMedian: number | null;
    nearCount: number;
    farCount: number;
    /** near ÷ far − 1. Null when either ring is empty. */
    gap: number | null;
  } | null;
  ownSale: {
    price: number;
    date: string;
    /** The sale moved to today's prices by local UK HPI; null if unindexed. */
    indexedPrice: number | null;
    hpiRegion: string | null;
    /** estimate ÷ indexed sale − 1. */
    gap: number | null;
  } | null;
  propertyType: {
    valuedAs: PropertyType;
    epcDwellingType: string;
    disagrees: boolean;
  } | null;
  /** Why the home-level checks couldn't run, if they couldn't. */
  homeChecksSkipped: 'no_house_number' | null;
  flags: EvidenceFlag[];
  secondCheckRequired: boolean;
}

/** Facts about the home itself, fetched by gatherHomeEvidence. */
export interface HomeEvidence {
  namesOneHome: boolean;
  ownSale: { price: number; date: string } | null;
  hpiMove: { ratio: number; region: string } | null;
  epcDwellingType: string | null;
}

type Kind = 'flat' | 'house';
type Form = 'detached' | 'semi' | 'terraced' | null;

/** Read kind + built form from an EPC dwelling type string. */
export function readDwellingType(text: string): { kind: Kind | null; form: Form } {
  const t = text.toLowerCase();
  const kind: Kind | null = /flat|maisonette/.test(t)
    ? 'flat'
    : /house|bungalow|terrace|detached/.test(t)
      ? 'house'
      : null;
  // "semi-detached" must be read before "detached".
  const form: Form = /semi/.test(t)
    ? 'semi'
    : /detached/.test(t)
      ? 'detached'
      : /terrace/.test(t)
        ? 'terraced'
        : null;
  return { kind, form };
}

const FORM_ORDER: Record<Exclude<Form, null>, number> = {
  terraced: 0,
  semi: 1,
  detached: 2,
};

/**
 * Do the valued type and the EPC disagree enough to matter? Flat vs house
 * always does. Among houses only the two ends do (detached vs terraced) —
 * an end-terrace and a semi are often the same building described two ways.
 */
export function typesDisagree(valuedAs: PropertyType, epcDwellingType: string): boolean {
  const epc = readDwellingType(epcDwellingType);
  if (!epc.kind) return false;
  const ours = readDwellingType(valuedAs === 'flat' ? 'flat' : `${valuedAs} house`);
  if (ours.kind !== epc.kind) return true;
  if (ours.kind === 'flat' || !ours.form || !epc.form) return false;
  return Math.abs(FORM_ORDER[ours.form] - FORM_ORDER[epc.form]) >= 2;
}

const pct = (x: number) => `${Math.round(Math.abs(x) * 100)}%`;
const gbp = (x: number) => `£${Math.round(x).toLocaleString('en-GB')}`;

/** Run the three checks. Money in POUNDS, like the rest of the AVM. */
export function assessEvidence(input: {
  pointEstimate: number;
  propertyType: PropertyType;
  /** From the distance-weighted CSA; null on the Land Registry fallback. */
  rings: {
    nearMedian: number | null;
    farMedian: number | null;
    nearCount: number;
    farCount: number;
  } | null;
  home: HomeEvidence | null;
}): EvidenceChecks {
  const flags: EvidenceFlag[] = [];

  // 1. Ring gap.
  let ringGap: EvidenceChecks['ringGap'] = null;
  if (input.rings) {
    const { nearMedian, farMedian, nearCount, farCount } = input.rings;
    const gap =
      nearMedian && farMedian && farMedian > 0 ? nearMedian / farMedian - 1 : null;
    ringGap = { nearMedian, farMedian, nearCount, farCount, gap };
    if (gap !== null && Math.abs(gap) >= RING_GAP_MIN && nearCount <= RING_THIN_MAX_NEAR) {
      flags.push({
        code: 'ring_gap',
        message: `The ${nearCount} nearest sale${nearCount === 1 ? '' : 's'} (median ${gbp(nearMedian as number)}) are ${pct(gap)} ${gap < 0 ? 'below' : 'above'} the ${farCount} further out (median ${gbp(farMedian as number)}), and they carry 60% of the comp figure. Check whether the nearest sales are like-for-like.`,
      });
    }
  }

  const home = input.home;
  const homeChecksSkipped: EvidenceChecks['homeChecksSkipped'] =
    home && !home.namesOneHome ? 'no_house_number' : null;

  // 2. Own sale.
  let ownSale: EvidenceChecks['ownSale'] = null;
  if (home?.ownSale) {
    const indexedPrice = home.hpiMove
      ? Math.round(home.ownSale.price * home.hpiMove.ratio)
      : null;
    const basis = indexedPrice ?? home.ownSale.price;
    const gap = basis > 0 ? input.pointEstimate / basis - 1 : null;
    ownSale = {
      price: home.ownSale.price,
      date: home.ownSale.date,
      indexedPrice,
      hpiRegion: home.hpiMove?.region ?? null,
      gap,
    };
    if (gap !== null && Math.abs(gap) >= OWN_SALE_GAP) {
      const when = new Date(home.ownSale.date).toLocaleDateString('en-GB', {
        month: 'short',
        year: 'numeric',
      });
      flags.push({
        code: 'own_sale_gap',
        message: `This home sold for ${gbp(home.ownSale.price)} in ${when}${indexedPrice !== null ? ` (${gbp(indexedPrice)} at today's local prices)` : ''}. The estimate is ${pct(gap)} ${gap < 0 ? 'below' : 'above'} that. Check what has changed.`,
      });
    }
  }

  // 3. Property type vs the home's own EPC.
  let propertyType: EvidenceChecks['propertyType'] = null;
  if (home?.epcDwellingType) {
    const disagrees = typesDisagree(input.propertyType, home.epcDwellingType);
    propertyType = {
      valuedAs: input.propertyType,
      epcDwellingType: home.epcDwellingType,
      disagrees,
    };
    if (disagrees) {
      flags.push({
        code: 'type_mismatch',
        message: `Valued as ${input.propertyType}, but this home's EPC says "${home.epcDwellingType}". The comps may be the wrong kind of home.`,
      });
    }
  }

  return {
    ringGap,
    ownSale,
    propertyType,
    homeChecksSkipped,
    flags,
    secondCheckRequired: flags.length > 0,
  };
}

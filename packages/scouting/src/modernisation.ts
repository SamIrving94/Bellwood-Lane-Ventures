/**
 * Ripe-for-modernisation assessor (modernisation.ts)
 *
 * "Focus the scout on things that have NOT been refurbished recently"
 * (founder direction, 30 Aug 2026). The refurb-arbitrage book buys the
 * unmodernised house; until this module, the scorer actively PENALISED it
 * (EPC F/G scored −4 as a letting-compliance risk) and the strongest
 * public evidence of an untouched home never reached scoring at all.
 *
 * The evidence, all of it already fetched or free:
 *
 *  - **The property's own EPC band.** F/G means the heating and
 *    insulation are as the register last found them — the same proxy the
 *    arbitrage model (arbitrage.ts) uses to split unmodernised from
 *    refurbished stock.
 *  - **The AGE of the certificate.** An EPC is required at every sale or
 *    let and lasts ten years. One assessed in 2013 — or lapsed — says the
 *    home has not been marketed, re-let, or (in practice) renovated since.
 *  - **Heating language on the certificate.** "Back boiler", storage
 *    heaters, no central heating: nobody modernises a kitchen and leaves
 *    a back boiler.
 *  - **Years since the last recorded sale.** Long tenure is the single
 *    best prior for an unmodernised interior. Real HMLR rows only — a
 *    synthetic comparable proves nothing.
 *  - **The listing's own badge/text**, when the lead came from a listing.
 *
 * ONLY POSITIVE EVIDENCE COUNTS. An absent EPC record cannot score: the
 * client returns the same `unavailable` for "no certificate exists" and
 * "the lookup failed", and guessing which is the SW3 mistake wearing a
 * different hat. Unknown contributes nothing, in either direction.
 *
 * Pure module — no network, no server-only — so it is unit-testable and
 * the what-if maths can run anywhere.
 */

import { REFURB_TEXT } from './track';

// ─────────────────────────────────────────────────────────────────────────
// Tunables (founder levers — see docs/PRIME-SCOUT.md §7)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Cap on the score boost. The modifier scale in scorer.ts runs ±10 (market
 * trend, risk); modernisation is capped just under so evidence of an
 * untouched house can outrank the −4 EPC risk factor without drowning the
 * acquisition pillars (probate itself is 20).
 */
export const MODERNISATION_MAX_POINTS = 8;

/** Points at or above which a lead is flagged "ripe for modernisation". */
export const MODERNISATION_RIPE_POINTS = 5;

const POINTS = {
  epcFG: 6,
  epcE: 3,
  oldCertificate: 3,
  datedHeating: 4,
  saleOver25y: 5,
  saleOver15y: 3,
  unmodernisedBadge: 6,
  refurbText: 4,
} as const;

/** EPCs last ten years; older than this and the record itself has lapsed. */
const OLD_CERTIFICATE_YEARS = 10;
const LONG_TENURE_YEARS = 15;
const VERY_LONG_TENURE_YEARS = 25;

/** Certificate heating descriptions that date a home by themselves. */
const DATED_HEATING =
  /\b(?:back boiler|storage heat|no central heating|room heaters?|warm air|electric heaters?|no heating)\b/i;

/** Listing badges that already assert the condition outright. */
const UNMODERNISED_BADGES = new Set([
  'unmodernised-properties',
  'derelict-properties',
  'poor-epc-score',
]);

// ─────────────────────────────────────────────────────────────────────────
// Assessment
// ─────────────────────────────────────────────────────────────────────────

export interface ModernisationInput {
  /** The property's OWN EPC (register lookup), not the postcode average. */
  epcRating?: string | null;
  /** ISO-ish assessment date of that certificate. */
  epcInspectionDate?: string | null;
  /** Heating description from the certificate. */
  heatingType?: string | null;
  /** ISO date of the last REAL recorded sale. Pass null for synthetic. */
  lastSaleDate?: string | null;
  /** PropertyData sourcing badge, when the lead came from a listing. */
  listingType?: string | null;
  /** Listing/address text, for condition language. */
  text?: string | null;
}

export interface ModernisationAssessment {
  /** True when the evidence clears MODERNISATION_RIPE_POINTS. */
  ripe: boolean;
  strength: 'strong' | 'moderate' | 'faint' | 'none';
  /** Score boost, 0..MODERNISATION_MAX_POINTS. */
  points: number;
  /** Founder-readable evidence lines, strongest first. Shown verbatim. */
  reasons: string[];
}

function yearsBetween(fromIso: string, now: Date): number | null {
  const t = Date.parse(fromIso);
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / (365.25 * 86_400_000);
}

export function assessModernisation(
  input: ModernisationInput,
  now: Date = new Date()
): ModernisationAssessment {
  // [points, reason] pairs, collected then sorted strongest-first.
  const evidence: Array<[number, string]> = [];

  const band = input.epcRating?.toUpperCase();
  if (band === 'F' || band === 'G') {
    evidence.push([
      POINTS.epcFG,
      `EPC ${band}: heating and insulation untouched`,
    ]);
  } else if (band === 'E') {
    evidence.push([POINTS.epcE, 'EPC E: little modernisation on record']);
  }

  if (input.epcInspectionDate) {
    const age = yearsBetween(input.epcInspectionDate, now);
    if (age !== null && age >= OLD_CERTIFICATE_YEARS) {
      evidence.push([
        POINTS.oldCertificate,
        `EPC assessed ${input.epcInspectionDate.slice(0, 4)}: nothing lodged since`,
      ]);
    }
  }

  if (input.heatingType && DATED_HEATING.test(input.heatingType)) {
    evidence.push([
      POINTS.datedHeating,
      `Dated heating on the certificate: ${input.heatingType.toLowerCase()}`,
    ]);
  }

  if (input.lastSaleDate) {
    const tenure = yearsBetween(input.lastSaleDate, now);
    if (tenure !== null && tenure >= VERY_LONG_TENURE_YEARS) {
      evidence.push([
        POINTS.saleOver25y,
        `No recorded sale since ${input.lastSaleDate.slice(0, 4)}: very long tenure`,
      ]);
    } else if (tenure !== null && tenure >= LONG_TENURE_YEARS) {
      evidence.push([
        POINTS.saleOver15y,
        `No recorded sale since ${input.lastSaleDate.slice(0, 4)}: long tenure`,
      ]);
    }
  }

  if (input.listingType && UNMODERNISED_BADGES.has(input.listingType)) {
    evidence.push([
      POINTS.unmodernisedBadge,
      `Listed as ${input.listingType.replace(/-/g, ' ')}`,
    ]);
  } else if (input.text && REFURB_TEXT.test(input.text)) {
    evidence.push([
      POINTS.refurbText,
      'Listing text describes an unmodernised property',
    ]);
  }

  evidence.sort((a, b) => b[0] - a[0]);
  const raw = evidence.reduce((sum, [p]) => sum + p, 0);
  const points = Math.min(raw, MODERNISATION_MAX_POINTS);

  const strength =
    points >= MODERNISATION_MAX_POINTS
      ? 'strong'
      : points >= MODERNISATION_RIPE_POINTS
        ? 'moderate'
        : points > 0
          ? 'faint'
          : 'none';

  return {
    ripe: points >= MODERNISATION_RIPE_POINTS,
    strength,
    points,
    reasons: evidence.map(([, reason]) => reason),
  };
}

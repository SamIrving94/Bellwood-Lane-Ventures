/**
 * Two-track classification — which business a lead belongs to.
 *
 * `volume` — the high-volume sourcing business: smaller tickets, released to
 * investors for a fee. The default, and the only track the automated
 * sourcing gate applies to.
 *
 * `prime`  — high-value stock Kept buys for its own book: bought under market,
 * refurbished, sold on. Scarce by nature, so prime leads BYPASS the volume
 * sourcing threshold: a human decides, not the gate.
 *
 * `block`  — multi-unit stock: blocks of flats, freehold buildings,
 * portfolios. Also bypasses the gate, and additionally survives the
 * "development site" drop and the commercial `unit` flag that would
 * otherwise discard or mis-badge it.
 *
 * The classification is deliberately keyword + threshold based (no LLM):
 * it runs on every sourced listing every day, and a false `prime` costs one
 * founder glance while a false `volume` silently buries a £1M opportunity —
 * so thresholds lean inclusive.
 *
 * ── Why this was rewritten (Aug 2026) ──────────────────────────────────────
 *
 * The founder reported the prime track "isn't doing a great job". It wasn't
 * tuning. Two structural faults meant prime could almost never fire:
 *
 * 1. It keyed solely off `estateValuePence`, which is hard-coded `null` for
 *    EVERY probate notice (gazette.ts), every receivership and every
 *    Companies House lead. Only PropertyData listings carry a price. So the
 *    highest-intent cohort in the business — probate — was structurally
 *    incapable of ever being prime, however valuable the house.
 *
 * 2. The £700k floor was calibrated for "the London/South-East prime patch",
 *    but every scanned postcode was Manchester, Stockport, Leeds or
 *    Sheffield, where £700k is top-percentile. The threshold was written for
 *    a patch the scout did not scan.
 *
 * The fixes, in order of importance:
 *
 * - **Judge the street, not just the lead.** When a lead has no value of its
 *   own we fall back to the HM Land Registry area average. A probate notice
 *   in a district averaging £1.4M is prime stock and we can now say so.
 * - **Prime is geographic.** The strategy is a London refurb-arbitrage play,
 *   so prime only fires in the districts we actually hunt in. Elsewhere a
 *   £700k house is an expensive volume lead, not a prime opportunity.
 * - **Separate "expensive" from "opportunity".** Absolute value tells you the
 *   ticket size. It says nothing about whether there is money in it.
 *   `assessPrimeOpportunity` scores the thing the strategy actually needs:
 *   priced below its street AND needing the work that explains why.
 */

export type DealTrackValue = 'volume' | 'prime' | 'block';

/**
 * Purchase price / estate value at which a lead stops being volume stock,
 * inside a prime district. ~£700k under-market entry supports the ~£1M+
 * post-refurb exit the prime book is built on.
 */
export const PRIME_MIN_VALUE_PENCE = 700_000_00;

/**
 * London districts where the buy-under-market → refurb → sell strategy works.
 *
 * Chosen for HOUSING STOCK, not prestige. What the strategy needs is a wide,
 * liquid spread between an unmodernised period house and a refurbished one on
 * the same street. That spread is widest in zone 2–3 Victorian and Edwardian
 * terrace belts, where entry sits near £700k–£2M and the refurbished exit is
 * set by a deep owner-occupier buyer pool.
 *
 * Super-prime (W8, SW3, SW1, W1) is deliberately EXCLUDED from tier 1: entry
 * is £3M+, the buyer pool is thin and international, and listed-building and
 * conservation consent turn a six-month refurb into an eighteen-month one.
 * Bigger numbers, worse margin, far more risk. Tier 2 keeps them visible
 * without making them the focus.
 *
 * TREAT THIS AS A STARTING HYPOTHESIS, NOT A FINDING. It is reasoned from
 * housing-stock characteristics, not measured against our own data. Validate
 * it with `scripts/avm-backtest.mts` against real comparables before scaling
 * spend behind it, and prune whatever does not earn its place.
 */
export const LONDON_PRIME_DISTRICTS: ReadonlyArray<{
  district: string;
  label: string;
  tier: 1 | 2;
}> = [
  // ── South-west: the deepest terrace belt in London ──
  { district: 'SW11', label: 'Battersea', tier: 1 },
  { district: 'SW12', label: 'Balham', tier: 1 },
  { district: 'SW17', label: 'Tooting', tier: 1 },
  { district: 'SW18', label: 'Wandsworth / Earlsfield', tier: 1 },
  { district: 'SW4', label: 'Clapham', tier: 1 },
  { district: 'SW16', label: 'Streatham', tier: 1 },
  { district: 'SW6', label: 'Fulham', tier: 1 },

  // ── South-east: strongest unmodernised-to-refurbished spread ──
  { district: 'SE22', label: 'East Dulwich', tier: 1 },
  { district: 'SE21', label: 'Dulwich Village', tier: 1 },
  { district: 'SE24', label: 'Herne Hill', tier: 1 },
  { district: 'SE23', label: 'Forest Hill', tier: 1 },
  { district: 'SE15', label: 'Peckham', tier: 1 },
  { district: 'SE3', label: 'Blackheath', tier: 1 },

  // ── North: large period stock, long-tenure owners, high probate incidence ──
  { district: 'N8', label: 'Crouch End', tier: 1 },
  { district: 'N10', label: 'Muswell Hill', tier: 1 },
  { district: 'N16', label: 'Stoke Newington', tier: 1 },
  { district: 'N4', label: 'Finsbury Park / Stroud Green', tier: 1 },
  { district: 'N19', label: 'Archway / Upper Holloway', tier: 1 },
  { district: 'N7', label: 'Holloway', tier: 1 },

  // ── West: Edwardian family stock, strong refurbished exit ──
  { district: 'W4', label: 'Chiswick', tier: 1 },
  { district: 'W5', label: 'Ealing', tier: 1 },
  { district: 'W3', label: 'Acton', tier: 1 },
  { district: 'W12', label: 'Shepherd’s Bush', tier: 1 },
  { district: 'W13', label: 'West Ealing', tier: 1 },

  // ── North-west ──
  { district: 'NW6', label: 'Kilburn / Queen’s Park', tier: 1 },
  { district: 'NW10', label: 'Kensal Green / Willesden', tier: 1 },
  { district: 'NW5', label: 'Kentish Town', tier: 1 },
  { district: 'NW2', label: 'Cricklewood', tier: 1 },

  // ── East: later to gentrify, so more unmodernised stock still trading ──
  { district: 'E5', label: 'Clapton', tier: 1 },
  { district: 'E8', label: 'Hackney / London Fields', tier: 1 },
  { district: 'E9', label: 'Homerton / Victoria Park', tier: 1 },
  { district: 'E17', label: 'Walthamstow', tier: 1 },
  { district: 'E11', label: 'Leytonstone / Wanstead', tier: 1 },

  // ── Tier 2: super-prime. Visible, not the focus. Entry £3M+, thin buyer
  //    pool, listed/conservation consent risk. Bigger ticket, worse margin. ──
  { district: 'W8', label: 'Kensington', tier: 2 },
  { district: 'W11', label: 'Notting Hill', tier: 2 },
  { district: 'SW3', label: 'Chelsea', tier: 2 },
  { district: 'SW7', label: 'South Kensington', tier: 2 },
  { district: 'NW3', label: 'Hampstead', tier: 2 },
  { district: 'NW8', label: 'St John’s Wood', tier: 2 },
];

const PRIME_DISTRICT_SET: ReadonlySet<string> = new Set(
  LONDON_PRIME_DISTRICTS.map((a) => a.district)
);

/**
 * Multi-unit / portfolio language. Word-boundary matched and kept specific:
 * a single "flat" or "apartment" must NOT match — only language that implies
 * the whole building or several units is changing hands.
 */
const BLOCK_PATTERN =
  /\bblocks? of (?:\d+\s+)?(?:flats|apartments|maisonettes)\b|\bportfolio of\b|\bproperty portfolio\b|\bfreehold (?:block|building|investment)\b|\bentire (?:block|building)\b|\bwhole building\b|\b\d+\s*x\s*(?:flats|apartments|units)\b|\bself-contained (?:flats|units)\b|\bhmo\b|\bmulti[- ]unit\b|\bground rents?\b|\b\d+\s+(?:net\s+)?dwellings\b/i;

/* Postcode parsing. Hoisted to module scope: these run on every lead of
 * every run, and rebuilding a regex per call is wasted work.
 * Outward is 2–4 chars: 1–2 letters, 1–2 digits, optional trailing letter. */
const WHITESPACE = /\s+/g;
const FULL_POSTCODE = /^([A-Z]{1,2}\d{1,2}[A-Z]?)\d[A-Z]{2}$/;
const OUTWARD_ONLY = /^([A-Z]{1,2}\d{1,2}[A-Z]?)$/;

/**
 * Condition language, for listings whose feed gave us no distress badge.
 * Grouped, so the \b anchors bind every alternative rather than only the
 * first and last — the classic alternation-precedence trap.
 */
const REFURB_TEXT =
  /\b(?:un-?modernised|unimproved|(?:needs?|requires?|requiring|in need of)\s+(?:full\s+|complete\s+|total\s+)?(?:modernisation|modernising|updating|renovation|renovating|refurbishment|repair)|renovation project|refurbishment project|doer[-\s]upper)\b/i;

/** True when listing text reads as a whole block / portfolio, not one home. */
export function isBlockText(text: string | null | undefined): boolean {
  if (!text) {
    return false;
  }
  return BLOCK_PATTERN.test(text);
}

/**
 * The outward code of a UK postcode — `SW11 3AB` → `SW11`.
 *
 * Tolerant of the shapes our sources actually emit: missing space, lower
 * case, extra whitespace. Returns null when it cannot be read confidently,
 * because guessing a district is worse than admitting we do not know one.
 */
export function outwardCode(
  postcode: string | null | undefined
): string | null {
  if (!postcode) {
    return null;
  }
  const cleaned = postcode.toUpperCase().replace(WHITESPACE, '');
  const full = cleaned.match(FULL_POSTCODE);
  if (full) {
    return full[1];
  }
  // Some feeds give the outward code alone.
  const outwardOnly = cleaned.match(OUTWARD_ONLY);
  return outwardOnly ? outwardOnly[1] : null;
}

/**
 * True when the postcode sits in a district we run the prime strategy in.
 *
 * `extraDistricts` is the founder's own geography: districts they have
 * marked as prime-focus areas in Settings -> Scouting. The built-in London
 * list is the default hypothesis; the founder's explicit choice EXTENDS it
 * and is never overruled by it. (Before this, marking DA12 as a prime area
 * scanned it daily while the classifier quietly filed every DA12 lead as
 * volume — the founder said "prime" and the code said no.)
 */
export function isPrimeDistrict(
  postcode: string | null | undefined,
  extraDistricts?: ReadonlySet<string>
): boolean {
  const out = outwardCode(postcode);
  if (out === null) {
    return false;
  }
  return PRIME_DISTRICT_SET.has(out) || (extraDistricts?.has(out) ?? false);
}

/** Normalise founder-supplied district codes into a comparable set. */
export function toDistrictSet(
  districts: ReadonlyArray<string> | null | undefined
): ReadonlySet<string> {
  return new Set(
    (districts ?? [])
      .map((d) => d.toUpperCase().replace(WHITESPACE, ''))
      .filter((d) => OUTWARD_ONLY.test(d))
  );
}

export function classifyTrack(input: {
  /** Asking/estate/guide value in pence, if known. */
  valuePence?: number | null;
  /** Any listing text — address, title, summary — concatenated is fine. */
  text?: string | null;
  propertyType?: string | null;
  /** Postcode, so prime can be geographic rather than purely numeric. */
  postcode?: string | null;
  /**
   * HM Land Registry average sold price for the area, in pence. The stand-in
   * for a lead's own value when it has none — which is every probate notice.
   * Pass null for synthetic/fallback comparables; scoring against an invented
   * average is worse than scoring against nothing.
   */
  areaAvgPence?: number | null;
  /** Founder-marked prime districts (see isPrimeDistrict). */
  primeDistricts?: ReadonlySet<string>;
}): DealTrackValue {
  const haystack = [input.text ?? '', input.propertyType ?? ''].join(' ');
  if (isBlockText(haystack)) {
    return 'block';
  }

  // Prime is a geographic strategy. Inside a district we hunt in, an
  // expensive house is a prime opportunity; outside one it is an expensive
  // volume lead, with no refurb thesis, no comparables depth and nobody to
  // send to view it.
  //
  // But only demote when we can actually READ a district. An unreadable or
  // absent postcode means we do not know where this is, and this file's
  // governing rule is that a false `volume` silently buries a £1M
  // opportunity while a false `prime` costs one founder glance. So an
  // unknown location falls through to the value test rather than being
  // quietly binned — callers that never had a postcode to give (the auctions
  // route) keep their old behaviour exactly.
  const district = outwardCode(input.postcode);
  if (
    district !== null &&
    !PRIME_DISTRICT_SET.has(district) &&
    !(input.primeDistricts?.has(district) ?? false)
  ) {
    return 'volume';
  }

  if (
    typeof input.valuePence === 'number' &&
    input.valuePence >= PRIME_MIN_VALUE_PENCE
  ) {
    return 'prime';
  }

  // No value of its own. Judge the street instead: this is the path that
  // finally lets a probate notice reach the prime book.
  if (
    (input.valuePence === null || input.valuePence === undefined) &&
    typeof input.areaAvgPence === 'number' &&
    input.areaAvgPence >= PRIME_MIN_VALUE_PENCE
  ) {
    return 'prime';
  }

  return 'volume';
}

/**
 * The refurb-arbitrage signal — the thing the prime book actually runs on.
 *
 * `classifyTrack` answers "is this prime stock". It says nothing about
 * whether there is money in it. A £900k house priced at £900k is prime and
 * worthless to us. What the strategy needs is the conjunction:
 *
 *   1. priced BELOW what its street sells for, and
 *   2. carrying the condition that explains why, and that we can fix.
 *
 * Condition matters as much as the discount. A cheap house with nothing wrong
 * is usually cheap for a reason we cannot fix — a bad plot, a railway, a
 * short lease. A cheap house that is simply unmodernised is the whole thesis:
 * the discount is the refurb budget plus our margin.
 */
export interface PrimeOpportunity {
  /** How far below the area average, 0–1. Null when it cannot be computed. */
  discountToArea: number | null;
  /** Condition signals that explain a discount and imply refurb upside. */
  isRefurbCandidate: boolean;
  /** True when discount and condition BOTH point the right way. */
  isOpportunity: boolean;
  /** Founder-readable evidence. The dashboard shows these verbatim. */
  reasons: string[];
}

/** PropertyData distress badges that mean "needs work", not "is broken". */
const REFURB_LISTING_TYPES = new Set([
  'unmodernised-properties',
  'derelict-properties',
  'poor-epc-score',
]);

/** Below this, a discount is noise rather than an opportunity. */
export const MIN_MEANINGFUL_DISCOUNT = 0.1;

export function assessPrimeOpportunity(input: {
  valuePence?: number | null;
  areaAvgPence?: number | null;
  /** PropertyData listing type the lead was sourced from, if any. */
  listingType?: string | null;
  /** Any listing text, for condition language the badge missed. */
  text?: string | null;
}): PrimeOpportunity {
  const reasons: string[] = [];

  let discountToArea: number | null = null;
  if (
    typeof input.valuePence === 'number' &&
    input.valuePence > 0 &&
    typeof input.areaAvgPence === 'number' &&
    input.areaAvgPence > 0
  ) {
    discountToArea = 1 - input.valuePence / input.areaAvgPence;
    if (discountToArea >= MIN_MEANINGFUL_DISCOUNT) {
      reasons.push(
        `Asking ${Math.round(discountToArea * 100)}% below the area average`
      );
    }
  } else {
    reasons.push('No comparable area average — discount not measurable');
  }

  const badge = input.listingType ?? '';
  const textual = REFURB_TEXT.test(input.text ?? '');
  const isRefurbCandidate = REFURB_LISTING_TYPES.has(badge) || textual;
  if (isRefurbCandidate) {
    reasons.push(
      badge && REFURB_LISTING_TYPES.has(badge)
        ? `Condition signal: ${badge.replace(/-/g, ' ')}`
        : 'Condition signal: listing text describes an unmodernised property'
    );
  }

  const isOpportunity =
    discountToArea !== null &&
    discountToArea >= MIN_MEANINGFUL_DISCOUNT &&
    isRefurbCandidate;

  if (
    discountToArea !== null &&
    discountToArea >= MIN_MEANINGFUL_DISCOUNT &&
    !isRefurbCandidate
  ) {
    // Worth saying out loud. A discount with no condition reason behind it is
    // the pattern that hides an unfixable problem.
    reasons.push('Priced low with no condition reason found — check why');
  }

  return { discountToArea, isRefurbCandidate, isOpportunity, reasons };
}

/**
 * Should this lead carry an opportunity assessment, and what is it?
 *
 * The thin gate the pipeline calls once per lead. `assessPrimeOpportunity`
 * is the thesis; this decides WHO gets assessed:
 *
 * - `prime`  — always. Prime membership already implies the geography (or a
 *              value strong enough to clear the floor with no postcode).
 * - `block`  — only inside a prime district. A whole-building refurb in
 *              Muswell Hill is the strategy at larger scale; a block in a
 *              volume town belongs to the investor feed.
 * - `volume` — never. A £300k flat on a £1.4M street is a flat.
 *
 * Returns null when no assessment applies, so callers can stamp the payload
 * conditionally without re-encoding these rules.
 */
export function primeOpportunityForTrack(input: {
  track: DealTrackValue;
  postcode?: string | null;
  valuePence?: number | null;
  areaAvgPence?: number | null;
  listingType?: string | null;
  text?: string | null;
  /** Founder-marked prime districts (see isPrimeDistrict). */
  primeDistricts?: ReadonlySet<string>;
}): PrimeOpportunity | null {
  const assess =
    input.track === 'prime' ||
    (input.track === 'block' &&
      isPrimeDistrict(input.postcode, input.primeDistricts));
  if (!assess) {
    return null;
  }
  return assessPrimeOpportunity({
    valuePence: input.valuePence,
    areaAvgPence: input.areaAvgPence,
    listingType: input.listingType,
    text: input.text,
  });
}

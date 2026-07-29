/**
 * Sourcing-gate volume harness.
 *
 * Downstream appraisal costs real money (PropertyData credits + LLM calls), so
 * a change to the gate has to be justified on VOLUME, not just on principle.
 * This file scores a deterministic, realistic spread of synthetic leads —
 * modelled on the PropertyData /sourced-properties feed that produces virtually
 * every production lead — and pins two things:
 *
 *   1. The gate's pass-rate stays in a sane band (no flooding of the appraiser).
 *   2. The gate no longer keys off data availability: the same lead scored with
 *      and without HM Land Registry price-paid data lands on the same side.
 *
 * Deterministic on purpose (seeded LCG, no Math.random) so the numbers in the
 * PR description are reproducible and the assertions can't flake.
 */

import { describe, expect, it } from 'vitest';
import type { EnrichedLead } from '../enrichment';
import { type LeadSignals, scoreLead } from '../scorer';
import { DEFAULT_SCORER_CONFIG, mergeScorerConfig } from '../scorer-config';

// ── Deterministic RNG ──────────────────────────────────────────────────
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1_664_525) + 1_013_904_223) >>> 0;
    return s / 4_294_967_296;
  };
}

function weighted<T>(rng: () => number, table: Array<[T, number]>): T {
  const roll = rng();
  let acc = 0;
  for (const [value, weight] of table) {
    acc += weight;
    if (roll < acc) return value;
  }
  // rng() is always < 1, so a table whose weights sum to 1 always returns
  // above. Reaching here means the fixture itself is wrong — fail loudly
  // rather than silently biasing the population.
  throw new Error('weighted(): table weights must sum to 1');
}

// ── Synthetic population ───────────────────────────────────────────────

interface SyntheticLead {
  lead: EnrichedLead;
  signals: LeadSignals;
  /** HMLR area average in POUNDS, or null when the postcode has no price-paid data. */
  areaAvgPounds: number | null;
  hpiTrend: 'rising' | 'stable' | 'declining' | null;
}

function buildPopulation(count: number, seed = 20_260_729): SyntheticLead[] {
  const rng = makeRng(seed);
  const out: SyntheticLead[] = [];

  for (let i = 0; i < count; i++) {
    // Listing category mix mirrors what /sourced-properties actually returns
    // for our scan seeds — mostly reduced / slow-to-sell / chain-free stock,
    // with a thin tail of genuinely distressed lots.
    const listingType = weighted<string | undefined>(rng, [
      ['reduced-properties', 0.2],
      ['slow-to-sell-properties', 0.16],
      ['properties-with-no-chain', 0.13],
      ['quick-sale-properties', 0.07],
      ['cash-buyers-only-properties', 0.06],
      ['unmodernised-properties', 0.06],
      ['poor-epc-score', 0.05],
      ['back-on-market', 0.05],
      ['auction-properties', 0.04],
      ['repossessed-properties', 0.03],
      // No listing at all = an HMCTS/Gazette probate lead: no condition, no
      // days-on-market, no reductions. The cohort the raw gate hit hardest.
      [undefined, 0.15],
    ]);

    // PropertyData omits days_on_market on a meaningful slice of rows, and
    // HMCTS/Gazette leads have no listing at all — modelled as null, not 0.
    const daysOnMarket = listingType
      ? weighted<number | null>(rng, [
          [null, 0.15],
          [0, 0.15],
          [45, 0.18],
          [75, 0.17],
          [120, 0.22],
          [240, 0.13],
        ])
      : null;

    const velocityScore = listingType
      ? weighted<number>(rng, [
          [0, 0.6],
          [0.1, 0.15],
          [0.35, 0.15],
          [0.7, 0.07],
          [1.2, 0.03],
        ])
      : 0;

    const hasValue = rng() < 0.85;
    const valuePounds = 80_000 + Math.floor(rng() * 370_000);

    // THE LOTTERY: roughly half our postcodes come back with usable HMLR
    // price-paid data. Under the old raw gate this alone moved a lead by 5–11
    // points — enough to decide keep/drop on its own.
    const hasAreaComp = rng() < 0.5;
    const areaRatio = 0.7 + rng() * 0.9;

    const hpiTrend = weighted<'rising' | 'stable' | 'declining' | null>(rng, [
      ['rising', 0.25],
      ['stable', 0.25],
      ['declining', 0.1],
      [null, 0.4],
    ]);

    // Postcode-level enrichment (flood / EPC / tenure) is best-effort in the
    // pipeline and silently returns nothing for a good share of postcodes.
    const enrichedPostcode = rng() < 0.7;

    const floodRisk = enrichedPostcode
      ? weighted<string | null>(rng, [
          [null, 0.55],
          ['Low', 0.2],
          ['Medium', 0.15],
          ['High', 0.1],
        ])
      : null;

    const epcRating = enrichedPostcode
      ? weighted<string | null>(rng, [
          [null, 0.15],
          ['C', 0.2],
          ['D', 0.3],
          ['E', 0.2],
          ['F', 0.15],
        ])
      : null;

    const tenure = enrichedPostcode
      ? weighted<'freehold' | 'leasehold' | 'unknown'>(rng, [
          ['freehold', 0.55],
          ['leasehold', 0.3],
          ['unknown', 0.15],
        ])
      : 'unknown';
    const remainingLeaseYears =
      tenure === 'leasehold' ? 60 + Math.floor(rng() * 90) : null;

    const solicitorFirm = !listingType && rng() < 0.35 ? 'Acme Law' : null;

    out.push({
      lead: {
        probateRef: `synthetic-${i}`,
        address: `${i + 1} Test Street`,
        postcode: 'M14 5LL',
        // Every /sourced-properties row arrives with grantType 'unknown', which
        // enrichment maps to leadType 'probate' — so the base acquisition
        // credit is a constant 20 across the feed.
        leadType: 'probate',
        grantDate: '2026-06-01',
        grantType: 'unknown',
        daysSinceGrant: daysOnMarket ?? 0,
        goldenWindowLabel: 'cold',
        solicitorFirm,
        estateValuePence: hasValue ? valuePounds * 100 : null,
        contactName: null,
        contactPhone: null,
        contactEmail: null,
        enrichmentTier: 3,
        sourceTrail: 'propertydata → tier3/manual',
      },
      signals: {
        listingType,
        daysOnMarket,
        velocityScore,
        reductionCount: velocityScore > 0 ? 1 : 0,
        floodRisk,
        epcRating,
        tenure,
        remainingLeaseYears,
      },
      areaAvgPounds: hasValue && hasAreaComp ? valuePounds / areaRatio : null,
      hpiTrend,
    });
  }

  return out;
}

/** A lead with a price and nothing else — the base case for the sweep below. */
function plainLead(): EnrichedLead {
  return {
    probateRef: 'sweep',
    address: '1 Sweep Street',
    postcode: 'M14 5LL',
    leadType: 'probate',
    grantDate: '2026-06-01',
    grantType: 'unknown',
    daysSinceGrant: 0,
    goldenWindowLabel: 'cold',
    solicitorFirm: null,
    estateValuePence: 20_000_000,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    enrichmentTier: 3,
    sourceTrail: 'propertydata → tier3/manual',
  };
}

function score(sample: SyntheticLead) {
  const pricePaid = sample.areaAvgPounds
    ? ({ avgPrice: sample.areaAvgPounds } as never)
    : null;
  const hpi = sample.hpiTrend ? ({ trend: sample.hpiTrend } as never) : null;
  return scoreLead(sample.lead, pricePaid, hpi, sample.signals);
}

const POPULATION = buildPopulation(600);
const GATE = DEFAULT_SCORER_CONFIG.sourcingThreshold;

/** The gate as it was: raw pre-appraisal total against the THIN verdict band. */
const OLD_GATE = 30;

/** Each lead paired with its breakdown and both gates' answers. */
const RUN = POPULATION.map((sample) => {
  const breakdown = score(sample);
  const scoreable = breakdown.verdict !== 'INSUFFICIENT_DATA';
  return {
    sample,
    breakdown,
    oldPass: scoreable && breakdown.total >= OLD_GATE,
    newPass: scoreable && breakdown.sourcingScore >= GATE,
  };
});
const SCORED = RUN.map((r) => r.breakdown);

describe('sourcing gate — volume impact', () => {
  it('reports the before/after pass counts (evidence for the change)', () => {
    const before = RUN.filter((r) => r.oldPass).length;
    const after = RUN.filter((r) => r.newPass).length;

    const table = [45, 50, 55, 60, 65, 70]
      .map((t) => {
        const n = SCORED.filter((b) => b.sourcingScore >= t).length;
        return `  threshold ${t} → ${n} (${((n / SCORED.length) * 100).toFixed(1)}%)`;
      })
      .join('\n');

    // Cohort split: leads with a listing (the PropertyData feed) vs leads
    // without one (HMCTS / Gazette probate). The second cohort has no
    // condition, no days-on-market and no reductions to earn from, so the raw
    // gate judged it against headroom it could never reach.
    const cohort = (withListing: boolean) => {
      const rows = RUN.filter(
        (r) => Boolean(r.sample.signals.listingType) === withListing
      );
      return `n=${rows.length} old=${rows.filter((r) => r.oldPass).length} new=${rows.filter((r) => r.newPass).length}`;
    };

    // Composition churn — how many leads actually swapped sides. Near-parity
    // totals could still hide a wholesale reshuffle, which is the interesting
    // number: those are the leads the old gate judged on missing data.
    const gained = RUN.filter((r) => r.newPass && !r.oldPass).length;
    const dropped = RUN.filter((r) => r.oldPass && !r.newPass).length;

    console.info(
      `[sourcing-gate] n=${SCORED.length} old(total>=${OLD_GATE})=${before} ` +
        `new(sourcingScore>=${GATE})=${after} ratio=${(after / Math.max(1, before)).toFixed(2)}×\n` +
        `  swapped in=${gained} swapped out=${dropped}\n` +
        `  listed cohort:   ${cohort(true)}\n` +
        `  unlisted cohort: ${cohort(false)}\n${table}`
    );

    // Downstream appraisal costs PropertyData credits + LLM calls, so the gate
    // must not multiply volume. It should land near parity: the change is about
    // WHICH leads survive, not how many. Anything outside 0.75–1.25× of the old
    // volume means the threshold needs retuning before shipping.
    expect(after / before).toBeGreaterThan(0.75);
    expect(after / before).toBeLessThan(1.25);
  });

  it('keeps the pass-rate inside a budget-safe band', () => {
    const passRate =
      SCORED.filter((b) => b.sourcingScore >= GATE).length / SCORED.length;
    // The cron slices raw grants to limit=30 before scoring, so this pass-rate
    // is the appraisal bill: ~20–28 leads/day at the top of the band.
    expect(passRate).toBeGreaterThan(0.5);
    expect(passRate).toBeLessThan(0.95);
  });

  it('no longer decides keep/drop on whether HMLR had price-paid data', () => {
    // The fair comparison: pin the equity ratio at the area average, so the
    // comparable carries NO information — the lead is identical either way and
    // only the data's presence differs. Under the raw gate that presence was
    // worth 5 points (9-point "equity at area average" band vs the 4-point
    // no-comparable stub), enough to decide the gate on its own.
    const pairs = POPULATION.map((s) => {
      const neutral = {
        ...s,
        areaAvgPounds: s.lead.estateValuePence
          ? s.lead.estateValuePence / 100
          : null,
      };
      return {
        withComp: score(neutral),
        withoutComp: score({ ...neutral, areaAvgPounds: null }),
      };
    });

    let oldFlips = 0;
    let newFlips = 0;
    for (const { withComp: a, withoutComp: b } of pairs) {
      if (a.total >= OLD_GATE !== b.total >= OLD_GATE) oldFlips++;
      if (a.sourcingScore >= GATE !== b.sourcingScore >= GATE) newFlips++;
    }
    console.info(
      `[sourcing-gate] neutral-comparable flips: old=${oldFlips} new=${newFlips}`
    );

    // A data source we don't control, carrying no information, must not be what
    // decides the gate. (The population is lumpy — real leads bunch on a few
    // acquisition totals — so the sweep below is the precise measurement; this
    // is the "does it actually help on realistic data" check.)
    expect(newFlips).toBeLessThan(oldFlips);
    expect(newFlips / SCORED.length).toBeLessThan(0.06);
  });

  it('narrows the comparable-data flip window to (almost) nothing', () => {
    // Precise version of the test above, free of population lumpiness: sweep
    // lead strength one point at a time by retuning the lead-type credit, and
    // count how many strengths change their keep/drop answer purely because the
    // area comparable was present. That count IS the size of the arbitrary zone.
    const flipped = { old: [] as number[], next: [] as number[] };
    for (let strength = 0; strength <= 45; strength++) {
      const config = mergeScorerConfig({
        leadTypeScores: { probate: strength },
      });
      const lead = plainLead();
      // No listing signals, unknown market, no risk data — only the lead-type
      // credit and the ROI proxy move.
      const withComp = scoreLead(
        lead,
        { avgPrice: 200_000 } as never,
        null,
        {},
        config
      );
      const withoutComp = scoreLead(lead, null, null, {}, config);

      if (withComp.total >= OLD_GATE !== withoutComp.total >= OLD_GATE) {
        flipped.old.push(strength);
      }
      if (
        withComp.sourcingScore >= GATE !==
        withoutComp.sourcingScore >= GATE
      ) {
        flipped.next.push(strength);
      }
    }
    console.info(
      `[sourcing-gate] flip window (lead strength 0–45): old=${flipped.old.length} pts ${JSON.stringify(flipped.old)} ` +
        `new=${flipped.next.length} pts ${JSON.stringify(flipped.next)}`
    );

    expect(flipped.old.length).toBeGreaterThanOrEqual(4);
    expect(flipped.next.length).toBeLessThanOrEqual(1);
  });

  it('never lets an unappraised lead reach a STRONG-equivalent gate by accident', () => {
    // Sanity rail: the normalisation must not manufacture verdicts. `verdict`
    // is still derived from the raw total, so the appraised-lead contract the
    // dashboard keys off is untouched.
    for (const b of SCORED) {
      expect(b.appraised).toBe(false);
      expect(b.total).toBeLessThanOrEqual(
        DEFAULT_SCORER_CONFIG.dimensionCaps.acquisition +
          DEFAULT_SCORER_CONFIG.dimensionCaps.roi +
          DEFAULT_SCORER_CONFIG.dimensionCaps.marketTrend +
          DEFAULT_SCORER_CONFIG.dimensionCaps.riskMax
      );
    }
  });
});

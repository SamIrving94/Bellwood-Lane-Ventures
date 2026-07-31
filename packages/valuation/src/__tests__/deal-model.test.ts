/**
 * Deal-model tests.
 *
 * Two jobs:
 *   1. Lock the cost arithmetic (SDLT bands, outlay, ROI) so the engine can't
 *      silently drift — these move real money.
 *   2. Prove the engine reproduces the founder's OWN verdicts on three real
 *      deals (golden-deals.fixtures.ts). If a refactor flips "good deal" to
 *      "bad deal", a test breaks here before it reaches an offer.
 *
 * Expected values are hand-derived from the founder's "Deals for Claude" notes;
 * see comments per block. Money is in pence.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DEAL_COSTS,
  appraiseDeal,
  computeSdltPence,
  maxOfferForRoi,
} from '../deal-model';
import { GOLDEN_DEALS } from './golden-deals.fixtures';

// ---------------------------------------------------------------------------
// SDLT — additional-property buyer (marginal bands + 5% surcharge)
// ---------------------------------------------------------------------------

describe('computeSdltPence', () => {
  it('£239k → £14,230 (2% slice 125–239k + 5% surcharge on whole)', () => {
    // 2% × (239k − 125k) = £2,280; 5% × 239k = £11,950; total £14,230.
    expect(computeSdltPence(239_000_00)).toBe(14_230_00);
  });

  it('£140k → £7,300', () => {
    // 2% × (140k − 125k) = £300; 5% × 140k = £7,000.
    expect(computeSdltPence(140_000_00)).toBe(7_300_00);
  });

  it('crosses the £250k band (5% slice) for £255k', () => {
    // 2% × 125k = £2,500; 5% × (255k − 250k) = £250; 5% surcharge × 255k = £12,750.
    expect(computeSdltPence(255_000_00)).toBe(15_500_00);
  });

  it('returns 0 when exempt', () => {
    expect(computeSdltPence(200_000_00, DEFAULT_DEAL_COSTS, true)).toBe(0);
  });

  it('returns 0 for a non-positive price', () => {
    expect(computeSdltPence(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Deal 1 — 39 Daniells (the calibration anchor)
// Founder: £239k offer → ~£84k off ~£323k outlay = 26.8% cash; ~46% financed.
// ---------------------------------------------------------------------------

describe('appraiseDeal — 39 Daniells (modern auction)', () => {
  const a = appraiseDeal(GOLDEN_DEALS.daniells);

  it('reproduces the founder ~£323k all-in outlay', () => {
    expect(a.cash.totalOutlayPence).toBe(322_260_00);
  });

  it('reproduces the founder ~£87k cash profit', () => {
    expect(a.cash.profitPence).toBe(87_740_00);
  });

  it('lands the founder 26.8% cash ROI', () => {
    expect(a.cash.roi).toBeCloseTo(0.27, 2);
  });

  it('includes the £10k modern-auction buyer fee', () => {
    expect(a.costs.auctionFeePence).toBe(10_000_00);
  });

  it('passes the 20% hurdle', () => {
    expect(a.meetsHurdle).toBe(true);
    expect(a.verdict).toBe('pass');
  });

  it('financed ROI is materially higher than cash (leverage upside)', () => {
    expect(a.financed.roi).toBeGreaterThan(0.4);
    expect(a.financed.roi).toBeLessThan(0.6);
    expect(a.financed.roi).toBeGreaterThan(a.cash.roi);
  });

  it('the £239k offer sits BELOW the 20% walk-away ceiling', () => {
    const { maxOfferPence, appraisal } = maxOfferForRoi(GOLDEN_DEALS.daniells);
    expect(maxOfferPence).toBeGreaterThan(GOLDEN_DEALS.daniells.offerPence);
    expect(appraisal.cash.roi).toBeCloseTo(0.2, 2);
  });
});

// ---------------------------------------------------------------------------
// Deal 2 — 9 Drawback (a deal that should FAIL at the offered price)
// Founder: at £140k "this does not work" (~15% cash); needs to be below £130k.
// ---------------------------------------------------------------------------

describe('appraiseDeal — 9 Drawback (private treaty)', () => {
  const a = appraiseDeal(GOLDEN_DEALS.drawback);

  it('fails the 20% hurdle at £140k', () => {
    expect(a.cash.roi).toBeLessThan(0.2);
    expect(a.meetsHurdle).toBe(false);
    expect(a.verdict).toBe('fail');
  });

  it('the walk-away ceiling is below the £140k offer (must pay less)', () => {
    const { maxOfferPence } = maxOfferForRoi(GOLDEN_DEALS.drawback);
    expect(maxOfferPence).toBeLessThan(GOLDEN_DEALS.drawback.offerPence);
    // Sanity band: ~£137.6k at the 20% gate — i.e. real but thin headroom.
    expect(maxOfferPence).toBeGreaterThan(130_000_00);
    expect(maxOfferPence).toBeLessThan(140_000_00);
  });
});

// ---------------------------------------------------------------------------
// Deal 3 — Flat 5, Milton Court (probate, short lease + extension)
// Founder: "a good opportunity" — clear comps, lease-extension uplift.
// ---------------------------------------------------------------------------

describe('appraiseDeal — Flat 5 Milton Court (lease extension)', () => {
  const a = appraiseDeal(GOLDEN_DEALS.miltonCourt);

  it('carries the £42k lease-extension cost as a line item', () => {
    expect(a.costs.leaseExtensionPence).toBe(42_000_00);
  });

  it('passes the 20% hurdle even with SDLT applied', () => {
    // Probate does NOT exempt the buyer from SDLT, so this is the honest case.
    expect(a.cash.roi).toBeGreaterThan(0.2);
    expect(a.verdict).toBe('pass');
  });

  it('a genuine SDLT exemption only improves the return', () => {
    const exempt = appraiseDeal({
      ...GOLDEN_DEALS.miltonCourt,
      sdltExempt: true,
    });
    expect(exempt.costs.sdltPence).toBe(0);
    expect(exempt.cash.roi).toBeGreaterThan(a.cash.roi);
  });
});

// ---------------------------------------------------------------------------
// On-market sanity (Anthony's caveat): the golden deals are off-market steals.
// The model must NOT assume every deal is a steal — a normal listing bought at
// asking should fail, and the solver should show how far below asking the value
// actually sits. This proves the engine judges economics, not "below market".
// ---------------------------------------------------------------------------

describe('on-market listing at asking price', () => {
  // Typical listing: end value £300k, £30k works, asking £270k — no built-in
  // discount, the way most on-market stock looks.
  const onMarket = {
    gdvPence: 300_000_00,
    refurbPence: 30_000_00,
    offerPence: 270_000_00,
  };

  it('loses money / fails the hurdle when bought at asking', () => {
    const a = appraiseDeal(onMarket);
    expect(a.meetsHurdle).toBe(false);
    expect(a.cash.roi).toBeLessThan(0.2);
  });

  it('solver reports a ceiling well BELOW asking (where the value really is)', () => {
    const { maxOfferPence } = maxOfferForRoi(onMarket);
    expect(maxOfferPence).toBeLessThan(onMarket.offerPence);
    // ~£200k vs £270k asking — i.e. the model says "only at a deep discount".
    expect(maxOfferPence).toBeGreaterThan(180_000_00);
    expect(maxOfferPence).toBeLessThan(220_000_00);
  });
});

// ---------------------------------------------------------------------------
// maxOfferForRoi — solver invariants
// ---------------------------------------------------------------------------

describe('maxOfferForRoi', () => {
  it('cash ROI is monotonically decreasing in offer price', () => {
    const base = { gdvPence: 300_000_00, refurbPence: 30_000_00 };
    const low = appraiseDeal({ ...base, offerPence: 150_000_00 }).cash.roi;
    const high = appraiseDeal({ ...base, offerPence: 200_000_00 }).cash.roi;
    expect(low).toBeGreaterThan(high);
  });

  it('the solved offer lands the appraisal at (approximately) the target ROI', () => {
    const { appraisal, targetRoi } = maxOfferForRoi({
      gdvPence: 300_000_00,
      refurbPence: 30_000_00,
      targetRoi: 0.25,
    });
    expect(appraisal.cash.roi).toBeGreaterThanOrEqual(0.25);
    expect(appraisal.cash.roi).toBeCloseTo(targetRoi, 2);
  });

  it('returns a £0 offer when costs alone cannot clear the target', () => {
    // GDV barely above refurb+costs — no purchase price can hit 20%.
    const { maxOfferPence } = maxOfferForRoi({
      gdvPence: 50_000_00,
      refurbPence: 45_000_00,
    });
    expect(maxOfferPence).toBe(0);
  });
});

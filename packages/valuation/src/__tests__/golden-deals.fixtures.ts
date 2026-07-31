/**
 * Golden deal fixtures — the founder's real worked appraisals.
 *
 * Source: "Deals for Claude" hand-off (3 deals the founder analysed and, in two
 * cases, transacted). These encode the house deal-economics model and act as a
 * regression anchor for deal-model.ts: if the engine ever stops reproducing the
 * founder's own verdicts, a test breaks.
 *
 * ⚠️ IMPORTANT CALIBRATION CAVEAT (per Anthony's note alongside the hand-off):
 * all three are OFF-MARKET deals sourced WELL BELOW market value. They are the
 * kind of steal the team finds privately — they are NOT a representative sample
 * of on-market listings. Do not treat these offer prices as a target "discount
 * off market" the model must reproduce. deal-model.ts is deliberately bottom-up
 * (GDV − costs → ROI) precisely so it does NOT overfit to these prices: it
 * judges ANY deal, on- or off-market, by the same return gate. An on-market
 * listing simply shows thin/negative ROI at asking, and `maxOfferForRoi` reports
 * how far below asking you'd have to be. (Follow-up: add 1–2 on-market examples
 * so the suite also proves the model correctly low-balls / rejects them.)
 *
 * All money in PENCE. The `note` on each captures the founder's own conclusion.
 */

import type { AcquisitionRoute } from '../deal-model';

/** Where the deal came from — guards against treating off-market steals as typical. */
export type MarketContext = 'off_market' | 'on_market';

export interface GoldenDeal {
  name: string;
  route: AcquisitionRoute;
  /** Off-market (below market value) vs a normal on-market listing. */
  marketContext: MarketContext;
  gdvPence: number;
  refurbPence: number;
  /** The price the founder actually offered / paid. */
  offerPence: number;
  leaseExtensionPence?: number;
  /** Founder flagged this as probate. Does NOT exempt the buyer from SDLT. */
  probate?: boolean;
  /** The founder's own verdict, in their words. */
  note: string;
}

export const GOLDEN_DEALS: Record<string, GoldenDeal> = {
  // ── 39 Daniells, Welwyn Garden City AL7 1QY ────────────────────────────────
  // Guide £270k; refurb ~£50k; end value ~£410k; modern auction (~£10k extra
  // fees). Founder offered £239k → "pre-finance profit of circa £84K off of an
  // outlay of around £323k (26.8% ROI)". This is the calibration anchor.
  daniells: {
    name: '39 Daniells, Welwyn Garden City',
    route: 'auction_modern',
    marketContext: 'off_market',
    gdvPence: 410_000_00,
    refurbPence: 50_000_00,
    offerPence: 239_000_00,
    note: 'Offered £239k → ~£84k / ~£323k = 26.8% cash; ~46% financed. Good deal.',
  },

  // ── 9 Drawback, Prudhoe NE42 5BE ───────────────────────────────────────────
  // Price £140k; refurb ~£40k; end value ~£230k (founder: "may be conservative
  // … wide range"). Founder: at £140k "this does not work" — ~15% cash. Wants to
  // get below £130k. Tests the FAIL path + the walk-away ceiling.
  drawback: {
    name: '9 Drawback, Prudhoe',
    route: 'private_treaty',
    marketContext: 'off_market',
    gdvPence: 230_000_00,
    refurbPence: 40_000_00,
    offerPence: 140_000_00,
    note: 'At £140k does not work (~15% cash). Needs to be below £130k.',
  },

  // ── Flat 5, Milton Court, Gravesend ────────────────────────────────────────
  // Auction guide £110k; purchased £136k; probate; short lease 83yrs; lease
  // extension ~£42k incl. costs; refurb ~£10k; end value (post-extension) £250k.
  // Founder: "a good opportunity … obtained a cash offer for the full asking
  // price within a month". Tests the lease-extension line + PASS path.
  miltonCourt: {
    name: 'Flat 5, Milton Court, Gravesend',
    route: 'private_treaty',
    marketContext: 'off_market',
    gdvPence: 250_000_00,
    refurbPence: 10_000_00,
    offerPence: 136_000_00,
    leaseExtensionPence: 42_000_00,
    probate: true,
    note: 'Good opportunity — clear comps, lease-extension uplift, minimal refurb. Sold fast.',
  },
};

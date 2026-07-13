/**
 * Deal model — bottom-up flip / BRRR ROI economics (deal-model.ts)
 *
 * The AVM offer engine (offer-calculation.ts) sizes an offer as a haircut BELOW
 * the current market value: "what should we pay relative to comparable sales".
 * That is necessary but it does NOT answer the question the founder actually
 * underwrites every deal on:
 *
 *   Given the END value after refurb (GDV), the refurb spend, and ALL the
 *   buying / holding / selling costs — what is the most we can pay and still
 *   clear our minimum return, and what return does a given offer actually yield?
 *
 * This module implements that worked model. It is calibrated against three of
 * the founder's real appraisals (see __tests__/golden-deals.fixtures.ts):
 *
 *   - 39 Daniells, Welwyn GC       (modern auction)        — the GATE example
 *   - 9 Drawback, Prudhoe          (private treaty)        — a deal that fails
 *   - Flat 5 Milton Ct, Gravesend  (probate, short lease)  — lease-extension uplift
 *
 * The cost defaults below reproduce 39 Daniells almost exactly: £239k offer →
 * ~£323k all-in outlay, ~£87k profit, ~27% cash ROI, matching the founder's own
 * "£84k off ~£323k (26.8%)" working. Marginal/uncertain deals (9 Drawback) get
 * extra conservatism from founder judgment ON TOP of this baseline — per the
 * house "Steps vs Thoughts" philosophy, the model automates the arithmetic; the
 * founder owns the haircut.
 *
 * Money is in PENCE (integers) throughout, matching the rest of the codebase.
 *
 * Two returns are reported on every deal:
 *   - CASH ROI     = profit / total cash outlay        (the GATE: default ≥ 20%)
 *   - FINANCED ROI = profit-after-finance / cash-in     (upside, never the gate)
 *
 * Pure module (no `server-only`) so a founder what-if UI can import it and run
 * scenarios client-side, the same way offer-config.ts is consumed.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * How the property is acquired — drives auction buyer fees. "Modern" / online
 * auctions (reservation-fee model) add a material buyer premium on top of the
 * usual SDLT + legals; traditional auctions and private treaty do not.
 */
export type AcquisitionRoute =
  | 'private_treaty'
  | 'auction_traditional'
  | 'auction_modern';

/** A marginal SDLT band: pay `rate` on the slice of price at/above `thresholdPence`. */
export interface SdltBand {
  thresholdPence: number;
  rate: number;
}

export interface DealCostConfig {
  /** SDLT (England/NI) for an additional-property / investment buyer. */
  sdlt: {
    /**
     * Marginal bands, ascending by threshold. The first band MUST start at 0.
     * Tax for a band = (slice of price within [threshold_i, threshold_{i+1})) × rate_i.
     */
    bands: SdltBand[];
    /**
     * Surcharge applied to the WHOLE price for an additional/second property
     * (5% in England from 31 Oct 2024). Added on top of the marginal bands.
     */
    additionalPropertySurcharge: number;
  };
  /**
   * Purchase conveyancing fee, banded by purchase price (co-founder's rate
   * card, ex VAT). The fee for a price is the first band whose maxPricePence
   * is >= the price; prices above the last band use the last band's fee (the
   * card says "on request" there — we model with the top fee as the floor).
   */
  purchaseLegals: {
    bands: Array<{ maxPricePence: number; feeExVatPence: number }>;
    /** VAT applied on top of the ex-VAT fee (0.2 = 20%). */
    vatFraction: number;
  };
  /** Extra buyer fee charged by modern/online auctions, pence. */
  auctionModernFeePence: number;
  /** Refurb contingency as a fraction of the refurb budget (conservatism lever). */
  refurbContingencyFraction: number;
  /** Estate-agent selling fee as a fraction of GDV. */
  saleAgentFraction: number;
  /** Fixed solicitor / conveyancing cost on the sale, pence. */
  saleLegalsPence: number;
  /** Bridging-finance assumptions for the financed scenario. */
  finance: {
    /** Loan-to-value against the PURCHASE price. */
    ltv: number;
    /** Annual bridging interest rate (rolled up, paid at exit). */
    annualRate: number;
    /** Lender arrangement fee as a fraction of the loan (paid upfront). */
    arrangementFeeFraction: number;
    /** Expected hold in months — interest accrues over this window. */
    holdMonths: number;
  };
  /** Minimum CASH ROI a deal must clear to pass the gate. */
  targetCashRoi: number;
}

/**
 * Default cost assumptions, calibrated to the founder's 39 Daniells working.
 * Every field is a founder-tunable lever; nothing here is a hard rule of the
 * engine. Conservatism (e.g. raising refurbContingencyFraction or saleAgentFraction)
 * is expressed by overriding these, not by editing the maths.
 */
export const DEFAULT_DEAL_COSTS: DealCostConfig = {
  sdlt: {
    // England/NI residential bands (2025/26).
    bands: [
      { thresholdPence: 0, rate: 0 },
      { thresholdPence: 125_000_00, rate: 0.02 },
      { thresholdPence: 250_000_00, rate: 0.05 },
      { thresholdPence: 925_000_00, rate: 0.1 },
      { thresholdPence: 1_500_000_00, rate: 0.12 },
    ],
    additionalPropertySurcharge: 0.05,
  },
  // Purchase conveyancing rate card (co-founder supplied, ex VAT).
  purchaseLegals: {
    bands: [
      { maxPricePence: 200_000_00, feeExVatPence: 950_00 },
      { maxPricePence: 250_000_00, feeExVatPence: 1_150_00 },
      { maxPricePence: 300_000_00, feeExVatPence: 1_400_00 },
      { maxPricePence: 350_000_00, feeExVatPence: 1_550_00 },
      { maxPricePence: 400_000_00, feeExVatPence: 2_250_00 },
      { maxPricePence: 500_000_00, feeExVatPence: 3_000_00 },
    ],
    vatFraction: 0.2,
  },
  auctionModernFeePence: 10_000_00,
  refurbContingencyFraction: 0, // founder works refurb as "circa" all-in; raise to add headroom
  saleAgentFraction: 0.015,
  saleLegalsPence: 1_500_00,
  // Bridging assumptions (co-founder's rate card): 80% LTV, 1% admin fee on
  // the loan, 10%/yr rolled-up interest, and a 12-month term by default. No
  // exit or lender legal fees. Term is a what-if lever, override holdMonths
  // to model an earlier exit.
  finance: {
    ltv: 0.8,
    annualRate: 0.1,
    arrangementFeeFraction: 0.01,
    holdMonths: 12,
  },
  targetCashRoi: 0.2,
};

/**
 * Purchase conveyancing fee for a price, from the banded rate card, VAT
 * included. Prices above the top band use the top band's fee.
 */
export function computePurchaseLegalsPence(
  pricePence: number,
  config: DealCostConfig = DEFAULT_DEAL_COSTS
): number {
  const { bands, vatFraction } = config.purchaseLegals;
  const band =
    bands.find((b) => pricePence <= b.maxPricePence) ?? bands[bands.length - 1];
  return Math.round(band.feeExVatPence * (1 + vatFraction));
}

export interface DealInput {
  /** End value after refurb (Gross Development Value), pence. */
  gdvPence: number;
  /** Planned refurb spend, pence. */
  refurbPence: number;
  /** Price we would pay, pence. (Omit when solving via maxOfferForRoi.) */
  offerPence: number;
  /** Acquisition route — drives auction fees. Default private_treaty. */
  route?: AcquisitionRoute;
  /** Capital cost of a lease extension incl. fees, pence (short-lease deals). */
  leaseExtensionPence?: number;
  /**
   * Buyer is genuinely SDLT-exempt for this purchase (e.g. price below the
   * nil-rate threshold, or a confirmed relief). Default false. NOTE: probate
   * does NOT by itself exempt the BUYER from SDLT — only set this when a real
   * exemption applies.
   */
  sdltExempt?: boolean;
  /** Override any cost assumptions. */
  config?: DealCostConfig;
}

export interface DealCostBreakdown {
  sdltPence: number;
  purchaseLegalsPence: number;
  auctionFeePence: number;
  refurbPence: number;
  refurbContingencyPence: number;
  leaseExtensionPence: number;
  saleAgentPence: number;
  saleLegalsPence: number;
  /** Everything except the purchase price itself (buying + works + selling). */
  totalCostsPence: number;
}

export interface CashScenario {
  /** Purchase price + every cost (all-cash, no borrowing). */
  totalOutlayPence: number;
  /** GDV − totalOutlay. */
  profitPence: number;
  /** profit / totalOutlay. */
  roi: number;
}

export interface FinancedScenario {
  loanPence: number;
  depositPence: number;
  arrangementFeePence: number;
  interestPence: number;
  /** Cash the founder must put in (deposit + works + costs + arrangement fee). */
  cashInvestedPence: number;
  /** Cash profit − interest − arrangement fee. */
  profitPence: number;
  /** profitFinanced / cashInvested. */
  roi: number;
}

export type DealVerdict = 'pass' | 'marginal' | 'fail';

export interface DealAppraisal {
  gdvPence: number;
  offerPence: number;
  refurbPence: number;
  route: AcquisitionRoute;
  costs: DealCostBreakdown;
  cash: CashScenario;
  financed: FinancedScenario;
  targetCashRoi: number;
  /** cash.roi ≥ targetCashRoi. */
  meetsHurdle: boolean;
  /** pass ≥ target; marginal within 1 ppt below; fail otherwise. */
  verdict: DealVerdict;
}

// ---------------------------------------------------------------------------
// SDLT — marginal bands + additional-property surcharge
// ---------------------------------------------------------------------------

/**
 * Stamp Duty Land Tax for an additional/investment property. Sums the marginal
 * band charges then adds the whole-price surcharge. Returns 0 when `exempt`.
 */
export function computeSdltPence(
  pricePence: number,
  config: DealCostConfig = DEFAULT_DEAL_COSTS,
  exempt = false
): number {
  if (exempt || pricePence <= 0) {
    return 0;
  }

  const { bands, additionalPropertySurcharge } = config.sdlt;
  let tax = 0;

  for (let i = 0; i < bands.length; i++) {
    const lower = bands[i].thresholdPence;
    if (pricePence <= lower) {
      break;
    }
    const upper =
      i + 1 < bands.length
        ? bands[i + 1].thresholdPence
        : Number.POSITIVE_INFINITY;
    const slice = Math.min(pricePence, upper) - lower;
    tax += slice * bands[i].rate;
  }

  tax += pricePence * additionalPropertySurcharge;
  return Math.round(tax);
}

// ---------------------------------------------------------------------------
// Cost breakdown
// ---------------------------------------------------------------------------

function buildCosts(
  input: DealInput,
  config: DealCostConfig
): DealCostBreakdown {
  const route = input.route ?? 'private_treaty';
  const leaseExtensionPence = input.leaseExtensionPence ?? 0;

  const sdltPence = computeSdltPence(
    input.offerPence,
    config,
    input.sdltExempt
  );
  const purchaseLegalsPence = computePurchaseLegalsPence(
    input.offerPence,
    config
  );
  const auctionFeePence =
    route === 'auction_modern' ? config.auctionModernFeePence : 0;
  const refurbContingencyPence = Math.round(
    input.refurbPence * config.refurbContingencyFraction
  );
  const saleAgentPence = Math.round(input.gdvPence * config.saleAgentFraction);

  const totalCostsPence =
    sdltPence +
    purchaseLegalsPence +
    auctionFeePence +
    input.refurbPence +
    refurbContingencyPence +
    leaseExtensionPence +
    saleAgentPence +
    config.saleLegalsPence;

  return {
    sdltPence,
    purchaseLegalsPence,
    auctionFeePence,
    refurbPence: input.refurbPence,
    refurbContingencyPence,
    leaseExtensionPence,
    saleAgentPence,
    saleLegalsPence: config.saleLegalsPence,
    totalCostsPence,
  };
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

function gradeVerdict(roi: number, target: number): DealVerdict {
  if (roi >= target) {
    return 'pass';
  }
  if (roi >= target - 0.01) {
    return 'marginal';
  }
  return 'fail';
}

// ---------------------------------------------------------------------------
// Public API — appraise a single offer
// ---------------------------------------------------------------------------

/**
 * Full bottom-up appraisal of a deal at a given offer price. Reports the cost
 * breakdown, the all-cash scenario (the gate) and the bridged-finance scenario
 * (upside), plus a verdict against the cash ROI hurdle.
 */
export function appraiseDeal(input: DealInput): DealAppraisal {
  const config = input.config ?? DEFAULT_DEAL_COSTS;
  const route = input.route ?? 'private_treaty';
  const costs = buildCosts(input, config);

  // All-cash scenario
  const totalOutlayPence = input.offerPence + costs.totalCostsPence;
  const cashProfitPence = input.gdvPence - totalOutlayPence;
  const cashRoi = totalOutlayPence > 0 ? cashProfitPence / totalOutlayPence : 0;

  // Financed scenario — loan against purchase, interest rolled up to exit,
  // selling costs settled from sale proceeds (not upfront cash).
  const fin = config.finance;
  const loanPence = Math.round(input.offerPence * fin.ltv);
  const depositPence = input.offerPence - loanPence;
  const arrangementFeePence = Math.round(
    loanPence * fin.arrangementFeeFraction
  );
  const interestPence = Math.round(
    loanPence * fin.annualRate * (fin.holdMonths / 12)
  );

  // Cash the founder physically puts in: deposit + works + buying costs +
  // arrangement fee. (Selling costs come out of proceeds; interest is rolled up.)
  const cashInvestedPence =
    depositPence +
    costs.refurbPence +
    costs.refurbContingencyPence +
    costs.leaseExtensionPence +
    costs.sdltPence +
    costs.purchaseLegalsPence +
    costs.auctionFeePence +
    arrangementFeePence;

  const financedProfitPence =
    cashProfitPence - interestPence - arrangementFeePence;
  const financedRoi =
    cashInvestedPence > 0 ? financedProfitPence / cashInvestedPence : 0;

  const meetsHurdle = cashRoi >= config.targetCashRoi;

  return {
    gdvPence: input.gdvPence,
    offerPence: input.offerPence,
    refurbPence: input.refurbPence,
    route,
    costs,
    cash: {
      totalOutlayPence,
      profitPence: cashProfitPence,
      roi: cashRoi,
    },
    financed: {
      loanPence,
      depositPence,
      arrangementFeePence,
      interestPence,
      cashInvestedPence,
      profitPence: financedProfitPence,
      roi: financedRoi,
    },
    targetCashRoi: config.targetCashRoi,
    meetsHurdle,
    verdict: gradeVerdict(cashRoi, config.targetCashRoi),
  };
}

// ---------------------------------------------------------------------------
// Public API — solve for the maximum offer at a target return
// ---------------------------------------------------------------------------

export interface MaxOfferResult {
  /** Highest whole-pence offer whose cash ROI is ≥ targetRoi (0 if none). */
  maxOfferPence: number;
  /** The full appraisal at that offer. */
  appraisal: DealAppraisal;
  /** The target cash ROI the offer was solved against. */
  targetRoi: number;
}

/**
 * Solve for the highest offer that still clears `targetRoi` on the CASH number.
 *
 * Cash ROI is strictly decreasing in the offer price (you pay more → you make
 * less), so we binary-search the offer in [0, GDV]. The result is the founder's
 * walk-away ceiling for a deal — actual offers are pitched below it for margin.
 */
export function maxOfferForRoi(
  input: Omit<DealInput, 'offerPence'> & { targetRoi?: number }
): MaxOfferResult {
  const config = input.config ?? DEFAULT_DEAL_COSTS;
  const targetRoi = input.targetRoi ?? config.targetCashRoi;

  const roiAt = (offerPence: number): number =>
    appraiseDeal({ ...input, offerPence, config }).cash.roi;

  // If even a £0 offer can't hit the target (costs alone sink it), give up.
  if (roiAt(0) < targetRoi) {
    const appraisal = appraiseDeal({ ...input, offerPence: 0, config });
    return { maxOfferPence: 0, appraisal, targetRoi };
  }

  // Binary search to the nearest penny.
  let lo = 0;
  let hi = input.gdvPence;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (roiAt(mid) >= targetRoi) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const maxOfferPence = lo;
  const appraisal = appraiseDeal({
    ...input,
    offerPence: maxOfferPence,
    config,
  });
  return { maxOfferPence, appraisal, targetRoi };
}

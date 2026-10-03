/**
 * Compare ways to sell — estate agent vs auction vs cash buyer — on the
 * user's own numbers.
 *
 * The rules this module exists to keep (docs/mcp/02-ranking.md):
 *
 * 1. **No Kept figure.** Every price comes from the user. The cash-buyer row
 *    uses an offer the user already holds, or stays blank. This is the
 *    founder's no-figure rule and it is also what keeps the comparison
 *    buyer-agnostic enough to sit in an executor's decision file.
 * 2. **No verdict.** Routes come back in a fixed order with their trade-offs.
 *    The tool never ranks them or says which to pick.
 * 3. **Every assumption is visible.** A default (agent fee, months to
 *    complete) is labelled as one, with its source, and can be overridden.
 */

import { type CgtInput, estimateInheritedHomeCgt } from './cgt';
import { formatPounds } from './money';
import { SOURCES, type Source, VAT_RATE } from './sources';

export type SaleRoute = 'estate_agent' | 'auction' | 'cash_buyer';

export interface CompareSaleRoutesInput {
  /** What the user expects the home to fetch on the open market (their figure). */
  expectedPricePence: number;
  /** Agent fee as a percentage of the price, before VAT. Default 1.25. */
  agentFeePercent?: number;
  /** Price the user expects at auction. Defaults to expectedPricePence (flagged). */
  auctionPricePence?: number;
  /** Auction commission percentage, before VAT. Default 2.5. */
  auctionCommissionPercent?: number;
  /** Auction entry fee, including VAT. Not included unless given. */
  auctionEntryFeePence?: number;
  /** A cash offer the user already has. The cash row stays blank without one. */
  cashOfferPence?: number;
  /** The user's own legal fees, applied to every route. Not included unless given. */
  legalFeesPence?: number;
  /** Costs of holding the home per month (council tax, insurance, bills). */
  monthlyHoldingCostPence?: number;
  /** Months to completion per route. Defaults: agent 5, auction 2, cash 1. */
  monthsToComplete?: Partial<Record<SaleRoute, number>>;
  /** Optional CGT estimate for an inherited home. */
  cgt?: Omit<CgtInput, 'salePricePence' | 'sellingCostsPence'>;
}

export interface CostLine {
  label: string;
  pence: number;
}

export interface RouteResult {
  route: SaleRoute;
  label: string;
  /** Null for the cash row when the user holds no offer. */
  pricePence: number | null;
  costs: CostLine[];
  /** Price minus every cost line. Null when the price is unknown. */
  netPence: number | null;
  monthsToComplete: number;
  timing: string;
  certainty: string;
  suitsWhen: string;
  wrongFor: string;
  assumptions: string[];
}

export interface CompareSaleRoutesResult {
  routes: RouteResult[];
  /** Inputs that would make the comparison more complete. */
  missing: string[];
  notes: string[];
  sources: Source[];
}

const DEFAULT_AGENT_FEE_PERCENT = 1.25;
const DEFAULT_AUCTION_COMMISSION_PERCENT = 2.5;
const DEFAULT_MONTHS: Record<SaleRoute, number> = {
  estate_agent: 5,
  auction: 2,
  cash_buyer: 1,
};

function pctWithVat(pricePence: number, percent: number): number {
  return Math.round(pricePence * (percent / 100) * (1 + VAT_RATE));
}

function buildRoute(
  base: Omit<RouteResult, 'netPence' | 'costs'> & { feeLines: CostLine[] },
  input: CompareSaleRoutesInput
): RouteResult {
  const costs = [...base.feeLines];
  if (input.legalFeesPence && input.legalFeesPence > 0) {
    costs.push({ label: 'Your legal fees', pence: input.legalFeesPence });
  }
  if (input.monthlyHoldingCostPence && input.monthlyHoldingCostPence > 0) {
    costs.push({
      label: `Holding costs, ${base.monthsToComplete} month${base.monthsToComplete === 1 ? '' : 's'}`,
      pence: input.monthlyHoldingCostPence * base.monthsToComplete,
    });
  }
  if (input.cgt && base.pricePence !== null) {
    const selling = costs
      .filter((c) => !c.label.startsWith('Holding costs'))
      .reduce((sum, c) => sum + c.pence, 0);
    const cgt = estimateInheritedHomeCgt({
      ...input.cgt,
      salePricePence: base.pricePence,
      sellingCostsPence: selling,
    });
    if (cgt.taxPence > 0) {
      costs.push({
        label: 'Capital Gains Tax (estimate)',
        pence: cgt.taxPence,
      });
    }
  }
  const total = costs.reduce((sum, c) => sum + c.pence, 0);
  const { feeLines: _feeLines, ...rest } = base;
  return {
    ...rest,
    costs,
    netPence: base.pricePence === null ? null : base.pricePence - total,
  };
}

export function compareSaleRoutes(
  input: CompareSaleRoutesInput
): CompareSaleRoutesResult {
  if (
    !Number.isFinite(input.expectedPricePence) ||
    input.expectedPricePence <= 0
  ) {
    throw new Error('expectedPricePence must be a positive number of pence');
  }
  const months = { ...DEFAULT_MONTHS, ...input.monthsToComplete };
  const agentPct = input.agentFeePercent ?? DEFAULT_AGENT_FEE_PERCENT;
  const auctionPct =
    input.auctionCommissionPercent ?? DEFAULT_AUCTION_COMMISSION_PERCENT;
  const auctionPrice = input.auctionPricePence ?? input.expectedPricePence;

  const agentAssumptions: string[] = [];
  if (input.agentFeePercent === undefined) {
    agentAssumptions.push(
      `Agent fee assumed at ${DEFAULT_AGENT_FEE_PERCENT}% plus VAT (typical range 1–1.5%). Use your agent's quote.`
    );
  }
  if (input.monthsToComplete?.estate_agent === undefined) {
    agentAssumptions.push(
      `${DEFAULT_MONTHS.estate_agent} months to complete assumed (a typical sale takes 4–6 months).`
    );
  }

  const auctionAssumptions: string[] = [];
  if (input.auctionPricePence === undefined) {
    auctionAssumptions.push(
      'Auction price assumed equal to your open-market figure. Auction results can land above or below it; ask the auctioneer for an appraisal.'
    );
  }
  if (input.auctionCommissionPercent === undefined) {
    auctionAssumptions.push(
      `Commission assumed at ${DEFAULT_AUCTION_COMMISSION_PERCENT}% plus VAT. Use the auction house's terms.`
    );
  }
  if (input.auctionEntryFeePence === undefined) {
    auctionAssumptions.push('Entry fee not included. Ask the auction house.');
  }

  const cashAssumptions: string[] = [];
  if (input.cashOfferPence === undefined) {
    cashAssumptions.push(
      'No cash offer entered. Cash buyers pay below open-market for speed and certainty; enter an offer you hold to compare it.'
    );
  }

  const routes: RouteResult[] = [
    buildRoute(
      {
        route: 'estate_agent',
        label: 'Estate agent (open market)',
        pricePence: input.expectedPricePence,
        feeLines: [
          {
            label: `Agent fee ${agentPct}% + VAT`,
            pence: pctWithVat(input.expectedPricePence, agentPct),
          },
        ],
        monthsToComplete: months.estate_agent,
        timing: 'Typically 4–6 months from listing to completion.',
        certainty:
          'Around 1 in 3 agreed sales collapse before completion. Nothing is binding until exchange.',
        suitsWhen:
          'You can wait months for the right buyer, and the home is in good condition in an area where homes sell well.',
        wrongFor:
          'A fixed date you must hit, or a home lenders are reluctant to lend on.',
        assumptions: agentAssumptions,
      },
      input
    ),
    buildRoute(
      {
        route: 'auction',
        label: 'Auction',
        pricePence: auctionPrice,
        feeLines: [
          {
            label: `Auction commission ${auctionPct}% + VAT`,
            pence: pctWithVat(auctionPrice, auctionPct),
          },
          ...(input.auctionEntryFeePence && input.auctionEntryFeePence > 0
            ? [
                {
                  label: 'Auction entry fee',
                  pence: input.auctionEntryFeePence,
                },
              ]
            : []),
        ],
        monthsToComplete: months.auction,
        timing:
          'At a traditional auction, contracts exchange when the hammer falls; completion usually follows within weeks.',
        certainty:
          'Certain once the hammer falls, but only if it sells. Entry fees are usually not refunded if it does not.',
        suitsWhen:
          'A home that needs work or that lenders will not lend on, where a fixed timetable matters more than the last pound.',
        wrongFor:
          'A home in good condition that would draw plenty of buyers on the open market.',
        assumptions: auctionAssumptions,
      },
      input
    ),
    buildRoute(
      {
        route: 'cash_buyer',
        label: 'Cash buyer',
        pricePence: input.cashOfferPence ?? null,
        feeLines: [],
        monthsToComplete: months.cash_buyer,
        timing:
          'Can complete in weeks rather than months, if the buyer has the funds ready.',
        certainty:
          'No chain and no mortgage. Ask for proof of funds, and in writing when and why the price could change.',
        suitsWhen:
          'You need a date you can rely on more than the highest price.',
        wrongFor:
          'If you can wait, waiting will usually get you more money on the open market.',
        assumptions: cashAssumptions,
      },
      input
    ),
  ];

  const missing: string[] = [];
  if (input.legalFeesPence === undefined) {
    missing.push('Your legal fees (ask your solicitor for a quote).');
  }
  if (input.monthlyHoldingCostPence === undefined) {
    missing.push(
      'Monthly holding costs (council tax, insurance, bills) while the home is unsold.'
    );
  }
  if (input.cashOfferPence === undefined) {
    missing.push('A cash offer, if you hold one.');
  }

  const notes = [
    `All prices are your figures (open market ${formatPounds(input.expectedPricePence)}). This is maths, not a valuation.`,
    'This compares money and time only. It does not say which route to choose.',
  ];
  if (input.cgt) {
    notes.push(
      'The CGT line is an estimate. It assumes no other gains, losses or reliefs. Check it with your solicitor or accountant.'
    );
  }

  const sources: Source[] = [
    SOURCES.agentFee,
    SOURCES.agentTime,
    SOURCES.fallThrough,
    SOURCES.auctionFees,
    SOURCES.vat,
  ];
  if (input.cgt) {
    sources.push(SOURCES.cgtRates, SOURCES.cgtAllowance, SOURCES.cgtBaseCost);
  }

  return { routes, missing, notes, sources };
}

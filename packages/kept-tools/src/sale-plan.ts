/**
 * A plan for selling in any of Kept's situations except an inherited home,
 * which has its own dated plan (inherited-home.ts).
 *
 * What it answers, on the user's own figures:
 *  - Can each way of selling finish by the date I have? (typical times,
 *    shown as assumptions)
 *  - What would I be left with after fees and the mortgage, and what is my
 *    share? (separation)
 *  - What should I do this week? (a checklist of actions and questions to
 *    ask, never legal claims we have not sourced)
 *
 * And, unprompted, when Kept is the wrong choice: the situation page's own
 * honest line, and a hard stop when the debt is bigger than the home, which
 * a fast sale does not fix (live site, /why-we-wont-buy-any-home).
 *
 * It never values the home and never picks a route.
 */

import { addMonths, parseIsoDate } from './inherited-home';
import {
  DEFAULT_MONTHS,
  ROUTE_LABELS,
  type SaleRoute,
  compareSaleRoutes,
} from './sale-routes';
import {
  DEBT_EXCEEDS_VALUE,
  SITUATION_INFO,
  type Situation,
} from './situations';
import { SOURCES, type Source } from './sources';

export type PlanSituation = Exclude<Situation, 'inherited'>;

export interface SalePlanInput {
  situation: PlanSituation;
  /** YYYY-MM-DD: the date the sale has to complete by, if there is one. */
  mustCompleteBy?: string;
  /** The open-market price the user expects or was quoted, in pence. Never ours. */
  expectedPricePence?: number;
  /** What clears the mortgage (redemption figure, with any early repayment charge), in pence. */
  mortgageOwedPence?: number;
  /** The user's share of what is left, 1 to 100. Defaults to 50 for a separation, else 100. */
  sharePercent?: number;
  /** YYYY-MM-DD. Defaults to today; injectable for tests. */
  today?: string;
}

export interface RouteTiming {
  route: SaleRoute;
  label: string;
  typicalMonths: number;
  /** YYYY-MM-DD: today plus the typical time. */
  completesAround: string;
  /** Null when there is no date to meet. */
  meetsDeadline: boolean | null;
  /** Days to spare (positive) or short (negative). Null without a date. */
  daysToSpare: number | null;
}

export interface RouteMoney {
  route: SaleRoute;
  label: string;
  /** Left after fees, before the mortgage. Null without a figure (cash: no offer entered). */
  netPence: number | null;
  afterMortgagePence: number | null;
  yourSharePence: number | null;
}

export interface SalePlan {
  situation: PlanSituation;
  label: string;
  mustCompleteBy: string | null;
  timing: RouteTiming[];
  money: RouteMoney[] | null;
  sharePercent: number;
  checklist: string[];
  /** The situation page's own line on when an estate agent is the better choice. */
  honest: string;
  debtExceedsValue: boolean;
  freeHelp: { label: string; url: string } | null;
  notes: string[];
  sources: Source[];
}

const DAY_MS = 86_400_000;
const ROUTES: SaleRoute[] = ['estate_agent', 'auction', 'cash_buyer'];

const AGENT_VIEWS =
  "Get two or three estate agents' views on the open-market price, so you know what you are working from.";
const EMPTY_HOME_INSURANCE =
  'Check the home insurance covers an empty home. Standard cover often stops after 30 to 60 days empty.';
const DISCRETION =
  'Decide whether you need discretion: no board, no online listing, no viewings by strangers.';

const CHECKLISTS: Record<PlanSituation, string[]> = {
  chain_break: [
    'Tell your solicitor today, and ask how long the seller of your next home will wait.',
    'Ask your estate agent whether anyone who viewed earlier is still looking.',
    'If you are buying with a mortgage, ask your lender or broker when your mortgage offer runs out.',
    'If you need to buy before you sell, ask a broker about bridging finance, and get the full cost in writing.',
    'Find out the date your next purchase has to complete by, and use it as your deadline.',
  ],
  separation: [
    'Agree in writing that the home will be sold and how the money will be split. Solicitors can do this between you.',
    'Ask your lender for a redemption statement, so you know exactly what clears the mortgage, including any early repayment charge.',
    'Ask your solicitor what each of you needs to sign, and when.',
    AGENT_VIEWS,
    "If the home is part of a court case or a dispute, follow the court's timetable first.",
  ],
  relocation: [
    'Set the date you need the sale finished by, so you can see which ways to sell can make it.',
    EMPTY_HOME_INSURANCE,
    'Ask your solicitor how you can prove your identity and sign the documents from abroad.',
    'Redirect your post, take meter readings, and leave keys with someone you trust.',
    AGENT_VIEWS,
  ],
  problem_property: [
    'Write down what you know about the problem, and gather any reports, guarantees or certificates.',
    "Ask a mortgage broker whether lenders will lend on the home as it is. If they won't, most buyers can't buy it, which leaves cash buyers and auctions.",
    'If you are thinking of fixing it first, get a quote for the work and compare it with selling as it is.',
    "Answer the property questions honestly when you sell. A problem that surfaces at the buyer's survey can end the sale.",
    "Get two or three estate agents' views on the open-market price, as it is and once fixed.",
  ],
  care_or_health: [
    'If you are selling for a parent or relative, ask a solicitor what authority you need, for example a lasting power of attorney.',
    "If the sale will pay for care, ask the council and a solicitor how the home's value is counted, before you sell.",
    EMPTY_HOME_INSURANCE,
    DISCRETION,
    AGENT_VIEWS,
  ],
  other: [
    'Decide the date you need to be done by, if there is one.',
    AGENT_VIEWS,
    'If there is a mortgage, ask your lender for a redemption statement.',
    'If money is tight, get free debt advice before you agree to anything fast.',
    DISCRETION,
  ],
};

/** Who Kept is the wrong buyer for, per situation (live site, /why-we-wont-buy-any-home). */
const WRONG_FOR: Partial<Record<PlanSituation, string>> = {
  chain_break:
    'If your sale is still progressing normally, with no fall-through risk, Kept is the wrong buyer: use a high-street agent.',
  separation:
    'If the home is the subject of an active legal dispute, speak to a solicitor before any cash buyer, Kept included. Kept will look again once the legal position is settled.',
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface Checked {
  today: Date;
  deadline: Date | null;
  sharePercent: number;
}

/** Throws on anything we would otherwise have to guess about. */
function check(input: SalePlanInput): Checked {
  const info = SITUATION_INFO[input.situation];
  if (!info || input.situation === ('inherited' as Situation)) {
    throw new Error(
      'Unknown situation. For an inherited home, use the inherited-home plan.'
    );
  }
  const today = parseIsoDate(
    input.today ?? new Date().toISOString().slice(0, 10),
    'today'
  );
  const deadline = input.mustCompleteBy
    ? parseIsoDate(input.mustCompleteBy, 'mustCompleteBy')
    : null;
  if (deadline && deadline.getTime() < today.getTime()) {
    throw new Error('mustCompleteBy is in the past');
  }
  for (const [field, value] of [
    ['expectedPricePence', input.expectedPricePence],
    ['mortgageOwedPence', input.mortgageOwedPence],
  ] as const) {
    if (value !== undefined && !(Number.isFinite(value) && value >= 0)) {
      throw new Error(`${field} must be zero or more`);
    }
  }
  const defaultShare = input.situation === 'separation' ? 50 : 100;
  const sharePercent = input.sharePercent ?? defaultShare;
  if (!(sharePercent > 0 && sharePercent <= 100)) {
    throw new Error('sharePercent must be between 1 and 100');
  }
  return { today, deadline, sharePercent };
}

function timingFor(today: Date, deadline: Date | null): RouteTiming[] {
  return ROUTES.map((route) => {
    const months = DEFAULT_MONTHS[route];
    const at = addMonths(today, months);
    const days = deadline
      ? Math.round((deadline.getTime() - at.getTime()) / DAY_MS)
      : null;
    return {
      route,
      label: ROUTE_LABELS[route],
      typicalMonths: months,
      completesAround: iso(at),
      meetsDeadline: days === null ? null : days >= 0,
      daysToSpare: days,
    };
  });
}

/** Null without a price: we never supply one. */
function moneyFor(
  price: number | undefined,
  mortgage: number,
  sharePercent: number
): RouteMoney[] | null {
  if (price === undefined || price <= 0) {
    return null;
  }
  return compareSaleRoutes({ expectedPricePence: price }).routes.map((r) => {
    const after = r.netPence === null ? null : r.netPence - mortgage;
    return {
      route: r.route,
      label: r.label,
      netPence: r.netPence,
      afterMortgagePence: after,
      yourSharePence:
        after === null ? null : Math.round((after * sharePercent) / 100),
    };
  });
}

function notesFor(
  input: SalePlanInput,
  hasMoney: boolean,
  sharePercent: number,
  debtExceedsValue: boolean
): string[] {
  const notes: string[] = [];
  if (debtExceedsValue) {
    notes.push(DEBT_EXCEEDS_VALUE.message);
  }
  const wrongFor = WRONG_FOR[input.situation];
  if (wrongFor) {
    notes.push(wrongFor);
  }
  if (hasMoney && input.sharePercent === undefined && sharePercent !== 100) {
    notes.push(
      `Your share is assumed to be ${sharePercent}%. Change it if your shares differ.`
    );
  }
  if (hasMoney) {
    notes.push(
      'The cash row stays blank until you have a real cash offer to compare.'
    );
  }
  notes.push(
    'Typical times, not promises: yours depend on the buyer, the solicitors and any chain.',
    'General information, not legal or financial advice.'
  );
  return notes;
}

function sourcesFor(situation: PlanSituation, hasMoney: boolean): Source[] {
  const sources: Source[] = [SOURCES.agentTime, SOURCES.keptCompletion];
  if (situation === 'chain_break') {
    sources.push(SOURCES.fallThrough);
  }
  if (CHECKLISTS[situation].includes(EMPTY_HOME_INSURANCE)) {
    sources.push(SOURCES.emptyInsurance);
  }
  if (hasMoney) {
    sources.push(SOURCES.agentFee, SOURCES.auctionFees, SOURCES.vat);
  }
  return sources;
}

export function planSale(input: SalePlanInput): SalePlan {
  const { today, deadline, sharePercent } = check(input);
  const info = SITUATION_INFO[input.situation];
  const price = input.expectedPricePence;
  const money = moneyFor(price, input.mortgageOwedPence ?? 0, sharePercent);
  const debtExceedsValue =
    price !== undefined &&
    input.mortgageOwedPence !== undefined &&
    input.mortgageOwedPence > price;

  return {
    situation: input.situation,
    label: info.label,
    mustCompleteBy: deadline ? iso(deadline) : null,
    timing: timingFor(today, deadline),
    money,
    sharePercent,
    checklist: CHECKLISTS[input.situation],
    honest: info.honest,
    debtExceedsValue,
    freeHelp: debtExceedsValue ? { ...DEBT_EXCEEDS_VALUE.freeHelp } : null,
    notes: notesFor(input, money !== null, sharePercent, debtExceedsValue),
    sources: sourcesFor(input.situation, money !== null),
  };
}

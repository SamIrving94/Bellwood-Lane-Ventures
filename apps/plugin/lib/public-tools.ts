/**
 * Kept's public plugin for ChatGPT and Claude: six read-only tools, no login.
 *
 * Ranked and specified in docs/mcp/02-ranking.md; build notes in
 * docs/mcp/05-build-plan.md. The rules every tool here keeps:
 *
 *  - **No Kept figure.** No AVM, no offer, no "indicative" range. Prices
 *    come from the user; data comes from open registers. (Founder rule.)
 *  - **No PropertyData.** Our licence is internal use only.
 *  - **No personal data stored.** Inputs are used to compute the answer and
 *    are not written anywhere (probate firewall).
 *  - **No verdict.** Tools lay out the maths and the trade-offs; the user
 *    decides.
 *
 * Descriptions are written from the phrases UK users actually type
 * (02-ranking.md) because ChatGPT picks tools by matching them.
 */

import type { McpServer } from '@modelcontextprotocol/server';
import {
  DEBT_EXCEEDS_VALUE,
  KNOWN_ISSUES,
  type KnownIssue,
  type PlanSituation,
  SITUATIONS,
  SOURCES,
  type Situation,
  compareSaleRoutes,
  estimateRenovation,
  formatPounds,
  planInheritedHome,
  planSale,
  poundsToPence,
} from '@repo/kept-tools';
import { z } from 'zod';
import { callSource, keptHandoff } from './links';
import { withUsageLogging } from './usage';
import { WIDGET_HTML, WIDGET_MIME, WIDGET_URI } from './widget';

/** Lazily loaded: it pulls in the EPC + Land Registry clients. */
async function loadPropertyFacts() {
  return await import('@repo/kept-tools/property-facts');
}

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const PLAN_SITUATIONS = SITUATIONS.filter((s) => s !== 'inherited') as [
  PlanSituation,
  ...PlanSituation[],
];

const pounds = (max: number) => z.number().positive().max(max);

function widgetMeta(invoking: string, invoked: string) {
  return {
    ui: { resourceUri: WIDGET_URI },
    'ui/resourceUri': WIDGET_URI,
    'openai/outputTemplate': WIDGET_URI,
    'openai/toolInvocation/invoking': invoking,
    'openai/toolInvocation/invoked': invoked,
  };
}

function errorResult(message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
}

export const PUBLIC_TOOL_NAMES = [
  'plan_my_sale',
  'compare_sale_routes',
  'plan_inherited_home',
  'estimate_renovation_cost',
  'get_property_facts',
] as const;

/** How a route's typical time compares with the user's date, in words. */
function deadlineWords(meetsDeadline: boolean | null): string {
  if (meetsDeadline === null) {
    return '';
  }
  return meetsDeadline ? ' (makes the date)' : ' (misses the date)';
}

export function registerPublicPlugin(server: McpServer): void {
  withUsageLogging(server, 'public');
  // Read per call: the client name only exists once initialize has run.
  // Which assistant is calling: its MCP client name, else its User-Agent.
  const sourceOf = (ctx: unknown) =>
    callSource(server.server.getClientVersion()?.name, ctx);
  server.registerResource(
    'kept-card',
    WIDGET_URI,
    {
      title: 'Kept card',
      description: 'Inline card for Kept plugin results.',
      mimeType: WIDGET_MIME,
    },
    () => ({
      contents: [
        {
          uri: WIDGET_URI,
          mimeType: WIDGET_MIME,
          text: WIDGET_HTML,
          _meta: {
            ui: {
              // No connect/resource domains: the card makes no requests.
              csp: { connectDomains: [], resourceDomains: [] },
              prefersBorder: true,
              ...(process.env.PLUGIN_WIDGET_DOMAIN
                ? { domain: process.env.PLUGIN_WIDGET_DOMAIN }
                : {}),
            },
            'openai/widgetDescription':
              'Shows the result as a card: which ways to sell can finish by a date, costs per sale route, a dated plan, renovation bands, or public-record facts. The card already shows every number.',
            'openai/ui': { availableDisplayModes: ['inline'] },
          },
        },
      ],
    })
  );

  // ---------------------------------------------------------------------
  // 0. Plan a sale in any of Kept's situations (the front door)
  // ---------------------------------------------------------------------
  server.registerTool(
    'plan_my_sale',
    {
      title: 'Plan a sale with a reason or a deadline',
      description:
        'Use when someone in the UK needs to sell a home and has a reason or a deadline: their buyer pulled out, they are separating, they are moving away or abroad, someone is moving into care, or the property has a problem (a short lease, structural movement, knotweed, cladding, or it needs a lot of work). Examples: "our buyer pulled out and we complete on our new house in six weeks, what can we do?", "we\'re divorcing and need to sell the house, how does it work?", "I\'m moving abroad in March, how fast can I sell?", "mum is going into a care home, how do we sell her house?", "can I sell a flat with a short lease?". Shows which ways of selling can finish by their date, what they would be left with after fees and the mortgage (and their share), a checklist for this week, and when an estate agent is the better choice. For an inherited home, plan_inherited_home is the dedicated plan. Never values the home: any price comes from the user.',
      inputSchema: z.object({
        situation: z
          .enum(PLAN_SITUATIONS)
          .describe(
            'chain_break: the buyer pulled out. separation: a divorce or a couple splitting up. relocation: moving away. problem_property: a short lease, structural issue, knotweed, cladding or major work. care_or_health: a move into care or a change in health. other: anything else.'
          ),
        mustCompleteBy: z
          .string()
          .regex(ISO_DATE)
          .optional()
          .describe(
            'Date the sale has to complete by, YYYY-MM-DD, if there is one: the onward purchase, the move, a court date.'
          ),
        expectedPricePounds: pounds(50_000_000)
          .optional()
          .describe(
            'The open-market price the user expects or has been quoted. Optional: without it the plan shows dates only. The tool has no price of its own.'
          ),
        mortgageOwedPounds: z
          .number()
          .min(0)
          .max(50_000_000)
          .optional()
          .describe(
            'What clears the mortgage, including any early repayment charge.'
          ),
        yourSharePercent: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "The user's share of the home, e.g. 50. Defaults to 50 for a separation."
          ),
      }),
      annotations: {
        title: 'Plan a sale with a reason or a deadline',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: widgetMeta('Building your plan…', 'Plan ready'),
    },
    (args, ctx) => {
      try {
        const plan = planSale({
          situation: args.situation,
          mustCompleteBy: args.mustCompleteBy,
          expectedPricePence:
            args.expectedPricePounds === undefined
              ? undefined
              : poundsToPence(args.expectedPricePounds),
          mortgageOwedPence:
            args.mortgageOwedPounds === undefined
              ? undefined
              : poundsToPence(args.mortgageOwedPounds),
          sharePercent: args.yourSharePercent,
        });
        const timing = plan.timing
          .map(
            (t) =>
              `${t.label}: typically completes around ${t.completesAround}${deadlineWords(t.meetsDeadline)}`
          )
          .join('; ');
        return {
          structuredContent: {
            kind: 'sale_plan',
            ...plan,
            // Kept is the wrong buyer when the debt is bigger than the home:
            // no handoff, only the free-advice link (live site rule).
            nextStep: plan.debtExceedsValue
              ? null
              : keptHandoff('plan_my_sale', sourceOf(ctx), plan.situation),
          },
          content: [
            {
              type: 'text' as const,
              text: `${plan.label}. ${timing}.${plan.debtExceedsValue ? ` ${DEBT_EXCEEDS_VALUE.message}` : ''} Typical times, not promises. General information, not legal or financial advice.`,
            },
          ],
        };
      } catch (err) {
        return errorResult(
          err instanceof Error ? err.message : 'Could not build the plan.'
        );
      }
    }
  );

  // ---------------------------------------------------------------------
  // 1. Compare ways to sell
  // ---------------------------------------------------------------------
  server.registerTool(
    'compare_sale_routes',
    {
      title: 'Compare ways to sell a home',
      description:
        'Use when someone in the UK asks whether to sell through an estate agent, at auction or to a cash buyer, or what they would actually be left with each way. Examples: "estate agent or cash buyer?", "we have a cash offer of £210k, the agent says £250k, what do we end up with?", "is auction a good idea for my dad\'s house?", "agent wants 1.5% plus VAT, how does that compare to cash?". Lays out money left after fees, time to complete and certainty for each route, on the figures the user gives. It never values the home and never says which route to pick. The price has to be one the user has been quoted or expects: the tool has no price of its own. The cash column uses a cash offer only if the user holds one.',
      inputSchema: z.object({
        expectedPricePounds: pounds(50_000_000).describe(
          'The open-market price the user expects or has been quoted, in pounds.'
        ),
        agentFeePercent: z
          .number()
          .min(0)
          .max(10)
          .optional()
          .describe("Agent's fee as a % of the price, before VAT."),
        auctionPricePounds: pounds(50_000_000)
          .optional()
          .describe('Price the user expects at auction, if different.'),
        auctionCommissionPercent: z.number().min(0).max(10).optional(),
        auctionEntryFeePounds: z.number().min(0).max(20_000).optional(),
        cashOfferPounds: pounds(50_000_000)
          .optional()
          .describe('A cash offer the user already holds. Never guess one.'),
        legalFeesPounds: z
          .number()
          .min(0)
          .max(100_000)
          .optional()
          .describe("The user's own solicitor fees."),
        monthlyHoldingCostPounds: z
          .number()
          .min(0)
          .max(50_000)
          .optional()
          .describe('Council tax, insurance and bills per month while unsold.'),
        inherited: z
          .object({
            probateValuePounds: pounds(50_000_000).describe(
              'Value at the date of death, as agreed for probate.'
            ),
            seller: z
              .enum(['executors', 'beneficiary'])
              .describe(
                'Who sells: the executors, or a beneficiary after transfer.'
              ),
            beneficiaryRateBand: z.enum(['basic', 'higher']).optional(),
          })
          .optional()
          .describe('Add for an inherited home to include a CGT estimate.'),
        situation: z
          .enum(SITUATIONS)
          .optional()
          .describe('Why they are selling, if they have said.'),
      }),
      annotations: {
        title: 'Compare ways to sell a home',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: widgetMeta('Comparing ways to sell…', 'Compared ways to sell'),
    },
    (args, ctx) => {
      try {
        const result = compareSaleRoutes({
          expectedPricePence: poundsToPence(args.expectedPricePounds),
          agentFeePercent: args.agentFeePercent,
          auctionPricePence:
            args.auctionPricePounds === undefined
              ? undefined
              : poundsToPence(args.auctionPricePounds),
          auctionCommissionPercent: args.auctionCommissionPercent,
          auctionEntryFeePence:
            args.auctionEntryFeePounds === undefined
              ? undefined
              : poundsToPence(args.auctionEntryFeePounds),
          cashOfferPence:
            args.cashOfferPounds === undefined
              ? undefined
              : poundsToPence(args.cashOfferPounds),
          legalFeesPence:
            args.legalFeesPounds === undefined
              ? undefined
              : poundsToPence(args.legalFeesPounds),
          monthlyHoldingCostPence:
            args.monthlyHoldingCostPounds === undefined
              ? undefined
              : poundsToPence(args.monthlyHoldingCostPounds),
          cgt: args.inherited
            ? {
                probateValuePence: poundsToPence(
                  args.inherited.probateValuePounds
                ),
                seller: args.inherited.seller,
                beneficiaryRateBand: args.inherited.beneficiaryRateBand,
              }
            : undefined,
        });
        const summary = result.routes
          .map(
            (r) =>
              `${r.label}: ${r.netPence === null ? 'no figure (no offer entered)' : `${formatPounds(r.netPence)} left`}, about ${r.monthsToComplete} month${r.monthsToComplete === 1 ? '' : 's'}`
          )
          .join('; ');
        return {
          structuredContent: {
            kind: 'sale_routes',
            ...result,
            nextStep: keptHandoff(
              'compare_sale_routes',
              sourceOf(ctx),
              args.situation ?? (args.inherited ? 'inherited' : undefined)
            ),
          },
          content: [
            {
              type: 'text' as const,
              text: `${summary}. These are the user's own figures: not a valuation, and not a recommendation. Missing inputs: ${result.missing.join(' ') || 'none'}`,
            },
          ],
        };
      } catch (err) {
        return errorResult(
          err instanceof Error ? err.message : 'Could not compare routes.'
        );
      }
    }
  );

  // ---------------------------------------------------------------------
  // 2. Inherited home: what now?
  // ---------------------------------------------------------------------
  server.registerTool(
    'plan_inherited_home',
    {
      title: 'Plan for an inherited home',
      description:
        'Use when someone has inherited a home or is an executor and asks what to do with the house, or about deadlines while waiting for probate. Examples: "my mum died and left me her house, what do we do with it?", "we\'re waiting for probate, what about dad\'s empty house?", "can we sell before probate is granted?", "do we pay council tax on an empty house in probate?", "give me a timeline for sorting out my late father\'s house". Builds a dated plan from the date of death (and grant date, if known): registering the death, Inheritance Tax due date, insurance on an empty home, council tax exemption and premium dates (England), when a sale can complete, and the 60-day CGT deadline. General information, not legal or tax advice. Dates must be real dates the user gives; ask for them if missing.',
      inputSchema: z.object({
        dateOfDeath: z
          .string()
          .regex(ISO_DATE)
          .describe('Date of death, YYYY-MM-DD.'),
        grantDate: z
          .string()
          .regex(ISO_DATE)
          .optional()
          .describe(
            'Date probate or letters of administration were granted, YYYY-MM-DD.'
          ),
        homeIsEmpty: z
          .boolean()
          .describe('True if nobody is living in the home.'),
        nation: z
          .enum(['england', 'wales', 'scotland', 'northern_ireland'])
          .optional()
          .describe('Where the home is. Defaults to England.'),
      }),
      annotations: {
        title: 'Plan for an inherited home',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: widgetMeta('Building the plan…', 'Plan ready'),
    },
    (args, ctx) => {
      try {
        const plan = planInheritedHome(args);
        // Dated steps only: "Register the death" can be due with no date.
        const next = plan.milestones.find(
          (m) =>
            m.date !== null &&
            (m.status === 'due_soon' || m.status === 'upcoming')
        );
        return {
          structuredContent: {
            kind: 'inherited_home_plan',
            ...plan,
            nextStep: keptHandoff(
              'plan_inherited_home',
              sourceOf(ctx),
              'inherited'
            ),
          },
          content: [
            {
              type: 'text' as const,
              text: `Plan built with ${plan.milestones.length} steps.${next ? ` Next dated step: ${next.title} on ${next.date}.` : ''} General information, not legal or tax advice.`,
            },
          ],
        };
      } catch (err) {
        return errorResult(
          err instanceof Error ? err.message : 'Could not build the plan.'
        );
      }
    }
  );

  // ---------------------------------------------------------------------
  // 3. Renovation cost estimate
  // ---------------------------------------------------------------------
  const issueKeys = Object.keys(KNOWN_ISSUES) as [KnownIssue, ...KnownIssue[]];
  server.registerTool(
    'estimate_renovation_cost',
    {
      title: 'Estimate renovation costs',
      description:
        'Use when someone in the UK asks roughly what it would cost to renovate, modernise or do up a home, or whether to do a house up before selling. Examples: "how much to renovate a 3 bed semi untouched since the 80s?", "should we do up mum\'s house before selling?", "rough cost of a full refurb on a 1930s terrace?", "the EPC is F, how much work does it need?". Gives light, full and heavy budget bands from the floor area, plus any known problems. Give floorAreaSqm if known; otherwise give addressLine and postcode to read the floor area from the public EPC register. Budget bands, not quotes, and never a value for the home.',
      inputSchema: z.object({
        floorAreaSqm: z.number().positive().max(2000).optional(),
        addressLine: z
          .string()
          .min(2)
          .max(200)
          .optional()
          .describe(
            'First line of the address, to look up the EPC floor area.'
          ),
        postcode: z.string().regex(UK_POSTCODE).optional(),
        knownIssues: z
          .array(z.enum(issueKeys))
          .max(8)
          .optional()
          .describe('Problems the user already knows about.'),
      }),
      annotations: {
        title: 'Estimate renovation costs',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        // Reads the public EPC register when given an address.
        openWorldHint: true,
      },
      _meta: widgetMeta('Estimating renovation costs…', 'Estimate ready'),
    },
    async (args, ctx) => {
      let floorAreaSqm = args.floorAreaSqm ?? null;
      let epc: {
        rating: string | null;
        constructionAgeBand: string | null;
      } | null = null;
      if (!floorAreaSqm && args.addressLine && args.postcode) {
        try {
          const { getEpcData } = await import('@repo/property-data');
          const e = await getEpcData(
            args.postcode.toUpperCase().trim(),
            args.addressLine
          );
          if (e.source !== 'unavailable') {
            floorAreaSqm = e.floorAreaSqm;
            epc = {
              rating: e.epcRating,
              constructionAgeBand: e.constructionAgeBand,
            };
          }
        } catch {
          // Fall through to the assumed floor area; the note says so.
        }
      }
      const est = estimateRenovation({
        floorAreaSqm,
        knownIssues: args.knownIssues,
      });
      return {
        structuredContent: {
          kind: 'renovation',
          ...est,
          epc,
          sources: epc ? [...est.sources, SOURCES.epcRegister] : est.sources,
          nextStep: keptHandoff(
            'estimate_renovation_cost',
            sourceOf(ctx),
            'problem_property'
          ),
        },
        content: [
          {
            type: 'text' as const,
            text: `Budget bands over ${Math.round(est.floorAreaSqm)} m²${est.assumedFloorArea ? ' (assumed)' : ''}: ${est.bands.map((b) => `${b.label} ${formatPounds(b.totalPence)}`).join(', ')}. Budget bands, not quotes, and not a valuation of the home.`,
          },
        ],
      };
    }
  );

  // ---------------------------------------------------------------------
  // Support: property facts (the Keyhole report)
  // ---------------------------------------------------------------------
  server.registerTool(
    'get_property_facts',
    {
      title: 'Look up public facts about a home',
      description:
        'Use when someone asks what is on public record about a specific UK home: its EPC rating, floor area, when it was built, or recorded sale prices in its postcode. Examples: "what\'s the EPC rating for 14 Elm Road, M14 5AB?", "when did this house last sell?", "what\'s on public record about my mum\'s house?", "what have houses sold for on this street?". Reads the EPC register and HM Land Registry Price Paid data. It is not a valuation and never prices the home.',
      inputSchema: z.object({
        addressLine: z
          .string()
          .min(2)
          .max(200)
          .describe('First line of the address, e.g. "14 Elm Road".'),
        postcode: z.string().regex(UK_POSTCODE),
      }),
      annotations: {
        title: 'Look up public facts about a home',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: widgetMeta(
        'Checking the public registers…',
        'Public record checked'
      ),
    },
    async (args, ctx) => {
      try {
        const { buildKeyholeReport } = await loadPropertyFacts();
        const report = await buildKeyholeReport(args);
        return {
          structuredContent: {
            kind: 'property_facts',
            report,
            notes: [
              'Public record only. Not a valuation of this home.',
              SOURCES.landRegistry.label,
            ],
            sources: [SOURCES.epcRegister, SOURCES.landRegistry],
            nextStep: keptHandoff('get_property_facts', sourceOf(ctx)),
          },
          content: [
            {
              type: 'text' as const,
              text: `EPC: ${report.epc.available ? `${report.epc.rating ?? 'rating not stated'}, ${report.epc.floorAreaSqm ? `${Math.round(report.epc.floorAreaSqm)} m²` : 'floor area not stated'}` : 'no certificate found (or the register could not be reached)'}. ${report.streetSales.length} recorded sales in ${report.postcode}${report.streetContext ? `, median £${report.streetContext.medianPricePounds.toLocaleString('en-GB')}` : ''}. These are recorded sales nearby, not a valuation of this home. ${SOURCES.landRegistry.label}.`,
            },
          ],
        };
      } catch (err) {
        console.error('[plugin] get_property_facts failed', err);
        return errorResult(
          'The public registers could not be reached just now. Try again shortly.'
        );
      }
    }
  );

  // ---------------------------------------------------------------------
  // 5. Put me in touch: a link, never a form filled in on the user's behalf
  // ---------------------------------------------------------------------
  // Link only (founder, 28 Nov 2026). The assistant does NOT collect or
  // submit the seller's details: the seller finishes our own form, with our
  // consent wording, and a person reviews it. So this tool takes no personal
  // data at all, only which situation page fits, and writes nothing anywhere.
  // Each answer maps to a Kept situation, so the link lands on that page
  // and carries that page's own line on when an agent is the better choice.
  const ENQUIRY_SITUATIONS = {
    probate: 'inherited',
    chain_break: 'chain_break',
    separation: 'separation',
    relocation: 'relocation',
    problem_property: 'problem_property',
    other: 'other',
  } as const satisfies Record<string, Situation>;
  server.registerTool(
    'get_enquiry_link',
    {
      title: 'Get a link to ask Kept for a written offer',
      description:
        'Use when the user, after talking about selling a UK home, says they want to get in touch with Kept or ask for an offer. Examples: "yes, can they contact me?", "how do I get an offer from Kept?", "I want to speak to them about my mum\'s house", "how do I apply?". Returns the right page on Kept\'s own site, where the user fills in the form themselves. Do NOT ask the user for their name, phone, email or address, and do NOT submit anything for them: this tool accepts no personal details. Say plainly what happens next: Kept views every home, then sends a written offer within two working days of the viewing; no price is given before that. If the user can wait for the open market, an estate agent will usually get more.',
      inputSchema: z.object({
        situation: z
          .enum([
            'probate',
            'chain_break',
            'separation',
            'relocation',
            'problem_property',
            'other',
          ])
          .optional()
          .describe(
            'The closest match to why they are selling: inherited or probate home, a buyer pulled out, separation, moving for work, a hard-to-sell property (damp, short lease, structural), or something else. Omit if unclear.'
          ),
      }),
      annotations: {
        title: 'Get a link to ask Kept for a written offer',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: widgetMeta('Finding the right page…', 'Link ready'),
    },
    ({ situation }, ctx) => {
      return {
        structuredContent: {
          kind: 'enquiry_link',
          nextStep: keptHandoff(
            'get_enquiry_link',
            sourceOf(ctx),
            ENQUIRY_SITUATIONS[situation ?? 'other']
          ),
        },
        content: [
          {
            type: 'text' as const,
            text: 'Link ready. Give the user the link and let them fill the form in themselves. Do not collect or submit their details. Kept views every home, then sends a written offer within two working days of the viewing. Do not state a price.',
          },
        ],
      };
    }
  );
}

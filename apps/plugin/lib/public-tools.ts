/**
 * Kept's public ChatGPT plugin: four read-only tools, no login.
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
  KNOWN_ISSUES,
  type KnownIssue,
  SOURCES,
  compareSaleRoutes,
  estimateRenovation,
  formatPounds,
  planInheritedHome,
  poundsToPence,
} from '@repo/kept-tools';
import { z } from 'zod';
import { keptHandoff } from './links';
import { withUsageLogging } from './usage';
import { WIDGET_HTML, WIDGET_MIME, WIDGET_URI } from './widget';

/** Lazily loaded: it pulls in the EPC + Land Registry clients. */
async function loadPropertyFacts() {
  return await import('@repo/kept-tools/property-facts');
}

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
  'compare_sale_routes',
  'plan_inherited_home',
  'estimate_renovation_cost',
  'get_property_facts',
] as const;

export function registerPublicPlugin(server: McpServer): void {
  withUsageLogging(server, 'public');
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
              'Shows the result as a card: costs per sale route, a dated plan, renovation bands, or public-record facts. The card already shows the numbers, so do not repeat every line.',
            'openai/ui': { availableDisplayModes: ['inline'] },
          },
        },
      ],
    })
  );

  // ---------------------------------------------------------------------
  // 1. Compare ways to sell
  // ---------------------------------------------------------------------
  server.registerTool(
    'compare_sale_routes',
    {
      title: 'Compare ways to sell a home',
      description:
        'Use when someone in the UK asks whether to sell through an estate agent, at auction or to a cash buyer, or what they would actually be left with each way. Examples: "estate agent or cash buyer?", "we have a cash offer of £210k, the agent says £250k, what do we end up with?", "is auction a good idea for my dad\'s house?", "agent wants 1.5% plus VAT, how does that compare to cash?". Lays out money left after fees, time to complete and certainty for each route, on the figures the user gives. It never values the home and never says which route to pick. Ask the user for a price they have been quoted or expect; do not invent one. Pass a cash offer only if the user actually holds one.',
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
    (args) => {
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
            nextStep: keptHandoff('/sell', 'compare_sale_routes'),
          },
          content: [
            {
              type: 'text' as const,
              text: `${summary}. These are the user's own figures, not a valuation. Present the trade-offs; do not recommend a route. Missing inputs: ${result.missing.join(' ') || 'none'}`,
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
    (args) => {
      try {
        const plan = planInheritedHome(args);
        const next = plan.milestones.find(
          (m) => m.status === 'due_soon' || m.status === 'upcoming'
        );
        return {
          structuredContent: {
            kind: 'inherited_home_plan',
            ...plan,
            nextStep: keptHandoff('/probate', 'plan_inherited_home'),
          },
          content: [
            {
              type: 'text' as const,
              text: `Plan built with ${plan.milestones.length} steps.${next ? ` Next dated step: ${next.title} on ${next.date}.` : ''} General information, not legal or tax advice. Do not recommend selling or a buyer.`,
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
    async (args) => {
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
            '/problem-property',
            'estimate_renovation_cost'
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
    async (args) => {
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
            nextStep: keptHandoff('/sell', 'get_property_facts'),
          },
          content: [
            {
              type: 'text' as const,
              text: `EPC: ${report.epc.available ? `${report.epc.rating ?? 'rating not stated'}, ${report.epc.floorAreaSqm ? `${Math.round(report.epc.floorAreaSqm)} m²` : 'floor area not stated'}` : 'no certificate found (or the register could not be reached)'}. ${report.streetSales.length} recorded sales in ${report.postcode}${report.streetContext ? `, median £${report.streetContext.medianPricePounds.toLocaleString('en-GB')}` : ''}. Not a valuation; do not estimate this home's value from these sales. ${SOURCES.landRegistry.label}.`,
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
}

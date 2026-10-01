/**
 * Kept Pro plugin: tools for partner estate agents and syndicate investors,
 * behind OAuth (lib/oauth). Specified in docs/mcp/02-ranking.md (Track 2).
 *
 * Rules on top of the public plugin's:
 *  - **Scope = role.** Agent tools need the "agent" scope, investor tools
 *    the "investor" scope. Identity is re-read from the database on every
 *    call, so a founder's revoke takes effect at once.
 *  - **No figure to a seller's side before a person sends it.** Agents see
 *    status and dates, never the internal auto-quote (founder rule).
 *  - **No PropertyData to investors.** The feed shows Kept's own resale
 *    price, never the AVM market value or a discount computed from it.
 *  - **Writes are reviewed by a person.** A referral creates a quote request
 *    and an Action Centre card. Nothing is sent to a vendor.
 */

import type { McpServer, ServerContext } from '@modelcontextprotocol/server';
import { brand } from '@repo/brand';
import { database } from '@repo/database';
import { SIGNED_OFFER_NOTIFIER } from '@repo/deal-updates';
import { z } from 'zod';
import type { Scope } from './oauth/config';
import { type ProIdentity, findIdentity } from './oauth/identity';
import { withUsageLogging } from './usage';

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const DAY_MS = 86_400_000;

function text(t: string) {
  return { type: 'text' as const, text: t };
}

function errorResult(message: string) {
  return { isError: true, content: [text(message)] };
}

function securityMeta(scope: Scope) {
  return { securitySchemes: [{ type: 'oauth2', scopes: [scope] }] };
}

/**
 * Resolve the signed-in professional for this call, or explain what is
 * missing. withMcpAuth has already verified the token's signature, expiry
 * and audience.
 */
async function requireScope(
  ctx: ServerContext,
  scope: Scope
): Promise<
  { ok: true; identity: ProIdentity } | { ok: false; message: string }
> {
  const auth = ctx.http?.authInfo;
  const email = auth?.extra?.email;
  if (!auth || typeof email !== 'string') {
    return { ok: false, message: `Sign in to ${brand.name} to use this.` };
  }
  if (!auth.scopes.includes(scope)) {
    return {
      ok: false,
      message:
        scope === 'agent'
          ? `This is for ${brand.name} partner agents. Your sign-in does not include agent access.`
          : `This is for ${brand.name} investors. Your sign-in does not include investor access.`,
    };
  }
  const identity = await findIdentity(email);
  if (!identity?.scopes.includes(scope)) {
    return {
      ok: false,
      message:
        'Your access has been removed. Contact Kept if this is a mistake.',
    };
  }
  return { ok: true, identity };
}

const SITUATIONS = {
  buyer_pulled_out: 'Buyer pulled out',
  mortgage_refused: 'Mortgage refused',
  survey_down_valued: 'Survey down-valued',
  chain_break: 'Chain break',
  probate: 'Probate',
  problem_property: 'Problem property',
  other: 'Other',
} as const;
type Situation = keyof typeof SITUATIONS;

const STATUS_LABEL: Record<string, string> = {
  draft: 'With the team',
  processing: 'With the team',
  quoted: 'With the team',
  accepted: 'Offer accepted',
  declined: 'Declined',
  expired: 'Offer expired',
  converted_to_deal: 'Sale in progress',
};

function trackUrl(token: string | null | undefined): string | null {
  return token ? `${brand.url}/track/${token}` : null;
}

export function registerProPlugin(server: McpServer): void {
  withUsageLogging(server, 'pro');
  // ---------------------------------------------------------------------
  // Agent: refer a sale
  // ---------------------------------------------------------------------
  server.registerTool(
    'refer_sale_to_kept',
    {
      title: 'Refer a sale to Kept',
      description: `For ${brand.name} partner estate agents. Use when an agent wants ${brand.name} to look at a sale, usually one that has fallen through. Examples: "my buyer's mortgage fell through on 12 Oak Road, can Kept look at it?", "send this fall-through to Kept: 3 bed semi, M20, chain collapsed today", "refer a probate sale to Kept before I re-list". Creates a referral that a person at ${brand.name} reviews the same working day; ${brand.name} then arranges a viewing and sends a written offer within two working days of it. Only call after the agent confirms the vendor is happy for the details to be shared. Never include the vendor's name, phone or email.`,
      inputSchema: z.object({
        addressLine: z
          .string()
          .min(2)
          .max(200)
          .describe('First line of the property address.'),
        postcode: z.string().regex(UK_POSTCODE),
        situation: z
          .enum(Object.keys(SITUATIONS) as [Situation, ...Situation[]])
          .describe('What has happened to the sale.'),
        notes: z
          .string()
          .max(1000)
          .optional()
          .describe(
            'Anything useful: condition, timing, the onward chain. No vendor contact details.'
          ),
        vendorAgreed: z
          .literal(true)
          .describe(
            'The agent confirms the vendor agreed to the details being shared with Kept.'
          ),
      }),
      annotations: {
        title: 'Refer a sale to Kept',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      _meta: {
        ...securityMeta('agent'),
        'openai/toolInvocation/invoking': 'Sending the referral…',
        'openai/toolInvocation/invoked': 'Referral sent',
      },
    },
    async (args, ctx) => {
      const who = await requireScope(ctx, 'agent');
      if (!who.ok) return errorResult(who.message);
      const agent = who.identity.agent;
      if (!agent) return errorResult('No partner account found.');

      const postcode = args.postcode.toUpperCase().replace(/\s+/g, ' ').trim();
      const address = args.addressLine.trim();

      // A double-sent message should not create two referrals.
      const recent = await database.quoteRequest.findFirst({
        where: {
          referralCode: agent.referralCode,
          postcode,
          address: { equals: address, mode: 'insensitive' },
          createdAt: { gte: new Date(Date.now() - DAY_MS) },
        },
        select: { id: true },
      });
      if (recent) {
        return {
          structuredContent: { referralId: recent.id, duplicate: true },
          content: [
            text(
              `This property was already referred in the last 24 hours (reference ${recent.id}). ${brand.name} has it.`
            ),
          ],
        };
      }

      const quote = await database.quoteRequest.create({
        data: {
          source: 'plugin_agent',
          referralCode: agent.referralCode,
          contactName: agent.contactName,
          contactEmail: who.identity.email,
          contactPhone: agent.phone,
          role: 'agent',
          firmName: agent.firmName,
          address,
          postcode,
          sellerSituation: args.situation,
          notes: args.notes?.trim() || null,
          status: 'draft',
        },
        select: { id: true },
      });

      await Promise.all([
        database.founderAction.create({
          data: {
            type: 'general',
            priority: 'high',
            status: 'pending',
            agent: 'liaison',
            title: `Agent referral via ChatGPT: ${address}, ${postcode}`,
            description: `${agent.contactName} (${agent.firmName}) referred a sale: ${SITUATIONS[args.situation]}.${args.notes ? ` Notes: ${args.notes.trim()}` : ''} Vendor consent confirmed by the agent. Reply the same working day.`,
            metadata: {
              quoteRequestId: quote.id,
              source: 'plugin_agent',
              link: `/quotes/${quote.id}`,
            },
            dedupKey: `plugin-referral:${quote.id}`,
          },
        }),
        database.agentAccount.update({
          where: { id: agent.id },
          data: { totalReferrals: { increment: 1 } },
        }),
      ]);

      return {
        structuredContent: { referralId: quote.id, duplicate: false },
        content: [
          text(
            `Referral sent (reference ${quote.id}). A person at ${brand.name} will be in touch the same working day to arrange a viewing; the written offer follows within two working days of it. Check progress with my_kept_referrals.`
          ),
        ],
      };
    }
  );

  // ---------------------------------------------------------------------
  // Agent: referral status
  // ---------------------------------------------------------------------
  server.registerTool(
    'my_kept_referrals',
    {
      title: 'My Kept referrals',
      description: `For ${brand.name} partner estate agents. Use when an agent asks where their referrals to ${brand.name} are up to. Examples: "where are my Kept referrals up to?", "has Kept viewed 12 Oak Road yet?", "has the offer for my client been sent?", "how many deals have I referred to Kept this year?". Lists the agent's referrals with status, latest update and the live timeline link. Shows no offer figures.`,
      inputSchema: z.object({
        postcode: z
          .string()
          .regex(UK_POSTCODE)
          .optional()
          .describe('Filter to one property.'),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      annotations: {
        title: 'My Kept referrals',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: securityMeta('agent'),
    },
    async (args, ctx) => {
      const who = await requireScope(ctx, 'agent');
      if (!who.ok) return errorResult(who.message);
      const agent = who.identity.agent;
      if (!agent) return errorResult('No partner account found.');

      const rows = await database.quoteRequest.findMany({
        where: {
          OR: [
            { referralCode: agent.referralCode },
            {
              role: 'agent',
              contactEmail: { equals: who.identity.email, mode: 'insensitive' },
            },
          ],
          ...(args.postcode
            ? {
                postcode: {
                  equals: args.postcode
                    .toUpperCase()
                    .replace(/\s+/g, ' ')
                    .trim(),
                  mode: 'insensitive',
                },
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: args.limit ?? 20,
        select: {
          id: true,
          address: true,
          postcode: true,
          status: true,
          sellerSituation: true,
          createdAt: true,
          trackToken: { select: { token: true } },
          dealUpdates: {
            where: { visibility: 'public' },
            orderBy: { createdAt: 'desc' },
            select: {
              kind: true,
              title: true,
              createdAt: true,
              notifiedBy: true,
            },
          },
        },
      });

      const referrals = rows.map((r) => {
        const sent = r.dealUpdates.find(
          (u) =>
            u.kind === 'offer_sent' && u.notifiedBy === SIGNED_OFFER_NOTIFIER
        );
        const latest = r.dealUpdates[0];
        return {
          reference: r.id,
          property: `${r.address}, ${r.postcode}`,
          referredOn: r.createdAt.toISOString().slice(0, 10),
          situation: r.sellerSituation,
          status:
            sent && ['draft', 'processing', 'quoted'].includes(r.status)
              ? 'Written offer sent'
              : (STATUS_LABEL[r.status] ?? r.status),
          offerSentOn: sent ? sent.createdAt.toISOString().slice(0, 10) : null,
          latestUpdate: latest
            ? {
                title: latest.title,
                on: latest.createdAt.toISOString().slice(0, 10),
              }
            : null,
          timelineUrl: trackUrl(r.trackToken?.token),
        };
      });

      return {
        structuredContent: { referrals, total: referrals.length },
        content: [
          text(
            referrals.length === 0
              ? 'No referrals found for this account.'
              : referrals
                  .map(
                    (r) =>
                      `${r.property}: ${r.status}${r.latestUpdate ? ` (latest: ${r.latestUpdate.title}, ${r.latestUpdate.on})` : ''}`
                  )
                  .join('\n')
          ),
        ],
      };
    }
  );

  // ---------------------------------------------------------------------
  // Investor: released deals
  // ---------------------------------------------------------------------
  server.registerTool(
    'kept_released_deals',
    {
      title: 'Kept released deals',
      description: `For ${brand.name} syndicate investors. Use when an investor asks what deals ${brand.name} has released to the investor feed. Examples: "any new Kept deals in Manchester under £200k?", "show me released deals with 3 beds", "what's come onto the Kept feed this week?". Lists released deals with postcode, type, bedrooms and ${brand.name}'s resale price. No seller details.`,
      inputSchema: z.object({
        postcodePrefix: z
          .string()
          .max(8)
          .optional()
          .describe('Start of the postcode, e.g. "M" or "M20".'),
        maxPricePounds: z.number().positive().max(50_000_000).optional(),
        minBedrooms: z.number().int().min(0).max(20).optional(),
        releasedInLastDays: z.number().int().min(1).max(365).optional(),
      }),
      annotations: {
        title: 'Kept released deals',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: securityMeta('investor'),
    },
    async (args, ctx) => {
      const who = await requireScope(ctx, 'investor');
      if (!who.ok) return errorResult(who.message);

      const deals = await database.deal.findMany({
        where: {
          releasedForResale: true,
          ...(args.postcodePrefix
            ? {
                postcode: {
                  startsWith: args.postcodePrefix.toUpperCase().trim(),
                  mode: 'insensitive',
                },
              }
            : {}),
          ...(args.maxPricePounds
            ? {
                resalePricePence: {
                  lte: Math.round(args.maxPricePounds * 100),
                },
              }
            : {}),
          ...(args.minBedrooms !== undefined
            ? { bedrooms: { gte: args.minBedrooms } }
            : {}),
          ...(args.releasedInLastDays
            ? {
                releasedAt: {
                  gte: new Date(Date.now() - args.releasedInLastDays * DAY_MS),
                },
              }
            : {}),
        },
        orderBy: { releasedAt: 'desc' },
        take: 50,
        // Seller PII and Kept's own economics are never selected (same rule
        // as apps/web/app/investors/[token]). No AVM value: PropertyData.
        select: {
          id: true,
          postcode: true,
          propertyType: true,
          bedrooms: true,
          sellerType: true,
          resalePricePence: true,
          releasedAt: true,
        },
      });

      const rows = deals.map((d) => ({
        dealId: d.id,
        postcode: d.postcode,
        propertyType: d.propertyType,
        bedrooms: d.bedrooms,
        situation: d.sellerType,
        resalePricePounds:
          d.resalePricePence === null
            ? null
            : Math.round(d.resalePricePence / 100),
        releasedOn: d.releasedAt
          ? d.releasedAt.toISOString().slice(0, 10)
          : null,
      }));

      return {
        structuredContent: { deals: rows, total: rows.length },
        content: [
          text(
            rows.length === 0
              ? 'No released deals match.'
              : rows
                  .map(
                    (d) =>
                      `${d.postcode} · ${d.propertyType ?? 'property'}${d.bedrooms ? ` · ${d.bedrooms} bed` : ''} · ${d.resalePricePounds === null ? 'price on request' : `£${d.resalePricePounds.toLocaleString('en-GB')}`} (deal ${d.dealId})`
                  )
                  .join('\n')
          ),
        ],
      };
    }
  );

  // ---------------------------------------------------------------------
  // Investor: register interest
  // ---------------------------------------------------------------------
  server.registerTool(
    'register_interest_in_deal',
    {
      title: 'Register interest in a Kept deal',
      description: `For ${brand.name} syndicate investors. Use when an investor wants to register interest in a released deal. Examples: "register my interest in the Salford terrace", "I'm interested in deal <id>, keep me posted". Records the interest and subscribes the investor to that deal's updates by email. A person at ${brand.name} follows up. Use a dealId from kept_released_deals.`,
      inputSchema: z.object({
        dealId: z.string().min(5).max(40),
        note: z
          .string()
          .max(1000)
          .optional()
          .describe('Anything the team should know.'),
      }),
      annotations: {
        title: 'Register interest in a Kept deal',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: {
        ...securityMeta('investor'),
        'openai/toolInvocation/invoking': 'Registering interest…',
        'openai/toolInvocation/invoked': 'Interest registered',
      },
    },
    async (args, ctx) => {
      const who = await requireScope(ctx, 'investor');
      if (!who.ok) return errorResult(who.message);
      const investor = who.identity.investor;
      if (!investor) return errorResult('No investor access found.');

      const deal = await database.deal.findUnique({
        where: { id: args.dealId },
        select: { id: true, releasedForResale: true, postcode: true },
      });
      if (!deal?.releasedForResale) {
        return errorResult(
          'That deal is not on the investor feed. Check the id with kept_released_deals.'
        );
      }

      const email = who.identity.email;
      const existing = await database.investorInterest.findUnique({
        where: {
          dealId_investorEmail: { dealId: deal.id, investorEmail: email },
        },
        select: { id: true },
      });
      await database.investorInterest.upsert({
        where: {
          dealId_investorEmail: { dealId: deal.id, investorEmail: email },
        },
        create: {
          dealId: deal.id,
          investorName: investor.label,
          investorEmail: email,
          note: args.note?.trim().slice(0, 1000) || null,
          notify: true,
        },
        update: {
          note: args.note?.trim().slice(0, 1000) || undefined,
          notify: true,
        },
      });
      if (!existing) {
        await database.founderAction.create({
          data: {
            type: 'general',
            priority: 'medium',
            status: 'pending',
            agent: 'orchestrator',
            dealId: deal.id,
            title: `Investor interest via ChatGPT: ${deal.postcode}`,
            description: `${investor.label} (${email}) registered interest.${args.note ? ` Note: ${args.note.trim()}` : ''}`,
            metadata: { source: 'plugin_investor', link: `/deals/${deal.id}` },
            dedupKey: `plugin-interest:${deal.id}:${email}`,
          },
        });
      }

      return {
        structuredContent: {
          dealId: deal.id,
          alreadyRegistered: Boolean(existing),
        },
        content: [
          text(
            existing
              ? `Your interest in ${deal.postcode} was already registered; your note is updated.`
              : `Interest registered for ${deal.postcode}. You will get this deal's updates by email, and a person at ${brand.name} will follow up.`
          ),
        ],
      };
    }
  );
}

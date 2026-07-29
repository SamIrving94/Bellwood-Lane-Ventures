import { database } from '@repo/database';
import { sendHoldingReply } from '@repo/email/holding-reply';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { unauthorizedResponse, validateAgentAuth } from '../_lib/auth';

/**
 * Paid-ads lead intake.
 *
 * Receives leads from ad platforms (Meta Lead Ads, Messenger, Google form
 * extensions) and lands them directly in the pipeline the founder already
 * works from — a `QuoteRequest` plus a `FounderAction` — rather than in a
 * separate ads CRM that would need a manual handoff. That handoff is
 * exactly where response time gets lost, and response time is the single
 * biggest lever on whether a paid lead ever converts.
 *
 * Deliberately does NOT run the offer engine. An ad lead form gives us a
 * name, a phone number and a postcode — nowhere near enough to stand
 * behind a figure. The lead is captured, acknowledged, and queued for a
 * human call. Pricing happens after the founder has spoken to them.
 *
 * Mirrors the structure of /agents/intake/whatsapp.
 */

const PLATFORMS = ['meta', 'google', 'bing', 'nextdoor'] as const;

const SITUATIONS = [
  'probate',
  'chain_break',
  'repossession',
  'relocation',
  'short_lease',
  'problem_property',
  'other',
] as const;

const bodySchema = z
  .object({
    platform: z.enum(PLATFORMS),
    /** The platform's own lead id. Used to dedupe webhook replays. */
    externalId: z.string().min(1),
    /** Which on-platform surface produced this. Maps to QuoteRequest.source. */
    surface: z
      .enum(['meta_lead_ad', 'messenger', 'google_search'])
      .default('meta_lead_ad'),

    campaignRef: z.string().optional(),
    adSetRef: z.string().optional(),
    creativeRef: z.string().optional(),

    utmSource: z.string().optional(),
    utmMedium: z.string().optional(),
    utmCampaign: z.string().optional(),
    utmContent: z.string().optional(),
    utmTerm: z.string().optional(),
    landingPath: z.string().optional(),

    contactName: z.string().min(1),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().min(6).optional(),

    postcode: z.string().min(3),
    address: z.string().optional(),
    situation: z.enum(SITUATIONS).optional(),
    notes: z.string().max(2000).optional(),

    /** Whole untouched platform payload, kept for debugging attribution. */
    rawPayload: z.unknown().optional(),
  })
  // A lead we can reach by neither email nor phone is not a lead. Reject it
  // at the door rather than filling the pipeline with dead rows.
  .refine((v) => Boolean(v.contactEmail || v.contactPhone), {
    message: 'At least one of contactEmail or contactPhone is required',
    path: ['contactEmail'],
  });

/** Hours we promise a call back within. Mirrored in the holding reply. */
const CALLBACK_HOURS = 24;

type AdsLead = z.infer<typeof bodySchema>;

/** Attribution columns, split out so the create call stays readable. */
function attributionOf(body: AdsLead) {
  return {
    adPlatform: body.platform,
    adExternalId: body.externalId,
    adCampaignRef: body.campaignRef,
    adSetRef: body.adSetRef,
    adCreativeRef: body.creativeRef,
    utmSource: body.utmSource,
    utmMedium: body.utmMedium,
    utmCampaign: body.utmCampaign,
    utmContent: body.utmContent,
    utmTerm: body.utmTerm,
    landingPath: body.landingPath,
  };
}

/** The briefing the founder reads in the Action Centre before calling. */
function describeLead(body: AdsLead, holdingReplySent: boolean): string {
  const reachable = body.contactEmail
    ? `${body.contactEmail}${body.contactPhone ? ` · ${body.contactPhone}` : ''}`
    : `${body.contactPhone} (phone only — no acknowledgement sent)`;

  return [
    `Inbound from ${body.platform} (${body.surface}).`,
    body.situation ? `Situation: ${body.situation}.` : null,
    `Contact: ${reachable}.`,
    holdingReplySent
      ? `Holding reply sent — they have been told someone will call within ${CALLBACK_HOURS} hours.`
      : 'NO acknowledgement has reached this person yet. Call them first.',
    body.notes ? `\nTheir notes: ${body.notes}` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Acknowledge immediately. Fixed template, no figure, no LLM — see
 * @repo/email/holding-reply for why that constraint is load-bearing.
 * Returns false for phone-only leads, which nothing can auto-acknowledge
 * until an SMS provider exists.
 */
async function acknowledge(body: AdsLead): Promise<boolean> {
  if (!body.contactEmail) return false;
  const result = await sendHoldingReply({
    contactName: body.contactName,
    contactEmail: body.contactEmail,
    propertyRef: body.postcode,
    callbackHours: CALLBACK_HOURS,
  });
  return result?.skipped === false;
}

export const POST = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        details: err instanceof z.ZodError ? err.errors : String(err),
      },
      { status: 400 }
    );
  }

  // 1. Dedupe. Meta retries webhook deliveries it thinks failed, and a
  //    duplicate here would mean the vendor gets a second "we've got your
  //    enquiry" email and the founder gets a second action to work.
  const existing = await database.quoteRequest.findFirst({
    where: { adPlatform: body.platform, adExternalId: body.externalId },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({
      quoteRequestId: existing.id,
      deduped: true,
      founderActionId: null,
      holdingReplySent: false,
    });
  }

  // 2. Capture the lead.
  //    - `address` is required by the schema but ad lead forms routinely
  //      only collect a postcode, so fall back to it. The founder gets the
  //      full address on the call.
  //    - `contactEmail` is likewise required; a phone-only lead stores an
  //      empty string rather than a synthetic address that would later be
  //      mailed by something else.
  const quoteRequest = await database.quoteRequest.create({
    data: {
      source: body.surface,
      contactName: body.contactName,
      contactEmail: body.contactEmail ?? '',
      contactPhone: body.contactPhone,
      role: 'seller',
      address: body.address?.trim() || body.postcode,
      postcode: body.postcode,
      sellerSituation: body.situation,
      notes: body.notes,
      status: 'draft',
      ...attributionOf(body),
    },
  });

  // 3. Acknowledge immediately.
  const holdingReplySent = await acknowledge(body);

  // 4. Queue the call. A lead we could not auto-acknowledge is escalated:
  //    nothing has reached the seller at all, so the clock is already running.
  const founderAction = await database.founderAction.create({
    data: {
      type: 'review_leads',
      priority: holdingReplySent ? 'high' : 'critical',
      status: 'pending',
      agent: 'liaison',
      title: `Call paid-ads lead: ${body.contactName}, ${body.postcode}`,
      description: describeLead(body, holdingReplySent),
      expiresAt: new Date(Date.now() + CALLBACK_HOURS * 60 * 60 * 1000),
      // Replay-safe: a retried webhook that slips past the dedup check above
      // still cannot create a second action for the same lead.
      dedupKey: `${quoteRequest.id}:ads_lead:${body.platform}`,
      metadata: {
        quoteRequestId: quoteRequest.id,
        platform: body.platform,
        surface: body.surface,
        campaignRef: body.campaignRef,
        adSetRef: body.adSetRef,
        creativeRef: body.creativeRef,
        utmCampaign: body.utmCampaign,
        utmContent: body.utmContent,
        holdingReplySent,
        link: `/quotes/${quoteRequest.id}`,
      },
    },
  });

  // 5. Event log — also the audit trail for attribution disputes later.
  await database.agentEvent.create({
    data: {
      agent: 'liaison',
      eventType: 'ads_lead_received',
      summary: `Paid-ads lead from ${body.platform}/${body.surface}: ${body.contactName}, ${body.postcode}`,
      payload: {
        quoteRequestId: quoteRequest.id,
        founderActionId: founderAction.id,
        platform: body.platform,
        surface: body.surface,
        externalId: body.externalId,
        campaignRef: body.campaignRef,
        adSetRef: body.adSetRef,
        creativeRef: body.creativeRef,
        utmCampaign: body.utmCampaign,
        utmContent: body.utmContent,
        holdingReplySent,
        rawPayload: body.rawPayload ?? null,
      },
    },
  });

  return NextResponse.json({
    quoteRequestId: quoteRequest.id,
    founderActionId: founderAction.id,
    holdingReplySent,
    deduped: false,
  });
};

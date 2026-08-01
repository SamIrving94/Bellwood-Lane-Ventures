import { generateReferralCode } from '@/app/partners/_lib/auth';
import {
  LIMITS,
  checkRateLimit,
  clientIp,
  retryAfterSeconds,
} from '@/lib/rate-limit';
import { CLAUDE_HAIKU, callClaudeForJson } from '@repo/ai/claude';
import { brand } from '@repo/brand';
import { database } from '@repo/database';
import { recordDealUpdate } from '@repo/deal-updates';
import { sendEmail } from '@repo/email';
import {
  type InstantOfferSituation,
  applyPreflightAdjustment,
  generateInstantOffer,
} from '@repo/instant-offer';
import { runPreflightChecks } from '@repo/property-data/src/propertydata';
import type { PropertyType } from '@repo/valuation';
import { DEFAULT_OFFER_CONFIG } from '@repo/valuation/src/offer-config';
import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Offer floor as a fraction of AVM. Read from the offer config the AVM itself
 * uses — never re-typed as a literal here, so founder-facing copy can never
 * quote a threshold the calculator has moved off.
 */
const OFFER_FLOOR_FRACTION = DEFAULT_OFFER_CONFIG.floorFraction;

const InputSchema = z.object({
  address: z.string().min(3),
  postcode: z.string().min(3),
  propertyType: z.enum([
    'terraced_house',
    'semi_detached',
    'detached',
    'flat',
    'other',
  ]),
  bedrooms: z.number().int().min(1).max(10).optional(),
  role: z.enum(['agent', 'seller', 'solicitor', 'other']),
  firmName: z.string().optional(),
  situation: z.enum([
    'probate',
    'chain_break',
    'repossession',
    'relocation',
    'short_lease',
    'problem_property',
    'other',
  ]),
  condition: z.number().int().min(1).max(10).optional(),
  urgencyDays: z.number().int().positive().optional(),
  askingPricePence: z.number().int().positive().optional(),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  referralCode: z.string().optional(),
  /** UI label of the trigger chip the agent picked. Persisted to notes. */
  triggerLabel: z.string().optional(),
  /** Origin of the submission, e.g. "agent_quick_form" from /save-the-sale. */
  submissionSource: z.string().optional(),
  /** Free-text "anything else?" — drives the LLM triage signal in the inbox. */
  notes: z.string().max(2000).optional(),
});

// ────────────────────────────────────────────────────────────────────────────
// LLM triage — runs on every /save-the-sale submission. Returns a short
// summary + urgency signal + watch-outs so Sam can triage in the inbox
// without opening the full record. NEVER load-bearing — null fallback.
// ────────────────────────────────────────────────────────────────────────────

const TriageSchema = z.object({
  summary: z.string().max(400),
  urgencySignal: z.enum(['high', 'medium', 'low']),
  watchOuts: z.array(z.string().max(200)).max(3).default([]),
  recommendedNextStep: z.string().max(300),
});

type TriageResult = z.infer<typeof TriageSchema>;

const TRIAGE_SYSTEM_PROMPT = `You are the head of operations at Kept, a UK property-buying company. An estate agent has just submitted a fall-through deal via /save-the-sale. Your job: produce a 30-second briefing for the founder's inbox.

Output strict JSON only, no prose, no markdown fences. Schema:

{
  "summary": string,            // 1 sentence, plain English, ≤ 25 words. The founder reads this in the queue.
  "urgencySignal": "high" | "medium" | "low",  // independent of the urgencyDays field — based on situation + notes signal
  "watchOuts": string[],        // 0-3 short risk flags, e.g. "short lease", "asking price unrealistic", "no condition rating given"
  "recommendedNextStep": string // 1 sentence, ≤ 20 words, concrete action e.g. "Call the agent — chain has been broken twice"
}

Rules:
- Use ONLY information present in the submission. Do NOT invent.
- "urgencySignal" is high when: imminent completion deadline mentioned, repossession active, vendor in genuine distress, or contradicting info that needs a call.
- "watchOuts" — call out anything that suggests this isn't a clean deal: missing data, asking price out of step with situation, lease-related notes, distressed wording the agent didn't tag.
- "recommendedNextStep" — what should the founder do FIRST? View, call agent, request more info, escalate, decline.
- No marketing fluff. No "AI" or "algorithm" language.`;

async function triageSubmission(input: {
  address: string;
  postcode: string;
  propertyType: string;
  bedrooms?: number;
  condition?: number;
  situation: string;
  urgencyDays?: number;
  askingPricePence?: number;
  role: string;
  firmName?: string;
  triggerLabel?: string;
  notes?: string;
}): Promise<TriageResult | null> {
  const lines: string[] = [
    `Address: ${input.address}, ${input.postcode}`,
    `Property: ${input.propertyType}${input.bedrooms ? `, ${input.bedrooms} bed` : ''}${typeof input.condition === 'number' ? `, condition ${input.condition}/10` : ''}`,
    `Situation: ${input.situation}`,
    `Submitter role: ${input.role}${input.firmName ? ` at ${input.firmName}` : ''}`,
  ];
  if (input.triggerLabel)
    lines.push(`Trigger chip clicked: ${input.triggerLabel}`);
  if (typeof input.urgencyDays === 'number')
    lines.push(`Requested completion in: ${input.urgencyDays} days`);
  if (typeof input.askingPricePence === 'number')
    lines.push(
      `Asking price: £${Math.round(input.askingPricePence / 100).toLocaleString('en-GB')}`
    );
  if (input.notes)
    lines.push(`Free-text notes from submitter:\n"""\n${input.notes}\n"""`);

  const raw = await callClaudeForJson<unknown>({
    system: TRIAGE_SYSTEM_PROMPT,
    user: lines.join('\n'),
    maxTokens: 400,
    temperature: 0.3,
    model: CLAUDE_HAIKU,
    feature: 'save_the_sale_triage',
  });

  // The submitter's free-text notes reach this prompt, so the reply is
  // untrusted input: shape-check and length-cap it before it can reach the
  // founder's queue or influence action priority.
  const validated = TriageSchema.safeParse(raw);
  if (!validated.success) {
    console.warn('[quote] triage output failed validation, ignoring');
    return null;
  }
  return validated.data;
}

function mapPropertyType(
  pt: z.infer<typeof InputSchema>['propertyType']
): PropertyType {
  switch (pt) {
    case 'terraced_house':
      return 'terraced';
    case 'semi_detached':
      return 'semi-detached';
    case 'detached':
      return 'detached';
    case 'flat':
      return 'flat';
    case 'other':
    default:
      return 'terraced'; // fallback
  }
}

export async function POST(request: Request) {
  const ip = clientIp(request) ?? 'anonymous';

  const ipLimit = await checkRateLimit(LIMITS.quoteByIp, `ip:${ip}`);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': retryAfterSeconds(ipLimit.resetAt) },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;

  // Second cap on the submitted address: an attacker rotating IPs still cannot
  // mail-bomb one recipient, and one honest seller cannot loop the engine.
  const emailLimit = await checkRateLimit(
    LIMITS.quoteByEmail,
    `email:${input.contactEmail.toLowerCase()}`
  );
  if (!emailLimit.ok) {
    return NextResponse.json(
      {
        error:
          'Too many requests for this email address. Please try again later.',
      },
      {
        status: 429,
        headers: { 'Retry-After': retryAfterSeconds(emailLimit.resetAt) },
      }
    );
  }

  // Create QuoteRequest with processing status
  let quoteRequest;
  let autoCreatedAgent: {
    referralCode: string;
    contactName: string;
    firmName: string;
  } | null = null;
  try {
    // Compose a notes string preserving the trigger chip + submission source.
    // Sam reads this in the dashboard intake view to triage faster.
    const notesLines: string[] = [];
    if (input.triggerLabel) notesLines.push(`Trigger: ${input.triggerLabel}`);
    if (input.submissionSource)
      notesLines.push(`Source: ${input.submissionSource}`);
    const notes = notesLines.length ? notesLines.join('\n') : undefined;

    // Source taxonomy for the dashboard:
    //   agent_quick_form  - new panic-mode form on /save-the-sale
    //   agent_portal      - logged-in agent via referral code
    //   public_web        - seller intake or unattributed
    const source =
      input.submissionSource === 'agent_quick_form'
        ? 'agent_quick_form'
        : input.referralCode
          ? 'agent_portal'
          : 'public_web';

    quoteRequest = await database.quoteRequest.create({
      data: {
        source,
        referralCode: input.referralCode
          ? input.referralCode.toUpperCase()
          : undefined,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        role: input.role,
        firmName: input.firmName,
        address: input.address,
        postcode: input.postcode,
        propertyType: input.propertyType,
        bedrooms: input.bedrooms,
        condition: input.condition,
        askingPricePence: input.askingPricePence,
        sellerSituation: input.situation,
        urgencyDays: input.urgencyDays,
        notes,
        status: 'processing',
      },
    });

    // Increment agent's totalReferrals counter (best-effort)
    if (input.referralCode) {
      try {
        await database.agentAccount.update({
          where: { referralCode: input.referralCode.toUpperCase() },
          data: { totalReferrals: { increment: 1 } },
        });
      } catch {
        // Referral code may not match an agent — non-fatal
      }
    }

    // Silent auto-account creation for agents (progressive disclosure):
    // if the submitter picked role=agent with firm + email and isn't already
    // linked to a referral code, lazy-create an AgentAccount so we have
    // something to credit future referrals against.
    if (
      input.role === 'agent' &&
      input.firmName &&
      input.contactEmail &&
      !input.referralCode
    ) {
      try {
        const existing = await database.agentAccount.findUnique({
          where: { email: input.contactEmail },
        });
        if (existing) {
          autoCreatedAgent = existing;
          // Attribute this quote to their existing code
          await database.quoteRequest.update({
            where: { id: quoteRequest.id },
            data: { referralCode: existing.referralCode },
          });
          await database.agentAccount.update({
            where: { id: existing.id },
            data: { totalReferrals: { increment: 1 } },
          });
        } else {
          // Find a unique referralCode
          let code = generateReferralCode(input.firmName);
          for (let i = 0; i < 5; i++) {
            const clash = await database.agentAccount.findUnique({
              where: { referralCode: code },
            });
            if (!clash) break;
            code = generateReferralCode(input.firmName);
          }
          autoCreatedAgent = await database.agentAccount.create({
            data: {
              email: input.contactEmail,
              contactName: input.contactName,
              firmName: input.firmName,
              phone: input.contactPhone,
              referralCode: code,
              totalReferrals: 1,
            },
          });
          await database.quoteRequest.update({
            where: { id: quoteRequest.id },
            data: { referralCode: code },
          });
        }
      } catch (err) {
        console.warn('[quote] auto-create agent account failed', err);
      }
    }
  } catch (err) {
    console.error('[quote] DB create failed', err);
    return NextResponse.json(
      { error: 'Could not save your request. Please try again.' },
      { status: 500 }
    );
  }

  // Generate offer + run PropertyData preflight (EPC + tenure + market
  // temperature) in parallel. Preflight findings are merged into the offer
  // reasoning, and a small ±% adjustment is applied to the headline offer.
  try {
    const [offerBase, preflight] = await Promise.all([
      generateInstantOffer({
        postcode: input.postcode,
        address: input.address,
        propertyType: mapPropertyType(input.propertyType),
        bedrooms: input.bedrooms,
        condition: input.condition,
        situation: input.situation as InstantOfferSituation,
        urgencyDays: input.urgencyDays,
        askingPricePence: input.askingPricePence,
      }),
      runPreflightChecks({
        postcode: input.postcode,
        address: input.address,
      }).catch((err) => {
        console.warn('[quote] preflight failed (non-fatal)', err);
        return null;
      }),
    ]);

    // Apply the preflight adjustment to the offer. `applyPreflightAdjustment`
    // owns the ±5% clamp AND re-tests the 60%-of-AVM floor against the final
    // figure — the adjustment lands after generateInstantOffer computed
    // requiresReview, so without that re-test a negative adjustment could take
    // an offer under the floor with no escalation card raised.
    const adjusted = applyPreflightAdjustment(
      offerBase,
      preflight?.offerAdjustment ?? 0
    );

    const offer = {
      ...adjusted,
      reasoning: [
        ...adjusted.reasoning,
        ...(preflight?.reasoning ?? []),
        ...(preflight?.tenure.isShortLease
          ? [
              `⚠ SHORT LEASE: ${preflight.tenure.remainingLeaseYears ?? '?'} years remaining — Appraiser must confirm before binding offer.`,
            ]
          : []),
      ],
      // Force review if preflight surfaced a short-lease leasehold — we
      // don't auto-commit to those without founder eyeballs.
      requiresReview:
        adjusted.requiresReview || !!preflight?.tenure.isShortLease,
    };

    // Persist offer
    const offerRow = await database.quoteOffer.create({
      data: {
        estimatedMarketValueMinPence: offer.estimatedMarketValueMinPence,
        estimatedMarketValueMaxPence: offer.estimatedMarketValueMaxPence,
        offerPence: offer.offerPence,
        offerPercentOfAvm: offer.offerPercentOfAvm,
        confidenceScore: offer.confidenceScore,
        completionDays: offer.completionDays,
        reasoning: offer.reasoning,
        lockedUntil: offer.lockedUntil,
      },
    });

    await database.quoteRequest.update({
      where: { id: quoteRequest.id },
      data: {
        status: 'quoted',
        offerId: offerRow.id,
      },
    });

    // If the offer requires founder review, surface it in the Action Centre.
    // Best-effort — never block the response.
    if (offer.requiresReview) {
      try {
        await database.founderAction.create({
          data: {
            type: 'ceo_escalation',
            priority: 'high',
            status: 'pending',
            agent: 'appraiser',
            title: `Review offer: ${input.address}, ${input.postcode}`,
            // The old copy asserted "Below the 60% floor" on EVERY review,
            // including the short-lease and thin-evidence ones that are
            // nowhere near the floor. State the actual position instead.
            description: `Auto-generated offer of £${Math.round(offer.offerPence / 100).toLocaleString('en-GB')} (${Math.round(offer.offerPercentOfAvm * 100)}% of AVM)${offer.belowAvmFloor ? ` — BELOW the ${Math.round(OFFER_FLOOR_FRACTION * 100)}% floor` : ''}. Needs your sign-off before the seller is committed to. Reasons are in the offer reasoning trail.`,
            metadata: {
              quoteRequestId: quoteRequest.id,
              offerPence: offer.offerPence,
              offerPercentOfAvm: offer.offerPercentOfAvm,
              belowAvmFloor: offer.belowAvmFloor,
              avmMid: Math.round(
                (offer.estimatedMarketValueMinPence +
                  offer.estimatedMarketValueMaxPence) /
                  2
              ),
              link: `/quotes/${quoteRequest.id}`,
            },
          },
        });
      } catch (err) {
        console.warn('[quote] founder-action create failed (non-fatal)', err);
      }
    }

    // For every agent quick-form submission, raise a Founder Action so the
    // submission lands in Sam's queue regardless of whether the offer
    // requires review. The 4-working-hour signed-PDF SLA is enforced
    // operationally - this is the trigger for that workflow.
    if (input.submissionSource === 'agent_quick_form') {
      // Run the LLM triage. Null-tolerant — null falls through to the existing
      // deterministic description.
      const triage = await triageSubmission({
        address: input.address,
        postcode: input.postcode,
        propertyType: input.propertyType,
        bedrooms: input.bedrooms,
        condition: input.condition,
        situation: input.situation,
        urgencyDays: input.urgencyDays,
        askingPricePence: input.askingPricePence,
        role: input.role,
        firmName: input.firmName,
        triggerLabel: input.triggerLabel,
        notes: input.notes,
      }).catch((err) => {
        console.warn('[quote] LLM triage failed (non-fatal)', err);
        return null;
      });

      try {
        const offerGbp = Math.round(offer.offerPence / 100).toLocaleString(
          'en-GB'
        );
        const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Shared metadata for the trio of actions this creates
        const commonMeta = {
          quoteRequestId: quoteRequest.id,
          offerPence: offer.offerPence,
          offerPercentOfAvm: offer.offerPercentOfAvm,
          triggerLabel: input.triggerLabel,
          firmName: input.firmName,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          slaHours: 24,
          link: `/quotes/${quoteRequest.id}`,
          triage: triage ?? undefined,
        } as const;

        // Build the SLA description, prepending the LLM triage when present.
        const baseDescription = `${input.firmName ?? 'Agent'} submitted via /save-the-sale. Trigger: ${input.triggerLabel ?? 'unspecified'}. Indicative offer £${offerGbp} (${Math.round(offer.offerPercentOfAvm * 100)}% of AVM). Signed PDF promised within 24h.`;
        const slaDescription = triage
          ? [
              `**${triage.summary}** — urgency: ${triage.urgencySignal}.`,
              triage.watchOuts.length > 0
                ? `Watch-outs: ${triage.watchOuts.join('; ')}.`
                : null,
              `Next step: ${triage.recommendedNextStep}`,
              '',
              baseDescription,
            ]
              .filter(Boolean)
              .join('\n')
          : baseDescription;

        // 1) Board-facing SLA tracking action
        await database.founderAction.create({
          data: {
            type: 'ceo_escalation',
            // Promote to "critical" when the triage flags high urgency.
            priority: triage?.urgencySignal === 'high' ? 'critical' : 'high',
            status: 'pending',
            agent: 'system',
            title: `Sign + send offer: ${input.address}, ${input.postcode}`,
            description: slaDescription,
            expiresAt: slaDeadline,
            metadata: { ...commonMeta, assignedToAgent: 'board' },
          },
        });

        // 2) Appraiser draft action (Paperclip picks up on next heartbeat)
        await database.founderAction.create({
          data: {
            type: 'approve_offer',
            priority: 'high',
            status: 'pending',
            agent: 'appraiser',
            title: `Draft signed offer PDF: ${input.address}`,
            description: `Enrich + draft a signed binding offer for ${input.address}, ${input.postcode}. Indicative figure: £${offerGbp}. Use docs/templates/binding-offer-letter.md. The quote-ops cron picks this up automatically (enrichment, dedup, signed PDF); review the draft it produces before anything is sent.`,
            expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
            metadata: {
              ...commonMeta,
              assignedToAgent: 'appraiser',
              workflow: 'draft_signed_pdf',
            },
          },
        });

        // (The Liaison send action gets created later — when Appraiser
        // PATCHes the signedOfferUrl. See apps/api/.../quote-ops/[id]/route.ts.)
      } catch (err) {
        console.warn('[quote] founder-action (agent SLA) create failed', err);
      }

      // Confirmation email to the agent. The signed PDF will arrive
      // separately within 24 hours - this is just acknowledgement.
      try {
        const offerGbp = Math.round(offer.offerPence / 100).toLocaleString(
          'en-GB'
        );
        const followUpLine = input.contactPhone
          ? "We'll also drop you a WhatsApp on the number you gave us when the signed offer is ready."
          : 'If you share a work mobile on reply, we can WhatsApp you the moment the signed offer is ready.';
        await sendEmail({
          to: input.contactEmail,
          subject: `Your indicative offer for ${input.address}`,
          text: [
            `Hi ${input.contactName.split(' ')[0]},`,
            '',
            `Thanks for sending us ${input.address}, ${input.postcode}.`,
            '',
            `Indicative cash offer: £${offerGbp}.`,
            '',
            'This is our honest starting point, based on comparable sales and public records. We need to view the property before we can confirm. We aim to send the confirmed price in writing within 24 to 48 hours of the viewing, and that is the price we complete at.',
            '',
            'The price can only change for three reasons, all documented in writing:',
            '  1. A structural survey reveals a material defect not visible or disclosed at viewing.',
            '  2. A title issue emerges during conveyancing that materially affects value.',
            '  3. Information provided about the property turns out to be materially incorrect.',
            '',
            'We will be in touch to arrange the viewing.',
            followUpLine,
            '',
            brand.name,
            'Member of the Property Redress Scheme (PRS) · HMRC AML supervised · ICO registered',
            brand.email,
          ].join('\n'),
        });
      } catch (err) {
        console.warn('[quote] agent confirmation email failed', err);
      }
    }

    // Record the offer event + dispatch transparent emails to all parties.
    // Best-effort — never block the response.
    let trackUrl: string | null = null;
    try {
      const recorded = await recordDealUpdate({
        quoteRequestId: quoteRequest.id,
        kind: 'offer_sent',
        title: offer.requiresReview
          ? 'Indicative offer ready — awaiting founder review'
          : 'Cash offer issued',
        detail: offer.requiresReview
          ? 'A senior member of our team is reviewing the inputs and will confirm a written offer shortly.'
          : `We can complete in ${offer.completionDays} days. The offer is locked, in writing, until ${offer.lockedUntil.toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}.`,
        metadata: {
          offerPence: offer.offerPence,
          offerPercentOfAvm: offer.offerPercentOfAvm,
          confidenceScore: offer.confidenceScore,
          completionDays: offer.completionDays,
        },
      });
      trackUrl = recorded.trackUrl;
    } catch (err) {
      console.warn('[quote] deal-update record failed (non-fatal)', err);
    }

    return NextResponse.json({
      quoteId: quoteRequest.id,
      estimatedMarketValueMinPence: offer.estimatedMarketValueMinPence,
      estimatedMarketValueMaxPence: offer.estimatedMarketValueMaxPence,
      offerPence: offer.offerPence,
      offerPercentOfAvm: offer.offerPercentOfAvm,
      confidenceScore: offer.confidenceScore,
      completionDays: offer.completionDays,
      reasoning: offer.reasoning,
      narrative: offerBase.narrative,
      lockedUntil: offer.lockedUntil.toISOString(),
      requiresReview: offer.requiresReview,
      trackUrl,
      agentAccount: autoCreatedAgent
        ? {
            referralCode: autoCreatedAgent.referralCode,
            contactName: autoCreatedAgent.contactName,
            firmName: autoCreatedAgent.firmName,
          }
        : null,
    });
  } catch (err) {
    console.error('[quote] offer engine failed', err);
    // Mark as draft so we can follow up manually
    await database.quoteRequest.update({
      where: { id: quoteRequest.id },
      data: { status: 'draft' },
    });
    return NextResponse.json(
      {
        error:
          'Offer engine is temporarily unavailable. A member of our team will email you shortly.',
      },
      { status: 500 }
    );
  }
}

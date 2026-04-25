import { NextResponse } from 'next/server';
import { z } from 'zod';
import { database } from '@repo/database';
import {
  generateInstantOffer,
  type InstantOfferSituation,
} from '@repo/instant-offer';
import type { PropertyType } from '@repo/valuation';
import { generateReferralCode } from '@/app/partners/_lib/auth';
import { recordDealUpdate } from '@repo/deal-updates';

// Simple in-memory rate limit: 10 requests per IP per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const HOURS_IN_MS = 60 * 60 * 1000;
const RATE_LIMIT = 10;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + HOURS_IN_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

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
});

function mapPropertyType(
  pt: z.infer<typeof InputSchema>['propertyType'],
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
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'anonymous';

  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
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
      { status: 400 },
    );
  }

  const input = parsed.data;

  // Create QuoteRequest with processing status
  let quoteRequest;
  let autoCreatedAgent: { referralCode: string; contactName: string; firmName: string } | null = null;
  try {
    quoteRequest = await database.quoteRequest.create({
      data: {
        source: input.referralCode ? 'agent_portal' : 'public_web',
        referralCode: input.referralCode ? input.referralCode.toUpperCase() : undefined,
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
      { status: 500 },
    );
  }

  // Generate offer
  try {
    const offer = await generateInstantOffer({
      postcode: input.postcode,
      address: input.address,
      propertyType: mapPropertyType(input.propertyType),
      bedrooms: input.bedrooms,
      condition: input.condition,
      situation: input.situation as InstantOfferSituation,
      urgencyDays: input.urgencyDays,
      askingPricePence: input.askingPricePence,
    });

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
          ? 'A senior member of our team is reviewing the inputs and will confirm a binding offer within 2 hours.'
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
          'Offer engine is temporarily unavailable. A member of our team will email you within 2 hours.',
      },
      { status: 500 },
    );
  }
}

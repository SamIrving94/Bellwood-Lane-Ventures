import { NextResponse } from 'next/server';
import { z } from 'zod';
import { database } from '@repo/database';
import {
  generateInstantOffer,
  type InstantOfferSituation,
} from '@repo/instant-offer';
import type { PropertyType } from '@repo/valuation';

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
  try {
    quoteRequest = await database.quoteRequest.create({
      data: {
        source: 'public_web',
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

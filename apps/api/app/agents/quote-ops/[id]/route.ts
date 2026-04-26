import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAgentAuth, unauthorizedResponse } from '../../_lib/auth';

/**
 * GET /agents/quote-ops/[id]
 *
 * Full QuoteRequest detail for Paperclip — including the full offer,
 * the live FounderAction, and any DealUpdates already on the timeline.
 * Used during enrichment + signed-PDF drafting.
 */
export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();
  const { id } = await params;

  const quote = await database.quoteRequest.findUnique({
    where: { id },
    include: {
      offer: true,
      dealUpdates: { orderBy: { createdAt: 'desc' }, take: 20 },
      trackToken: true,
    },
  });
  if (!quote) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Find the matching FounderAction (the SLA hook).
  const actions = await database.founderAction.findMany({
    where: {
      metadata: { path: ['quoteRequestId'], equals: id },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    quote,
    actions,
  });
};

/**
 * PATCH /agents/quote-ops/[id]
 *
 * Enrichment writeback. Paperclip calls this after looking up the
 * missing data the panic-form didn't capture — Rightmove bedrooms,
 * environmental risk, Companies House on the firm. Updates the
 * QuoteRequest and (optionally) replaces the QuoteOffer with a
 * re-run AVM.
 */
const PatchInput = z.object({
  bedrooms: z.number().int().min(1).max(20).optional(),
  propertyType: z
    .enum(['terraced_house', 'semi_detached', 'detached', 'flat', 'other'])
    .optional(),
  condition: z.number().int().min(1).max(10).optional(),
  askingPricePence: z.number().int().positive().optional(),
  notesAppend: z.string().optional(),
  /**
   * Replace the live offer with a re-computed AVM. Paperclip must call
   * runAVM itself (or use @repo/instant-offer) and pass the result here;
   * we don't run the engine inside this route.
   */
  replaceOffer: z
    .object({
      estimatedMarketValueMinPence: z.number().int().positive(),
      estimatedMarketValueMaxPence: z.number().int().positive(),
      offerPence: z.number().int().positive(),
      offerPercentOfAvm: z.number().positive(),
      confidenceScore: z.number().min(0).max(1),
      completionDays: z.number().int().positive(),
      reasoning: z.array(z.string()),
      lockedUntil: z.string().datetime(),
    })
    .optional(),
});

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = PatchInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const existing = await database.quoteRequest.findUnique({
    where: { id },
    include: { offer: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Build the patch
  const updateData: Record<string, unknown> = {};
  if (input.bedrooms !== undefined) updateData.bedrooms = input.bedrooms;
  if (input.propertyType !== undefined) updateData.propertyType = input.propertyType;
  if (input.condition !== undefined) updateData.condition = input.condition;
  if (input.askingPricePence !== undefined) {
    updateData.askingPricePence = input.askingPricePence;
  }
  if (input.notesAppend) {
    const enrichmentLine = `[Paperclip enrichment ${new Date().toISOString()}] ${input.notesAppend}`;
    updateData.notes = existing.notes
      ? `${existing.notes}\n${enrichmentLine}`
      : enrichmentLine;
  }

  let newOfferId: string | undefined;
  if (input.replaceOffer) {
    const newOffer = await database.quoteOffer.create({
      data: {
        estimatedMarketValueMinPence: input.replaceOffer.estimatedMarketValueMinPence,
        estimatedMarketValueMaxPence: input.replaceOffer.estimatedMarketValueMaxPence,
        offerPence: input.replaceOffer.offerPence,
        offerPercentOfAvm: input.replaceOffer.offerPercentOfAvm,
        confidenceScore: input.replaceOffer.confidenceScore,
        completionDays: input.replaceOffer.completionDays,
        reasoning: input.replaceOffer.reasoning,
        lockedUntil: new Date(input.replaceOffer.lockedUntil),
      },
    });
    newOfferId = newOffer.id;
    updateData.offerId = newOffer.id;
  }

  const updated = await database.quoteRequest.update({
    where: { id },
    data: updateData,
    include: { offer: true },
  });

  return NextResponse.json({
    ok: true,
    quote: updated,
    newOfferId,
  });
};

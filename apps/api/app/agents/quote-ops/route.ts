import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

/**
 * GET /agents/quote-ops
 *
 * Lists agent_quick_form QuoteRequests Paperclip needs to action. Default
 * scope: open submissions in the last 48h that haven't been resolved
 * (i.e. signed PDF not yet sent / FounderAction still pending).
 *
 * Query params:
 *   ?status=pending       — only items still awaiting signed PDF (default)
 *   ?status=all           — every agent_quick_form submission in window
 *   ?hours=48             — how far back to look (default 48)
 *
 * Returns the data Paperclip needs to enrich + draft the signed offer:
 * QuoteRequest + linked QuoteOffer + the live FounderAction.
 */
export const GET = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'pending';
  const hours = Number.parseInt(url.searchParams.get('hours') ?? '48', 10);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const where: Record<string, unknown> = {
    source: 'agent_quick_form',
    createdAt: { gte: since },
  };
  if (status === 'pending') {
    where.status = { in: ['quoted', 'processing'] };
  }

  const quotes = await database.quoteRequest.findMany({
    where,
    include: { offer: true },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  // For each quote, find the matching live FounderAction so Paperclip
  // knows the SLA deadline + can resolve it later.
  const quoteIds = quotes.map((q) => q.id);
  const actions = quoteIds.length
    ? await database.founderAction.findMany({
        where: {
          status: { in: ['pending', 'in_progress'] },
          metadata: { path: ['quoteRequestId'], equals: undefined },
        },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  const actionsByQuote = new Map<string, (typeof actions)[number]>();
  for (const action of actions) {
    const meta = (action.metadata as { quoteRequestId?: string }) ?? {};
    if (meta.quoteRequestId && !actionsByQuote.has(meta.quoteRequestId)) {
      actionsByQuote.set(meta.quoteRequestId, action);
    }
  }

  return NextResponse.json({
    count: quotes.length,
    quotes: quotes.map((q) => ({
      id: q.id,
      address: q.address,
      postcode: q.postcode,
      contactName: q.contactName,
      contactEmail: q.contactEmail,
      contactPhone: q.contactPhone,
      firmName: q.firmName,
      sellerSituation: q.sellerSituation,
      urgencyDays: q.urgencyDays,
      bedrooms: q.bedrooms,
      propertyType: q.propertyType,
      condition: q.condition,
      askingPricePence: q.askingPricePence,
      notes: q.notes,
      status: q.status,
      createdAt: q.createdAt,
      offer: q.offer
        ? {
            id: q.offer.id,
            offerPence: q.offer.offerPence,
            estimatedMarketValueMinPence: q.offer.estimatedMarketValueMinPence,
            estimatedMarketValueMaxPence: q.offer.estimatedMarketValueMaxPence,
            offerPercentOfAvm: q.offer.offerPercentOfAvm,
            confidenceScore: q.offer.confidenceScore,
            completionDays: q.offer.completionDays,
            lockedUntil: q.offer.lockedUntil,
            reasoning: q.offer.reasoning,
          }
        : null,
      action: actionsByQuote.has(q.id)
        ? {
            id: actionsByQuote.get(q.id)!.id,
            status: actionsByQuote.get(q.id)!.status,
            priority: actionsByQuote.get(q.id)!.priority,
            expiresAt: actionsByQuote.get(q.id)!.expiresAt,
          }
        : null,
    })),
  });
};

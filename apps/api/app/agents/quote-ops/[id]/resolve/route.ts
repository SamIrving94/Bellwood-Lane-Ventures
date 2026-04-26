import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAgentAuth, unauthorizedResponse } from '../../../_lib/auth';

/**
 * POST /agents/quote-ops/[id]/resolve
 *
 * Mark the SLA Founder Action for this quote as completed. Paperclip
 * calls this once the signed PDF has been sent + the WhatsApp
 * acknowledgement is out — the 4-hour SLA clock stops here.
 *
 * Body:
 *   {
 *     resolvedBy: 'paperclip-appraiser',  // or human user id
 *     outcome: 'signed_pdf_sent',         // free-form audit string
 *     metadata: { messageId, signedOfferUrl, ... } // optional
 *   }
 */
const Input = z.object({
  resolvedBy: z.string().min(1),
  outcome: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();
  const { id: quoteRequestId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Find live FounderActions for this quote
  const actions = await database.founderAction.findMany({
    where: {
      status: { in: ['pending', 'in_progress'] },
      metadata: { path: ['quoteRequestId'], equals: quoteRequestId },
    },
  });

  if (actions.length === 0) {
    return NextResponse.json(
      { error: 'No live founder action found for this quote' },
      { status: 404 },
    );
  }

  const now = new Date();
  const resolved = await Promise.all(
    actions.map((action) => {
      const merged = {
        ...((action.metadata as Record<string, unknown>) ?? {}),
        outcome: parsed.data.outcome,
        ...(parsed.data.metadata ?? {}),
      };
      return database.founderAction.update({
        where: { id: action.id },
        data: {
          status: 'completed',
          resolvedBy: parsed.data.resolvedBy,
          resolvedAt: now,
          metadata: merged,
        },
      });
    }),
  );

  return NextResponse.json({
    ok: true,
    resolvedCount: resolved.length,
    resolvedIds: resolved.map((r) => r.id),
  });
};

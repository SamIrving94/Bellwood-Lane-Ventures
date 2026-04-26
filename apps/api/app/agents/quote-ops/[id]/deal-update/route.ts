import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordDealUpdate } from '@repo/deal-updates';
import { validateAgentAuth, unauthorizedResponse } from '../../../_lib/auth';

/**
 * POST /agents/quote-ops/[id]/deal-update
 *
 * Append an event to the vendor-facing timeline. Paperclip calls this
 * after each meaningful step — signed-PDF sent, WhatsApp delivered,
 * vendor accepted, vendor declined, etc. Whatever vendor sees on
 * trackUrl mirrors what's recorded here.
 *
 * Mirrors the shape of @repo/deal-updates.recordDealUpdate so Paperclip
 * can use the same vocabulary as the rest of the platform.
 */
const Input = z.object({
  kind: z.string().min(1), // e.g. 'signed_pdf_sent', 'whatsapp_delivered'
  title: z.string().min(1),
  detail: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const POST = async (
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
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const recorded = await recordDealUpdate({
      quoteRequestId: id,
      kind: parsed.data.kind as Parameters<typeof recordDealUpdate>[0]['kind'],
      title: parsed.data.title,
      detail: parsed.data.detail,
      metadata: parsed.data.metadata,
    });
    return NextResponse.json({
      ok: true,
      trackUrl: recorded.trackUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Could not record deal update',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
};

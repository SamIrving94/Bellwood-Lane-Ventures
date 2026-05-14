import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAgentAuth, unauthorizedResponse } from '../../../_lib/auth';

/**
 * POST /agents/inbox/[id]/complete
 *
 * Paperclip agent marks a FounderAction as completed once it's drafted
 * its output (typically held drafts surfaced for board approval). The
 * board can still re-open / reject from the dashboard.
 */
const Input = z.object({
  resolvedBy: z.string().min(1),
  outcomeNote: z.string().optional(),
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

  const existing = await database.founderAction.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const mergedMeta = {
    ...((existing.metadata as Record<string, unknown> | null) ?? {}),
    completedBy: parsed.data.resolvedBy,
    outcomeNote: parsed.data.outcomeNote,
    ...(parsed.data.metadata ?? {}),
  };

  const updated = await database.founderAction.update({
    where: { id },
    data: {
      status: 'completed',
      resolvedBy: parsed.data.resolvedBy,
      resolvedAt: new Date(),
      metadata: mergedMeta,
    },
  });

  return NextResponse.json({ ok: true, action: updated });
};

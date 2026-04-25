// POST /agents/deal-update
//
// Paperclip agents (or any internal trigger) push timeline events here.
// Bearer auth via PAPERCLIP_API_KEY. The endpoint records the update,
// generates / reuses a TrackToken, and dispatches transparent emails
// to the full chain via @repo/deal-updates.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordDealUpdate } from '@repo/deal-updates';
import { validateAgentAuth } from '../_lib/auth';

const ALLOWED_KINDS = [
  'quote_requested',
  'offer_sent',
  'offer_accepted',
  'offer_declined',
  'offer_expired',
  'solicitor_instructed',
  'searches_ordered',
  'survey_scheduled',
  'survey_completed',
  'enquiries_raised',
  'enquiries_resolved',
  'exchange_target_set',
  'exchanged',
  'completion_target_set',
  'completed',
  'delay',
  'founder_review',
  'resale_listed',
  'note',
] as const;

const ALLOWED_VISIBILITY = [
  'public',
  'agent_only',
  'internal',
] as const;

const Body = z
  .object({
    dealId: z.string().optional(),
    quoteRequestId: z.string().optional(),
    kind: z.enum(ALLOWED_KINDS),
    title: z.string().min(1).max(200),
    detail: z.string().max(4000).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    visibility: z.enum(ALLOWED_VISIBILITY).default('public'),
    skipNotify: z.boolean().optional(),
    notifyOverride: z.array(z.string().email()).max(20).optional(),
    notifiedBy: z.string().max(120).optional(),
  })
  .refine((v) => v.dealId || v.quoteRequestId, {
    message: 'dealId or quoteRequestId required',
  });

export async function POST(request: Request) {
  if (!validateAgentAuth(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const recorded = await recordDealUpdate({
      ...parsed.data,
      notifiedBy: parsed.data.notifiedBy ?? 'paperclip',
    });
    return NextResponse.json(recorded);
  } catch (err) {
    console.error('[agents/deal-update] failed', err);
    return NextResponse.json(
      { error: 'Could not record update' },
      { status: 500 },
    );
  }
}

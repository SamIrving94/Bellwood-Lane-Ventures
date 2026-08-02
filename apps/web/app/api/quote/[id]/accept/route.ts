import {
  LIMITS,
  checkRateLimits,
  clientIp,
  retryAfterSeconds,
} from '@/lib/rate-limit';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * POST /api/quote/[id]/accept
 *
 * Flips a seller's quote to `accepted` — the state convertQuoteToDeal is
 * gated on, so this is what records vendor consent at the offer price.
 *
 * The id in the path is public: it is the same one in the /instant-offer/
 * offer/[id] certificate URL, so it cannot be the authorisation. Acceptance
 * is gated on the quote's TrackToken instead — the unguessable value the
 * seller receives in their offer email and on /track/<token>. Same posture as
 * /api/track/[token]/reply: no account, but you must hold the private link.
 */
const Input = z.object({
  token: z.string().min(16).max(64).optional(),
});

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Two subjects. The per-quote cap is the meaningful one — it is the
  // brute-force budget against the track token. The IP cap stops a caller
  // walking quote ids, each of which would otherwise get a fresh budget.
  const ip = clientIp(request) ?? 'anonymous';
  const limit = await checkRateLimits([
    { rule: LIMITS.quoteAcceptByQuote, subject: `quote:${id}` },
    { rule: LIMITS.quoteAcceptByIp, subject: `ip:${ip}` },
  ]);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': retryAfterSeconds(limit.resetAt) },
      }
    );
  }

  // Token may arrive in the body or as ?token= (the track page links here).
  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const supplied =
    parsed.data.token ??
    new URL(request.url).searchParams.get('token') ??
    null;

  try {
    const quote = await database.quoteRequest.findUnique({
      where: { id },
      include: { offer: true, trackToken: true },
    });

    if (!quote || !quote.offer) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // No token on the quote means nobody has been given a private link for
    // it, so there is no holder who could legitimately accept here.
    if (!quote.trackToken || !supplied || supplied !== quote.trackToken.token) {
      return NextResponse.json(
        {
          error:
            'This offer can only be accepted from your private tracking link. Check your offer email, or reply to us and we will resend it.',
        },
        { status: 403 }
      );
    }

    // Idempotent: re-posting the same acceptance is a no-op, never a second
    // acceptedAt that would look like a fresh consent event.
    if (quote.status === 'accepted') {
      return NextResponse.json({ ok: true, alreadyAccepted: true });
    }

    if (quote.offer.lockedUntil < new Date()) {
      return NextResponse.json(
        { error: 'This offer has expired.' },
        { status: 410 }
      );
    }

    await database.quoteRequest.update({
      where: { id },
      data: { status: 'accepted' },
    });

    await database.quoteOffer.update({
      where: { id: quote.offer.id },
      data: { acceptedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[quote/accept] failed', err);
    return NextResponse.json(
      { error: 'Could not reserve this offer.' },
      { status: 500 }
    );
  }
}

import { isPreviewToken, packState } from '@/lib/investor-pack';
import {
  LIMITS,
  checkRateLimits,
  clientIp,
  retryAfterSeconds,
} from '@/lib/rate-limit';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// An investor registers interest in a back-to-back pack at its fixed price.
// The access token IS the identity: the email comes from the token, never
// from the request body, so one investor can't register in another's name.
// Each registration raises a FounderAction; nothing is agreed automatically.

const bodySchema = z.object({
  dealId: z.string().min(1).max(64),
  name: z.string().trim().min(1, 'Add your name.').max(120),
  note: z.string().trim().max(1000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const limit = await checkRateLimits([
    { rule: LIMITS.investorInterestByToken, subject: token },
    {
      rule: LIMITS.investorInterestByIp,
      subject: clientIp(request) ?? 'unknown',
    },
  ]);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again shortly.' },
      {
        status: 429,
        headers: { 'Retry-After': retryAfterSeconds(limit.resetAt) },
      }
    );
  }

  const access = await database.investorAccessToken.findUnique({
    where: { token },
    select: { id: true, label: true, email: true, revoked: true },
  });
  if (!access || access.revoked) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 });
  }
  if (isPreviewToken(access)) {
    return NextResponse.json(
      {
        error: 'This is your preview link. Investors register from their own.',
      },
      { status: 403 }
    );
  }
  if (!access.email) {
    return NextResponse.json(
      { error: 'This link has no email on file. Reply to our email instead.' },
      { status: 409 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }
  const { dealId, name, note } = parsed.data;

  const pack = await database.investorPack.findUnique({
    where: { dealId },
    select: {
      status: true,
      closesAt: true,
      pricePence: true,
      headline: true,
      deal: { select: { postcode: true } },
    },
  });
  if (!pack) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }
  if (packState(pack) !== 'open') {
    return NextResponse.json(
      { error: 'Interest on this deal has closed.' },
      { status: 409 }
    );
  }

  const email = access.email.toLowerCase();
  const existing = await database.investorInterest.findUnique({
    where: { dealId_investorEmail: { dealId, investorEmail: email } },
    select: { id: true },
  });

  await database.investorInterest.upsert({
    where: { dealId_investorEmail: { dealId, investorEmail: email } },
    create: {
      dealId,
      investorName: name,
      investorEmail: email,
      note: note || null,
      notify: true,
      status: 'interested',
      pricePence: pack.pricePence,
      source: 'pack',
    },
    update: {
      investorName: name,
      note: note || null,
      pricePence: pack.pricePence,
    },
  });

  // One action per investor per deal; a re-submit only updates the note.
  if (!existing) {
    const price = `£${Math.round(pack.pricePence / 100).toLocaleString('en-GB')}`;
    await database.founderAction
      .create({
        data: {
          type: 'investor_interest',
          priority: 'high',
          status: 'pending',
          agent: 'system',
          dealId,
          title: `Investor interest: ${name} on ${pack.deal.postcode}`,
          description: `${name} (${access.label}, ${email}) registered interest at ${price} on "${pack.headline}".${note ? ` Note: ${note}` : ''} Call them to confirm funds and timing.`,
          metadata: { investorEmail: email, pricePence: pack.pricePence },
          dedupKey: `${dealId}:investor_interest:${email}`,
        },
      })
      .catch(() => {});

    await database.dealActivity
      .create({
        data: {
          dealId,
          action: 'investor_interest_registered',
          detail: `${name} (${email}) registered interest from the pack at ${price}.`,
        },
      })
      .catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

import { createMagicLinkToken } from '@/app/partners/_lib/auth';
import { escapeHtml } from '@/lib/escape-html';
import {
  LIMITS,
  checkRateLimit,
  clientIp,
  retryAfterSeconds,
} from '@/lib/rate-limit';
import { brand } from '@repo/brand';
import { database } from '@repo/database';
import { sendEmail } from '@repo/email';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const InputSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const ip = clientIp(request) ?? 'anonymous';
  const ipLimit = await checkRateLimit(LIMITS.partnerAuthByIp, `ip:${ip}`);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: 'Too many sign-in requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': retryAfterSeconds(ipLimit.resetAt) },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const { email } = parsed.data;

  // Per-address cap so nobody can be mail-bombed by rotating source IPs.
  const emailLimit = await checkRateLimit(
    LIMITS.partnerAuthByEmail,
    `email:${email.toLowerCase()}`
  );
  if (!emailLimit.ok) {
    // Same shape as the unknown-account reply: never leak that this address
    // exists, even while throttling it.
    return NextResponse.json({ ok: true, emailSent: false });
  }
  const agent = await database.agentAccount.findUnique({ where: { email } });

  // Don't leak whether account exists
  if (!agent) {
    return NextResponse.json({ ok: true, emailSent: false });
  }

  const token = createMagicLinkToken(agent.id);
  // Never derive the emailed link from request headers: an attacker can POST
  // with a forged Origin and have us email the victim a real token pointing at
  // their own host.
  const origin = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001';
  const link = `${origin}/partners/verify?token=${encodeURIComponent(token)}`;

  const subject = `Your ${brand.name} portal sign-in link`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#F7F3EA">
      <p style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#1F332B;letter-spacing:-0.03em">${escapeHtml(brand.mark)}</p>
      <p style="color:#1F332B;font-size:16px;line-height:1.6;margin-top:32px">Hi ${escapeHtml(agent.contactName)},</p>
      <p style="color:#1F332B;font-size:16px;line-height:1.6">Your sign-in link for the ${escapeHtml(brand.name)} agent portal. Valid for 15 minutes.</p>
      <p style="margin:32px 0"><a href="${link}" style="display:inline-block;background:#2E7D5B;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600">Sign in →</a></p>
      <p style="color:#4C5A50;font-size:13px;line-height:1.6">Or paste: <a href="${link}" style="color:#2E7D5B">${link}</a></p>
      <p style="color:#4C5A50;font-size:12px;margin-top:40px;border-top:1px solid #E2DCCB;padding-top:16px">Didn't request this? You can safely ignore this email.</p>
    </div>
  `;

  const sendResult = await sendEmail({ to: email, subject, html });
  if (sendResult.skipped) {
    console.log(`[partners/login] magic link for ${email}: ${link}`);
  }

  return NextResponse.json({
    ok: true,
    emailSent: !sendResult.skipped,
    ...(process.env.NODE_ENV !== 'production' ? { devMagicLink: link } : {}),
  });
}

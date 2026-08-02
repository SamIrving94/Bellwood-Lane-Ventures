import {
  createMagicLinkToken,
  generateReferralCode,
} from '@/app/partners/_lib/auth';
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
  contactName: z.string().min(1),
  firmName: z.string().min(1),
  phone: z.string().optional(),
  postcode: z.string().optional(),
});

export async function POST(request: Request) {
  const ip = clientIp(request) ?? 'anonymous';
  const ipLimit = await checkRateLimit(LIMITS.partnerAuthByIp, `ip:${ip}`);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: 'Too many sign-up requests. Please try again later.' },
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
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, contactName, firmName, phone, postcode } = parsed.data;

  // Per-address cap: this route emails whoever is named in the payload.
  const emailLimit = await checkRateLimit(
    LIMITS.partnerAuthByEmail,
    `email:${email.toLowerCase()}`
  );
  if (!emailLimit.ok) {
    return NextResponse.json(
      {
        error:
          'Too many sign-up requests for this email. Please try again later.',
      },
      {
        status: 429,
        headers: { 'Retry-After': retryAfterSeconds(emailLimit.resetAt) },
      }
    );
  }

  // Upsert agent account
  let agent = await database.agentAccount.findUnique({ where: { email } });
  if (!agent) {
    let referralCode = generateReferralCode(firmName);
    // collision avoidance
    for (let i = 0; i < 5; i++) {
      const exists = await database.agentAccount.findUnique({
        where: { referralCode },
      });
      if (!exists) break;
      referralCode = generateReferralCode(firmName);
    }
    agent = await database.agentAccount.create({
      data: { email, contactName, firmName, phone, postcode, referralCode },
    });
  }

  // Generate magic link. The origin is NEVER taken from request headers: a
  // forged Origin would have us email a real token pointing at an attacker host.
  const token = createMagicLinkToken(agent.id);
  const origin = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001';
  const link = `${origin}/partners/verify?token=${encodeURIComponent(token)}`;

  // Send the email (gracefully skips if no Resend token)
  const subject = `Your ${brand.name} partner portal link`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#F7F3EA">
      <p style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#1F332B;letter-spacing:-0.03em">${escapeHtml(brand.mark)}</p>
      <p style="color:#1F332B;font-size:16px;line-height:1.6;margin-top:32px">Hi ${escapeHtml(contactName)},</p>
      <p style="color:#1F332B;font-size:16px;line-height:1.6">Click the link below to sign in to your ${escapeHtml(brand.name)} agent portal. The link is valid for 15 minutes.</p>
      <p style="margin:32px 0"><a href="${link}" style="display:inline-block;background:#2E7D5B;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600">Sign in to the portal →</a></p>
      <p style="color:#4C5A50;font-size:13px;line-height:1.6">Or paste this link into your browser: <br/><a href="${link}" style="color:#2E7D5B">${link}</a></p>
      <p style="color:#4C5A50;font-size:13px;line-height:1.6;margin-top:40px">Your referral code is <strong style="color:#1F332B">${escapeHtml(agent.referralCode)}</strong> — any seller who uses it on our indicative-offer tool is automatically credited to you.</p>
      <p style="color:#4C5A50;font-size:12px;margin-top:40px;border-top:1px solid #E2DCCB;padding-top:16px">${escapeHtml(brand.legalName)} · Property Redress Scheme (PRS) · HMRC AML supervised · ICO registered</p>
    </div>
  `;

  const sendResult = await sendEmail({ to: email, subject, html });

  // Log the link in dev / when no Resend token
  if (sendResult.skipped) {
    console.log(`[partners/signup] magic link for ${email}: ${link}`);
  }

  return NextResponse.json({
    ok: true,
    emailSent: !sendResult.skipped,
    referralCode: agent.referralCode,
    // In development, return the link so testing is easier
    ...(process.env.NODE_ENV !== 'production' ? { devMagicLink: link } : {}),
  });
}

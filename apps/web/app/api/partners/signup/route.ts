import { NextResponse } from 'next/server';
import { z } from 'zod';
import { database } from '@repo/database';
import { createMagicLinkToken, generateReferralCode } from '@/app/partners/_lib/auth';
import { sendEmail } from '@repo/email';

const InputSchema = z.object({
  email: z.string().email(),
  contactName: z.string().min(1),
  firmName: z.string().min(1),
  phone: z.string().optional(),
  postcode: z.string().optional(),
});

export async function POST(request: Request) {
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
      { status: 400 },
    );
  }

  const { email, contactName, firmName, phone, postcode } = parsed.data;

  // Upsert agent account
  let agent = await database.agentAccount.findUnique({ where: { email } });
  if (!agent) {
    let referralCode = generateReferralCode(firmName);
    // collision avoidance
    for (let i = 0; i < 5; i++) {
      const exists = await database.agentAccount.findUnique({ where: { referralCode } });
      if (!exists) break;
      referralCode = generateReferralCode(firmName);
    }
    agent = await database.agentAccount.create({
      data: { email, contactName, firmName, phone, postcode, referralCode },
    });
  }

  // Generate magic link
  const token = createMagicLinkToken(agent.id);
  const origin =
    request.headers.get('origin') ||
    process.env.NEXT_PUBLIC_WEB_URL ||
    'http://localhost:3001';
  const link = `${origin}/partners/verify?token=${encodeURIComponent(token)}`;

  // Send the email (gracefully skips if no Resend token)
  const subject = 'Your Bellwood partner portal link';
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#FAFAF7">
      <p style="font-family:Georgia,serif;font-size:24px;font-weight:600;color:#0A2540;letter-spacing:-0.02em">BELLWOOD VENTURES</p>
      <p style="color:#0A1020;font-size:16px;line-height:1.6;margin-top:32px">Hi ${contactName},</p>
      <p style="color:#0A1020;font-size:16px;line-height:1.6">Click the link below to sign in to your Bellwood agent portal. The link is valid for 15 minutes.</p>
      <p style="margin:32px 0"><a href="${link}" style="display:inline-block;background:#C6A664;color:#0A1020;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600">Sign in to the portal →</a></p>
      <p style="color:#6B7280;font-size:13px;line-height:1.6">Or paste this link into your browser: <br/><a href="${link}" style="color:#0A2540">${link}</a></p>
      <p style="color:#6B7280;font-size:13px;line-height:1.6;margin-top:40px">Your referral code is <strong style="color:#0A1020">${agent.referralCode}</strong> — any seller who uses it on our instant-offer tool is automatically credited to you.</p>
      <p style="color:#6B7280;font-size:12px;margin-top:40px;border-top:1px solid #e5e7eb;padding-top:16px">Bellwood Ventures Ltd · NAPB · TPO · HMRC AML supervised</p>
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

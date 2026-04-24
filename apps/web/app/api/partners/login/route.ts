import { NextResponse } from 'next/server';
import { z } from 'zod';
import { database } from '@repo/database';
import { createMagicLinkToken } from '@/app/partners/_lib/auth';
import { sendEmail } from '@repo/email';

const InputSchema = z.object({
  email: z.string().email(),
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
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const { email } = parsed.data;
  const agent = await database.agentAccount.findUnique({ where: { email } });

  // Don't leak whether account exists
  if (!agent) {
    return NextResponse.json({ ok: true, emailSent: false });
  }

  const token = createMagicLinkToken(agent.id);
  const origin =
    request.headers.get('origin') ||
    process.env.NEXT_PUBLIC_WEB_URL ||
    'http://localhost:3001';
  const link = `${origin}/partners/verify?token=${encodeURIComponent(token)}`;

  const subject = 'Your Bellwood portal sign-in link';
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#FAFAF7">
      <p style="font-family:Georgia,serif;font-size:24px;font-weight:600;color:#0A2540;letter-spacing:-0.02em">BELLWOOD VENTURES</p>
      <p style="color:#0A1020;font-size:16px;line-height:1.6;margin-top:32px">Hi ${agent.contactName},</p>
      <p style="color:#0A1020;font-size:16px;line-height:1.6">Your sign-in link for the Bellwood agent portal. Valid for 15 minutes.</p>
      <p style="margin:32px 0"><a href="${link}" style="display:inline-block;background:#C6A664;color:#0A1020;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600">Sign in →</a></p>
      <p style="color:#6B7280;font-size:13px;line-height:1.6">Or paste: <a href="${link}" style="color:#0A2540">${link}</a></p>
      <p style="color:#6B7280;font-size:12px;margin-top:40px;border-top:1px solid #e5e7eb;padding-top:16px">Didn't request this? You can safely ignore this email.</p>
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

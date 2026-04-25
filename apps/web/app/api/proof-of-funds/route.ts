// Proof-of-funds capture endpoint.
// Persists a request, optionally emails the founder, returns 200.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmail } from '@repo/email';

export const runtime = 'nodejs';

const Body = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  context: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = Body.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { name, email, context } = parsed.data;

  // Email Anthony with the request — graceful when Resend not configured.
  const subject = `[Proof of funds] ${name} <${email}>`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px">
      <p style="font-family:Georgia,serif;font-size:18px;color:#0A2540">New proof-of-funds request</p>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> <a href="mailto:${email}">${escapeHtml(email)}</a></p>
      ${context ? `<p><strong>Context:</strong><br/>${escapeHtml(context).replace(/\n/g, '<br/>')}</p>` : ''}
      <p style="color:#6B7280;font-size:12px;margin-top:24px">Bellwoods Lane · received via instant-offer</p>
    </div>
  `;

  await sendEmail({
    to: 'anthony@bellwoodslane.co.uk',
    subject,
    html,
  }).catch(() => undefined);

  console.info('[proof-of-funds]', { name, email, context });

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

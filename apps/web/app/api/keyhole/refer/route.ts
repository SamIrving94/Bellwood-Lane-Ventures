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

/**
 * Keyhole referral — the OPT-IN moment where a professional chooses to send
 * a property to us. Flips the flags on the report row and notifies the deals
 * inbox with the report link. Deliberately does NOT create a ScoutLead or
 * Deal: a referral is a person asking to talk, and per Steps vs Thoughts the
 * founder decides what it becomes.
 */

const InputSchema = z.object({
  reportId: z.string().min(8).max(64),
  note: z.string().trim().max(2000).optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
});

export async function POST(request: Request) {
  const ip = clientIp(request) ?? 'anonymous';
  const ipLimit = await checkRateLimit(LIMITS.keyholeReferByIp, `ip:${ip}`);
  if (!ipLimit.ok) {
    return NextResponse.json(
      {
        error:
          'Too many referrals from this connection. Please try again later.',
      },
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

  const { reportId, note } = parsed.data;
  const contactEmail = parsed.data.contactEmail || undefined;

  const existing = await database.keyholeReport.findUnique({
    where: { id: reportId },
    select: { id: true, addressLine: true, postcode: true, email: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  await database.keyholeReport.update({
    where: { id: reportId },
    data: {
      referralRequested: true,
      referredAt: new Date(),
      referralNote: note ?? null,
      // A contact given at referral time beats an absent one from lookup time.
      ...(contactEmail && !existing.email ? { email: contactEmail } : {}),
    },
  });

  const origin = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001';
  const link = `${origin}/keyhole/report/${reportId}`;
  const replyTo = contactEmail ?? existing.email;
  const sent = await sendEmail({
    to: brand.dealsEmail,
    subject: `Keyhole referral: ${existing.addressLine}, ${existing.postcode}`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <p><strong>A professional referred a property through Keyhole.</strong></p>
        <p>${escapeHtml(existing.addressLine)}, ${escapeHtml(existing.postcode)}</p>
        ${note ? `<p>Note: ${escapeHtml(note)}</p>` : ''}
        ${replyTo ? `<p>Contact: ${escapeHtml(replyTo)}</p>` : '<p>No contact email was left.</p>'}
        <p><a href="${link}">Open the report</a></p>
      </div>
    `,
  });
  if (sent.skipped) {
    console.log(
      `[keyhole/refer] referral for ${existing.addressLine}, ${existing.postcode} — ${link}`
    );
  }

  return NextResponse.json({ ok: true });
}

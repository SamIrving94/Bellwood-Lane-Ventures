import { escapeHtml } from '@/lib/escape-html';
import { buildKeyholeReport } from '@/lib/keyhole/report';
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
 * Keyhole report generation (docs/prds/keyhole-v1-2026-08.md, Phase 0).
 * Creates the report row and returns its id; the durable, shareable render
 * lives at /keyhole/report/[id]. No login — the pilot's whole pitch is
 * "paste an address, get the page" — so the rate limits above carry the
 * abuse load instead.
 */

const InputSchema = z.object({
  addressLine: z.string().trim().min(2).max(200),
  postcode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/, {
      message: 'Enter a full UK postcode',
    }),
  email: z.string().email().optional().or(z.literal('')),
  professionalRole: z
    .enum(['solicitor', 'surveyor', 'wealth', 'care', 'other'])
    .optional(),
});

export async function POST(request: Request) {
  const ip = clientIp(request) ?? 'anonymous';
  const ipLimit = await checkRateLimit(LIMITS.keyholeReportByIp, `ip:${ip}`);
  if (!ipLimit.ok) {
    return NextResponse.json(
      {
        error: 'Too many reports from this connection. Please try again later.',
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

  const { addressLine, postcode, professionalRole } = parsed.data;
  const email = parsed.data.email || undefined;

  if (email) {
    const emailLimit = await checkRateLimit(
      LIMITS.keyholeReportByEmail,
      `email:${email.toLowerCase()}`
    );
    if (!emailLimit.ok) {
      return NextResponse.json(
        { error: 'Too many reports for this email. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': retryAfterSeconds(emailLimit.resetAt) },
        }
      );
    }
  }

  const report = await buildKeyholeReport({ addressLine, postcode });

  const row = await database.keyholeReport.create({
    data: {
      addressLine: report.addressLine,
      postcode: report.postcode,
      email: email ?? null,
      professionalRole: professionalRole ?? null,
      reportJson: report as never,
    },
    select: { id: true },
  });

  // Email the durable link when asked to. Graceful skip without a Resend
  // token; delivery failure never fails the report itself.
  const origin = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001';
  const link = `${origin}/keyhole/report/${row.id}`;
  if (email) {
    const subject = `Your Keyhole report: ${report.addressLine}, ${report.postcode}`;
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#F7F3EA">
        <p style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#1F332B;letter-spacing:-0.03em">${escapeHtml(brand.mark)}</p>
        <p style="color:#1F332B;font-size:16px;line-height:1.6;margin-top:32px">Your Keyhole report for <strong>${escapeHtml(report.addressLine)}, ${escapeHtml(report.postcode)}</strong> is ready.</p>
        <p style="margin:32px 0"><a href="${link}" style="display:inline-block;background:#2E7D5B;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600">Open the report</a></p>
        <p style="color:#4C5A50;font-size:13px;line-height:1.6">The link is yours to share with your client. The report shows public-register data and typical refurbishment cost bands. It is not a valuation.</p>
        <p style="color:#4C5A50;font-size:12px;margin-top:40px;border-top:1px solid #E2DCCB;padding-top:16px">${escapeHtml(brand.legalName)} · Property Redress Scheme (PRS) · HMRC AML supervised · ICO registered</p>
      </div>
    `;
    const sent = await sendEmail({ to: email, subject, html });
    if (sent.skipped) {
      console.log(`[keyhole/report] link for ${email}: ${link}`);
    }
  }

  return NextResponse.json({ ok: true, id: row.id, url: link });
}

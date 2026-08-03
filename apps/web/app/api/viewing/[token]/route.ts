import { LIMITS, checkRateLimit, retryAfterSeconds } from '@/lib/rate-limit';
import { database } from '@repo/database';
import { CONDITION_AREAS } from '@repo/database/viewing-report';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Field-partner report submission. The token IS the auth — same trust model
// as /track and the investor feed. Submitting flips the viewing to
// `submitted` and raises a high-priority Action Centre card; the offer is
// never adjusted automatically (steps vs thoughts).

const scoreSchema = z.number().int().min(1).max(5);

const bodySchema = z.object({
  conditionScores: z
    .record(z.string(), scoreSchema)
    .refine(
      (scores) =>
        CONDITION_AREAS.every(
          (a) => scoreSchema.safeParse(scores[a.key]).success
        ),
      'All condition areas must be scored 1-5'
    ),
  summary: z.string().trim().min(1).max(5000),
  redFlags: z.string().trim().max(5000).nullable(),
  refurbEstimatePence: z.number().int().min(0).max(100_000_000).nullable(),
  vendorMotivation: z.enum(['hot', 'warm', 'cold', 'unknown']),
  photos: z.array(z.string().url()).max(10),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const limit = await checkRateLimit(LIMITS.viewingSubmitByToken, token);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts — try again shortly.' },
      {
        status: 429,
        headers: { 'Retry-After': retryAfterSeconds(limit.resetAt) },
      }
    );
  }

  const viewing = await database.viewing.findUnique({
    where: { token },
    select: {
      id: true,
      status: true,
      dealId: true,
      partnerId: true,
      partner: { select: { name: true } },
      deal: { select: { address: true, postcode: true } },
    },
  });

  if (!viewing || viewing.status === 'cancelled') {
    return NextResponse.json({ error: 'Viewing not found' }, { status: 404 });
  }
  if (viewing.status === 'submitted' || viewing.status === 'reviewed') {
    return NextResponse.json(
      { error: 'This report has already been submitted.' },
      { status: 409 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid report' },
      { status: 400 }
    );
  }
  const report = parsed.data;

  // Only keep photo URLs this token actually uploaded (our blob host) — a
  // hand-crafted submit can't smuggle arbitrary links onto the dashboard.
  const photos = report.photos.filter((url) => {
    try {
      return new URL(url).hostname.endsWith('.vercel-storage.com');
    } catch {
      return false;
    }
  });

  await database.viewing.update({
    where: { id: viewing.id },
    data: {
      status: 'submitted',
      submittedAt: new Date(),
      conditionScores: report.conditionScores,
      summary: report.summary,
      redFlags: report.redFlags,
      refurbEstimatePence: report.refurbEstimatePence,
      vendorMotivation: report.vendorMotivation,
      photos,
    },
  });

  if (viewing.partnerId) {
    await database.fieldPartner
      .update({
        where: { id: viewing.partnerId },
        data: { viewingsCompleted: { increment: 1 } },
      })
      .catch(() => {});
  }

  const partnerName = viewing.partner?.name ?? 'Field partner';
  const worstAreas = CONDITION_AREAS.filter(
    (a) => (report.conditionScores[a.key] ?? 5) <= 2
  ).map((a) => a.label);

  await database.founderAction.create({
    data: {
      type: 'review_viewing_report',
      priority: 'high',
      title: `Viewing report in: ${viewing.deal.address}`,
      description: [
        `${partnerName} viewed ${viewing.deal.address}, ${viewing.deal.postcode}.`,
        report.refurbEstimatePence !== null
          ? `Refurb gut-feel: £${Math.round(report.refurbEstimatePence / 100).toLocaleString('en-GB')}.`
          : null,
        worstAreas.length > 0
          ? `Scored bad/poor: ${worstAreas.join(', ')}.`
          : null,
        report.redFlags ? `Red flags: ${report.redFlags}` : null,
        `Vendor: ${report.vendorMotivation}.`,
        'Review the report, then confirm or adjust the offer within the 24-48h promise.',
      ]
        .filter(Boolean)
        .join(' '),
      agent: 'system',
      dealId: viewing.dealId,
      dedupKey: `viewing:${viewing.id}:submitted`,
    },
  });

  await database.dealActivity.create({
    data: {
      dealId: viewing.dealId,
      action: 'viewing_report_submitted',
      detail: `${partnerName}: ${report.summary.slice(0, 200)}`,
    },
  });

  return NextResponse.json({ ok: true });
}

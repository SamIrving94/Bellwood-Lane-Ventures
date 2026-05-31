import { env } from '@/env';
import { database } from '@repo/database';
import {
  extractProbateFromPdf,
  type ProbateExtract,
} from '@repo/document-pipeline';
import { sendEmail } from '@repo/email';
import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * POST /webhooks/postmark/inbound
 *
 * Inbound email webhook from Postmark. Co-founder forwards an email with
 * PDF attachments (lease pack, probate grant, contract redline, etc.) to
 * `docs@bellwoodslane.co.uk` and Postmark POSTs the message here.
 *
 * Flow per inbound email:
 *   1. Validate Basic Auth (Postmark sends credentials we set in dashboard).
 *   2. Reject senders not on EMAIL_FORWARD_ALLOWLIST (anti-spam).
 *   3. For each PDF attachment (≤ 25 MB, application/pdf):
 *        a. Detect docType from subject keywords (probate / lease / contract).
 *        b. Try to match an active Deal by postcode extracted from body+subject.
 *        c. Run extractProbateFromPdf — same pipeline as the manual upload UI.
 *        d. Persist a DocumentExtract row with sourceType='email_forward'.
 *   4. Send a single acknowledgement email summarising what was processed.
 *
 * Non-PDF attachments are noted in the ack email but not processed.
 *
 * Postmark config (one-time): point the inbound stream webhook at
 *   https://bellwood-api.vercel.app/webhooks/postmark/inbound
 * with Basic Auth credentials matching POSTMARK_INBOUND_USER +
 * POSTMARK_INBOUND_PASS. Set the inbound address to the value of
 * EMAIL_FORWARD_INBOUND_ADDRESS (e.g. `docs@bellwoodslane.co.uk`).
 */

const AttachmentSchema = z.object({
  Name: z.string(),
  ContentType: z.string(),
  Content: z.string(), // base64
  ContentLength: z.number().int().nonnegative(),
});

const InboundSchema = z.object({
  From: z.string().email(),
  FromName: z.string().optional().default(''),
  Subject: z.string().optional().default(''),
  TextBody: z.string().optional().default(''),
  HtmlBody: z.string().optional().default(''),
  ReplyTo: z.string().optional(),
  Attachments: z.array(AttachmentSchema).optional().default([]),
});

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const POSTCODE_REGEX = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/gi;

// ────────────────────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────────────────────

function checkBasicAuth(request: Request): boolean {
  const expectedUser = env.POSTMARK_INBOUND_USER;
  const expectedPass = env.POSTMARK_INBOUND_PASS;
  if (!expectedUser || !expectedPass) return false;

  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Basic ')) return false;

  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8');
    const [user, pass] = decoded.split(':', 2);
    return user === expectedUser && pass === expectedPass;
  } catch {
    return false;
  }
}

function senderAllowed(fromEmail: string): boolean {
  const allowlist = env.EMAIL_FORWARD_ALLOWLIST;
  if (!allowlist) return false;
  const normalised = fromEmail.trim().toLowerCase();
  return allowlist
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalised);
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

type DocType = 'probate' | 'lease' | 'contract' | 'other';

function inferDocType(subject: string, filename: string): DocType {
  const haystack = `${subject} ${filename}`.toLowerCase();
  if (/\b(probate|grant of|letters of admin|deceased)\b/.test(haystack)) return 'probate';
  if (/\b(lease|leasehold|ground rent|service charge|tp1|lpe1)\b/.test(haystack)) return 'lease';
  if (/\b(contract|redline|tr1|sale agreement|memorandum|completion statement)\b/.test(haystack))
    return 'contract';
  return 'other';
}

function extractPostcodes(text: string): string[] {
  const matches = text.match(POSTCODE_REGEX) ?? [];
  return Array.from(
    new Set(matches.map((m) => m.toUpperCase().replace(/\s+/g, ' ').trim())),
  );
}

/**
 * Given an array of candidate postcodes (full or outward), find the first
 * active deal whose postcode matches. Returns null if no match.
 */
async function findDealByPostcodes(postcodes: string[]): Promise<string | null> {
  if (postcodes.length === 0) return null;

  // Try full postcodes first (most specific), then outward codes.
  for (const pc of postcodes) {
    const deal = await database.deal
      .findFirst({
        where: {
          postcode: { equals: pc, mode: 'insensitive' },
          status: { notIn: ['completed', 'rejected', 'withdrawn'] },
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      })
      .catch(() => null);
    if (deal) return deal.id;
  }

  // Fall back to outward-only match (e.g. "M14") against the start of stored
  // postcodes. Cheaper to do this as a second pass.
  for (const pc of postcodes) {
    const outward = pc.split(' ')[0];
    if (!outward) continue;
    const deal = await database.deal
      .findFirst({
        where: {
          postcode: { startsWith: outward, mode: 'insensitive' },
          status: { notIn: ['completed', 'rejected', 'withdrawn'] },
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      })
      .catch(() => null);
    if (deal) return deal.id;
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────────────────────

type AttachmentSummary = {
  filename: string;
  status: 'extracted' | 'skipped_size' | 'skipped_type' | 'failed';
  detail?: string;
  extractId?: string;
  confidence?: number;
};

export const POST = async (request: Request) => {
  if (!checkBasicAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = InboundSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const inbound = parsed.data;
  const fromEmail = inbound.From.toLowerCase();

  // Anti-spam: silently 200 unknown senders so spammers can't probe.
  // We log it but never disclose that the address exists.
  if (!senderAllowed(fromEmail)) {
    console.warn(
      `[postmark/inbound] dropped email from non-allowlisted sender: ${fromEmail}`,
    );
    return NextResponse.json({ success: true, dropped: true });
  }

  // Pre-compute deal match from body + subject text. Same matcher is used
  // for every attachment in this email (one email = one likely deal).
  const matchText = `${inbound.Subject}\n${inbound.TextBody}`;
  const postcodes = extractPostcodes(matchText);
  const dealId = await findDealByPostcodes(postcodes);

  const summaries: AttachmentSummary[] = [];
  let extractedCount = 0;

  for (const att of inbound.Attachments) {
    // Skip non-PDFs but note in summary.
    const isPdf =
      att.ContentType === 'application/pdf' ||
      att.Name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      summaries.push({
        filename: att.Name,
        status: 'skipped_type',
        detail: att.ContentType,
      });
      continue;
    }

    if (att.ContentLength > MAX_PDF_BYTES) {
      summaries.push({
        filename: att.Name,
        status: 'skipped_size',
        detail: `${Math.round(att.ContentLength / 1024 / 1024)} MB > 25 MB cap`,
      });
      continue;
    }

    const docType = inferDocType(inbound.Subject, att.Name);

    let extract: ProbateExtract;
    try {
      const buf = Buffer.from(att.Content, 'base64');
      extract = await extractProbateFromPdf({
        pdfBytes: new Uint8Array(buf),
        filename: att.Name,
      });
    } catch (err) {
      summaries.push({
        filename: att.Name,
        status: 'failed',
        detail: (err as Error)?.message?.slice(0, 200) ?? 'pipeline crashed',
      });
      continue;
    }

    try {
      const row = await database.documentExtract.create({
        data: {
          filename: att.Name,
          docType,
          dealId,
          uploadedBy: 'email_forward',
          confidence: extract.confidence,
          deceasedName: extract.deceasedName?.value ?? null,
          primaryAddress: extract.propertyAddresses[0]?.address ?? null,
          errorReason: extract.errorReason ?? null,
          extractJson: JSON.parse(JSON.stringify(extract)),
          sourceType: 'email_forward',
          forwardedFromEmail: fromEmail,
          emailSubject: inbound.Subject.slice(0, 500),
        },
        select: { id: true },
      });
      summaries.push({
        filename: att.Name,
        status: 'extracted',
        extractId: row.id,
        confidence: extract.confidence,
      });
      extractedCount++;
    } catch (err) {
      summaries.push({
        filename: att.Name,
        status: 'failed',
        detail: (err as Error)?.message?.slice(0, 200) ?? 'persist failed',
      });
    }
  }

  // Send the acknowledgement email — best-effort, never block response.
  try {
    await sendEmail({
      to: inbound.ReplyTo ?? fromEmail,
      subject: `Re: ${inbound.Subject || '(no subject)'} — Bellwood docs intake`,
      text: buildAckBody({
        extractedCount,
        summaries,
        dealId,
        postcodesFound: postcodes,
      }),
    });
  } catch (err) {
    console.warn('[postmark/inbound] ack email failed (non-fatal)', err);
  }

  // Create a FounderAction so the inbound shows up in /actions, especially
  // when nothing matched a deal — that's a "needs filing" decision.
  if (summaries.length > 0) {
    try {
      const title = dealId
        ? `Email forward filed: ${extractedCount} doc${extractedCount === 1 ? '' : 's'} on deal`
        : `Email forward needs filing: ${extractedCount} doc${extractedCount === 1 ? '' : 's'}`;
      const dashboardLink = dealId
        ? `/deals/${dealId}`
        : '/documents';
      await database.founderAction.create({
        data: {
          type: 'general',
          priority: dealId ? 'low' : 'medium',
          status: 'pending',
          agent: 'system',
          title,
          description: [
            `From: ${fromEmail}`,
            `Subject: ${inbound.Subject || '(none)'}`,
            `Postcodes in body: ${postcodes.join(', ') || '(none)'}`,
            '',
            ...summaries.map(
              (s) =>
                `· ${s.filename} → ${s.status}${
                  s.confidence !== undefined ? ` (${Math.round(s.confidence * 100)}%)` : ''
                }${s.detail ? ` — ${s.detail}` : ''}`,
            ),
          ].join('\n'),
          // Round-trip via JSON to satisfy Prisma's InputJsonValue at the
          // boundary (TypeScript's strict shapes don't carry an index sig).
          metadata: JSON.parse(
            JSON.stringify({
              link: dashboardLink,
              sourceType: 'email_forward',
              fromEmail,
              emailSubject: inbound.Subject,
              extractIds: summaries
                .map((s) => s.extractId)
                .filter((v): v is string => typeof v === 'string'),
              dealId,
            }),
          ),
        },
      });
    } catch (err) {
      console.warn('[postmark/inbound] FounderAction create failed', err);
    }
  }

  return NextResponse.json({
    success: true,
    fromEmail,
    extractedCount,
    dealMatched: dealId,
    summaries,
  });
};

// ────────────────────────────────────────────────────────────────────────────
// Acknowledgement email body
// ────────────────────────────────────────────────────────────────────────────

function buildAckBody(input: {
  extractedCount: number;
  summaries: AttachmentSummary[];
  dealId: string | null;
  postcodesFound: string[];
}): string {
  const lines: string[] = [`Bellwood docs intake received your forward.`, ''];

  if (input.extractedCount === 0 && input.summaries.length === 0) {
    lines.push('No attachments found. Nothing was filed.');
    return lines.join('\n');
  }

  if (input.extractedCount > 0) {
    lines.push(
      `Filed ${input.extractedCount} document${input.extractedCount === 1 ? '' : 's'}:`,
    );
    for (const s of input.summaries) {
      if (s.status !== 'extracted') continue;
      const conf =
        s.confidence !== undefined ? ` — ${Math.round(s.confidence * 100)}% confidence` : '';
      lines.push(`  · ${s.filename}${conf}`);
    }
    lines.push('');
  }

  const skipped = input.summaries.filter((s) => s.status !== 'extracted');
  if (skipped.length > 0) {
    lines.push(`Skipped ${skipped.length}:`);
    for (const s of skipped) {
      lines.push(`  · ${s.filename} (${s.status}${s.detail ? `: ${s.detail}` : ''})`);
    }
    lines.push('');
  }

  if (input.dealId) {
    lines.push(
      `Linked to active deal — review at https://bellwood-app.vercel.app/deals/${input.dealId}`,
    );
  } else if (input.postcodesFound.length > 0) {
    lines.push(
      `Postcodes found (${input.postcodesFound.join(', ')}) — no active deal matched. File manually at https://bellwood-app.vercel.app/documents`,
    );
  } else {
    lines.push(
      `No postcode found in email body. File manually at https://bellwood-app.vercel.app/documents`,
    );
  }

  lines.push('', 'Bellwoods Lane');
  return lines.join('\n');
}

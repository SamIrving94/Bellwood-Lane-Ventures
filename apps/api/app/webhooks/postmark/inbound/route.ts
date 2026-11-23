import { timingSafeEqual } from 'node:crypto';
import { env } from '@/env';
import { database } from '@repo/database';
import {
  type ProbateExtract,
  extractProbateFromPdf,
} from '@repo/document-pipeline';
import { sendEmail } from '@repo/email';
import { put } from '@repo/storage';
import { NextResponse, after } from 'next/server';
import {
  type AddressBook,
  type DealCandidate,
  type DealLookups,
  InboundSchema,
  type NormalisedEmail,
  type StoredAttachment,
  attachmentBytes,
  compactPostcode,
  directionOf,
  formatPostcode,
  isInlineNoise,
  isPdf,
  looksOurs,
  normaliseInbound,
  parseAllowlist,
  resolveDeal,
  safeFilename,
} from '../_lib/deal-email';
import { digestDealEmail } from '../_lib/digest';

/**
 * POST /webhooks/postmark/inbound
 *
 * The deal email log. Postmark POSTs every email that reaches our inbound
 * address here. Two ways mail arrives, one route:
 *
 *   A. CC THE LOG (the main use). A founder copies the log address on an
 *      email to a seller, solicitor or agent. That copy lands here, and so
 *      does every reply-all after it. Each email is stored on its deal and
 *      shown on the deal page under "Emails".
 *
 *   B. FORWARD A DOCUMENT (the original use). A founder sends a PDF to the
 *      address with nobody else on the email. It is stored the same way,
 *      and the PDF also runs through @repo/document-pipeline into
 *      /documents. Only this flow gets an acknowledgement email: replying
 *      "received your forward" to a seller's reply-all would be absurd.
 *
 * Per email:
 *   1. Basic Auth (credentials set on the Postmark side).
 *   2. Normalise the payload and drop a Message-ID we already hold.
 *   3. Find the deal: its own address → thread → seller/solicitor → postcode.
 *      Exactly one candidate or it stays unfiled. See `resolveDeal`.
 *   4. Drop mail from a non-founder that is not part of a conversation or
 *      deal we know. Silently, so the address cannot be probed.
 *   5. Keep the attachments, store the email.
 *   6. After responding: a two-line read of it (feature `deal_email_digest`).
 *
 * Nothing here sends anything to a seller, and nothing is drafted.
 *
 * Postmark config (one-time, docs/setup/email-forward.md): point the inbound
 * stream webhook at https://bellwood-api.vercel.app/webhooks/postmark/inbound
 * with Basic Auth matching POSTMARK_INBOUND_USER + POSTMARK_INBOUND_PASS.
 */

// The PDF pipeline and the after() digest both need more than the default.
export const maxDuration = 300;

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const CLOSED_STATUSES = ['completed', 'rejected', 'withdrawn'];
const DASHBOARD_URL = 'https://bellwood-app.vercel.app';

// ────────────────────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────────────────────

/** Constant-time comparison: `===` leaks the matching prefix through timing. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function checkBasicAuth(request: Request): boolean {
  const expectedUser = env.POSTMARK_INBOUND_USER;
  const expectedPass = env.POSTMARK_INBOUND_PASS;
  if (!expectedUser || !expectedPass) {
    return false;
  }

  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Basic ')) {
    return false;
  }

  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8');
    const [user, pass] = decoded.split(':', 2);
    // Constant-time, and both halves are always compared so the result does
    // not reveal which one was wrong.
    const userOk = safeEqual(user ?? '', expectedUser);
    const passOk = safeEqual(pass ?? '', expectedPass);
    return userOk && passOk;
  } catch {
    return false;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Deal lookups — the database side of `resolveDeal`
// ────────────────────────────────────────────────────────────────────────────

const DEAL_SELECT = { id: true, postcode: true, status: true } as const;

function toCandidate(deal: {
  id: string;
  postcode: string;
  status: string;
}): DealCandidate {
  return {
    id: deal.id,
    postcode: deal.postcode,
    open: !CLOSED_STATUSES.includes(deal.status),
  };
}

const lookups: DealLookups = {
  async dealById(id) {
    const deal = await database.deal.findUnique({
      where: { id },
      select: DEAL_SELECT,
    });
    return deal ? toCandidate(deal) : null;
  },

  async threadFor(messageIds) {
    const hits = await database.dealEmail.findMany({
      where: {
        OR: [
          { messageId: { in: messageIds } },
          { threadKey: { in: messageIds } },
        ],
      },
      orderBy: { sentAt: 'desc' },
      take: 20,
      select: { threadKey: true, dealId: true },
    });
    // A filed email in the thread beats an unfiled one.
    return hits.find((h) => h.dealId !== null) ?? hits[0] ?? null;
  },

  async dealsByParticipant(emails) {
    const deals = await database.deal.findMany({
      where: {
        OR: emails
          .slice(0, 15)
          .flatMap((email) => [
            { sellerEmail: { equals: email, mode: 'insensitive' as const } },
            { solicitorEmail: { equals: email, mode: 'insensitive' as const } },
          ]),
      },
      select: DEAL_SELECT,
      take: 20,
    });
    return deals.map(toCandidate);
  },

  async dealsByPostcode(postcodes) {
    // Deals store the postcode as typed, so match "M14 5AB" and "M145AB".
    const forms = postcodes
      .slice(0, 10)
      .flatMap((pc) => [formatPostcode(pc), compactPostcode(pc)]);
    const deals = await database.deal.findMany({
      where: {
        OR: forms.map((pc) => ({
          postcode: { equals: pc, mode: 'insensitive' as const },
        })),
      },
      select: DEAL_SELECT,
      take: 20,
    });
    return deals.map(toCandidate);
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

type DocType = 'probate' | 'lease' | 'contract' | 'other';

function inferDocType(subject: string, filename: string): DocType {
  const haystack = `${subject} ${filename}`.toLowerCase();
  if (/\b(probate|grant of|letters of admin|deceased)\b/.test(haystack)) {
    return 'probate';
  }
  if (
    /\b(lease|leasehold|ground rent|service charge|tp1|lpe1)\b/.test(haystack)
  ) {
    return 'lease';
  }
  if (
    /\b(contract|redline|tr1|sale agreement|memorandum|completion statement)\b/.test(
      haystack
    )
  ) {
    return 'contract';
  }
  return 'other';
}

/** What happened to one attachment, for the acknowledgement email. */
type AttachmentSummary = {
  filename: string;
  status: 'extracted' | 'saved' | 'skipped_size' | 'failed';
  detail?: string;
  extractId?: string;
  confidence?: number;
};

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'P2002';
}

// ────────────────────────────────────────────────────────────────────────────
// Turned-away mail
// ────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
/** How long the sender + subject of refused mail stay visible. */
const TURNED_AWAY_KEEP_DAYS = 30;
/** Rows recorded per day. The address can be harvested; spam must not fill the table. */
const TURNED_AWAY_DAILY_CAP = 50;
const ALLOWLIST_CARD_KEY = 'deal_email_allowlist';

/**
 * Note that an email was refused, so the refusal is visible to a founder.
 * The email is NOT kept: sender and subject only, pruned after 30 days.
 *
 * One refusal matters more than the rest: a sender at our own domain. That
 * is a founder address missing from EMAIL_FORWARD_ALLOWLIST, which means
 * every email they copy the log on is refused. It gets one card a week
 * until it is fixed (LEARNINGS: a silent fallback raises exactly one
 * deduped action).
 */
async function recordTurnedAway(
  email: NormalisedEmail,
  book: AddressBook
): Promise<void> {
  const now = Date.now();
  const today = await database.dealEmailDrop.count({
    where: { receivedAt: { gte: new Date(now - DAY_MS) } },
  });
  if (today >= TURNED_AWAY_DAILY_CAP) {
    return;
  }

  const ours = looksOurs(email, book);
  await database.dealEmailDrop.deleteMany({
    where: {
      receivedAt: { lt: new Date(now - TURNED_AWAY_KEEP_DAYS * DAY_MS) },
    },
  });
  await database.dealEmailDrop.create({
    data: {
      fromEmail: email.fromEmail,
      fromName: email.fromName,
      subject: email.subject.slice(0, 160),
      looksOurs: ours,
    },
  });

  if (!ours) {
    return;
  }
  try {
    await database.founderAction.create({
      data: {
        type: 'general',
        priority: 'high',
        status: 'pending',
        agent: 'system',
        title: `Emails from ${email.fromEmail} are not being logged`,
        description: [
          'The email log turned this sender away because the address is not on the founder list.',
          '',
          'If it is one of yours: add it to EMAIL_FORWARD_ALLOWLIST on the bellwood-api project in Vercel, then redeploy. Until then every email it copies the log on is refused.',
          '',
          'If it is not one of yours, dismiss this card.',
        ].join('\n'),
        dedupKey: `${ALLOWLIST_CARD_KEY}:${email.fromEmail}:${Math.floor(now / (7 * DAY_MS))}`,
        metadata: { link: '/deals/email-log', sourceType: 'deal_email' },
      },
    });
  } catch (err) {
    // P2002 = this week's card for this address already exists.
    if (!isUniqueViolation(err)) {
      console.warn('[postmark/inbound] FounderAction create failed', err);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────────────────────

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
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const email = normaliseInbound(payload);
  if (!email) {
    return NextResponse.json({ error: 'No sender address' }, { status: 400 });
  }

  // Threading rests on the Message-ID header. If Postmark ever stops sending
  // it, say so in the logs rather than quietly filing every reply as new.
  if (/^(postmark|nomsgid):/.test(email.messageId)) {
    console.warn(
      '[postmark/inbound] no Message-ID header on this email — replies to it cannot be threaded'
    );
  }

  const book: AddressBook = {
    founders: parseAllowlist(env.EMAIL_FORWARD_ALLOWLIST),
    logAddresses: parseAllowlist(env.DEAL_LOG_ADDRESS),
  };

  // A Postmark retry, or the same email delivered to two of our addresses.
  const already = await database.dealEmail.findUnique({
    where: { messageId: email.messageId },
    select: { id: true },
  });
  if (already) {
    return NextResponse.json({ success: true, duplicate: true });
  }

  const match = await resolveDeal(email, book, lookups);

  // Anti-spam: silently 200 mail we have no reason to keep, so nobody can
  // probe the address. The SENDER never learns anything; a founder can see
  // what was turned away on /deals/email-log.
  if (!match.accepted) {
    console.warn(
      `[postmark/inbound] turned away email from unknown sender: ${email.fromEmail}`
    );
    try {
      await recordTurnedAway(email, book);
    } catch (err) {
      console.warn('[postmark/inbound] could not record turned-away mail', err);
    }
    return NextResponse.json({ success: true, dropped: true });
  }

  const direction = directionOf(email, book);
  const isForward = direction === 'forward';
  const dealId = match.dealId;

  // ── Attachments: keep every real file; read PDFs on a forward ────────────
  const stored: StoredAttachment[] = [];
  const summaries: AttachmentSummary[] = [];
  let extractedCount = 0;

  for (const att of payload.Attachments ?? []) {
    if (isInlineNoise(att)) {
      continue;
    }

    const sizeBytes = attachmentBytes(att);
    const record: StoredAttachment = {
      filename: att.Name,
      contentType: att.ContentType,
      sizeBytes,
    };

    if (sizeBytes > MAX_ATTACHMENT_BYTES) {
      record.skipped = 'too_large';
      stored.push(record);
      summaries.push({
        filename: att.Name,
        status: 'skipped_size',
        detail: `${Math.round(sizeBytes / 1024 / 1024)} MB > 25 MB cap`,
      });
      continue;
    }

    const bytes = Buffer.from(att.Content, 'base64');
    try {
      const blob = await put(
        `deal-emails/${dealId ?? 'unfiled'}/${safeFilename(att.Name)}`,
        bytes,
        { access: 'public', contentType: att.ContentType }
      );
      record.url = blob.url;
    } catch (err) {
      record.skipped = 'store_failed';
      console.warn('[postmark/inbound] attachment store failed', err);
    }

    // The PDF reader is tuned for probate grants and costs a model call per
    // file. It runs on a deliberate forward, not on every letter a solicitor
    // attaches to a conversation.
    if (!(isForward && isPdf(att))) {
      summaries.push({
        filename: att.Name,
        status: record.url ? 'saved' : 'failed',
        detail: record.url ? undefined : 'could not be stored',
      });
      stored.push(record);
      continue;
    }

    let extract: ProbateExtract;
    try {
      extract = await extractProbateFromPdf({
        pdfBytes: new Uint8Array(bytes),
        filename: att.Name,
      });
    } catch (err) {
      summaries.push({
        filename: att.Name,
        status: 'failed',
        detail: (err as Error)?.message?.slice(0, 200) ?? 'pipeline crashed',
      });
      stored.push(record);
      continue;
    }

    try {
      const row = await database.documentExtract.create({
        data: {
          filename: att.Name,
          docType: inferDocType(email.subject, att.Name),
          dealId,
          uploadedBy: 'email_forward',
          confidence: extract.confidence,
          deceasedName: extract.deceasedName?.value ?? null,
          primaryAddress: extract.propertyAddresses[0]?.address ?? null,
          errorReason: extract.errorReason ?? null,
          extractJson: JSON.parse(JSON.stringify(extract)),
          sourceType: 'email_forward',
          forwardedFromEmail: email.fromEmail,
          emailSubject: email.subject,
        },
        select: { id: true },
      });
      record.extractId = row.id;
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
    stored.push(record);
  }

  // ── Store the email. A failure here is a 500 on purpose: Postmark retries,
  // and a retried email is better than a lost one. ───────────────────────────
  let emailId: string;
  try {
    const row = await database.dealEmail.create({
      data: {
        dealId,
        messageId: email.messageId,
        inReplyTo: email.inReplyTo,
        references: email.references,
        threadKey: match.threadKey,
        direction,
        fromEmail: email.fromEmail,
        fromName: email.fromName,
        toEmails: email.toEmails,
        ccEmails: email.ccEmails,
        subject: email.subject,
        bodyText: email.bodyText,
        replyText: email.replyText,
        sentAt: email.sentAt,
        matchedBy: match.matchedBy,
        attachments: JSON.parse(JSON.stringify(stored)),
      },
      select: { id: true },
    });
    emailId = row.id;
  } catch (err) {
    // Two copies of one email raced past the check above. The other won.
    if (isUniqueViolation(err)) {
      return NextResponse.json({ success: true, duplicate: true });
    }
    throw err;
  }

  const unfiledKey = `deal_email_unfiled:${match.threadKey}`;

  if (dealId) {
    // This email settled the deal for its thread: earlier emails in it that
    // were waiting to be filed follow, and their "needs a deal" card closes.
    try {
      const moved = await database.dealEmail.updateMany({
        where: { threadKey: match.threadKey, dealId: null },
        data: { dealId, matchedBy: 'thread' },
      });
      if (moved.count > 0) {
        await database.founderAction.updateMany({
          where: { dedupKey: unfiledKey, status: 'pending' },
          data: { status: 'completed', resolvedAt: new Date() },
        });
      }
    } catch (err) {
      console.warn('[postmark/inbound] thread back-fill failed', err);
    }
  } else {
    // No deal: one card per conversation asking a person to place it.
    try {
      await database.founderAction.create({
        data: {
          type: 'general',
          priority: 'medium',
          status: 'pending',
          agent: 'system',
          title: `Email needs a deal: ${email.subject || '(no subject)'}`.slice(
            0,
            200
          ),
          description: [
            `From: ${email.fromName ? `${email.fromName} ` : ''}<${email.fromEmail}>`,
            `Postcodes in the email: ${email.postcodes.join(', ') || '(none)'}`,
            '',
            'No single deal matched, so it was not filed. Pick the deal and the whole conversation follows.',
          ].join('\n'),
          dedupKey: unfiledKey,
          metadata: {
            link: '/deals/email-log',
            sourceType: 'deal_email',
            emailId,
          },
        },
      });
    } catch (err) {
      // P2002 = this conversation already has its card. Anything else: log.
      if (!isUniqueViolation(err)) {
        console.warn('[postmark/inbound] FounderAction create failed', err);
      }
    }
  }

  if (isForward) {
    // Acknowledge a deliberate forward — best-effort, never blocks.
    try {
      await sendEmail({
        to: payload.ReplyTo?.trim() || email.fromEmail,
        subject: `Re: ${email.subject || '(no subject)'} — Kept docs intake`,
        text: buildAckBody({
          summaries,
          dealId,
          postcodesFound: email.postcodes,
        }),
      });
    } catch (err) {
      console.warn('[postmark/inbound] ack email failed (non-fatal)', err);
    }

    // A document read onto a deal is worth a glance; an unfiled one already
    // has its card above.
    if (dealId && extractedCount > 0) {
      try {
        await database.founderAction.create({
          data: {
            type: 'general',
            priority: 'low',
            status: 'pending',
            agent: 'system',
            dealId,
            title: `Email forward filed: ${extractedCount} doc${extractedCount === 1 ? '' : 's'} on deal`,
            description: [
              `From: ${email.fromEmail}`,
              `Subject: ${email.subject || '(none)'}`,
              '',
              ...summaries.map(
                (s) =>
                  `· ${s.filename} → ${s.status}${
                    s.confidence !== undefined
                      ? ` (${Math.round(s.confidence * 100)}%)`
                      : ''
                  }${s.detail ? ` — ${s.detail}` : ''}`
              ),
            ].join('\n'),
            metadata: {
              link: `/deals/${dealId}`,
              sourceType: 'email_forward',
              fromEmail: email.fromEmail,
              emailSubject: email.subject,
              extractIds: summaries
                .map((s) => s.extractId)
                .filter((v): v is string => typeof v === 'string'),
              dealId,
            },
          },
        });
      } catch (err) {
        console.warn('[postmark/inbound] FounderAction create failed', err);
      }
    }
  }

  // The read happens after Postmark has its 200: a slow model must never
  // make Postmark retry an email we already hold.
  after(async () => {
    // A founder's email got through, so any "your emails are not being
    // logged" card for this address is answered.
    if (book.founders.has(email.fromEmail)) {
      try {
        await database.founderAction.updateMany({
          where: {
            dedupKey: {
              startsWith: `${ALLOWLIST_CARD_KEY}:${email.fromEmail}:`,
            },
            status: 'pending',
          },
          data: { status: 'completed', resolvedAt: new Date() },
        });
      } catch (err) {
        console.warn('[postmark/inbound] allowlist card close failed', err);
      }
    }

    try {
      const deal = dealId
        ? await database.deal.findUnique({
            where: { id: dealId },
            select: { address: true, postcode: true },
          })
        : null;
      const digest = await digestDealEmail({
        direction,
        fromName: email.fromName,
        fromEmail: email.fromEmail,
        subject: email.subject,
        body: email.replyText ?? email.bodyText,
        dealAddress: deal ? `${deal.address}, ${deal.postcode}` : null,
      });
      if (digest) {
        await database.dealEmail.update({
          where: { id: emailId },
          data: digest,
        });
      }
    } catch (err) {
      console.warn('[postmark/inbound] digest failed (non-fatal)', err);
    }
  });

  return NextResponse.json({
    success: true,
    emailId,
    direction,
    dealMatched: dealId,
    matchedBy: match.matchedBy,
    attachments: stored.length,
    extractedCount,
  });
};

// ────────────────────────────────────────────────────────────────────────────
// Acknowledgement email body (forward flow only)
// ────────────────────────────────────────────────────────────────────────────

function buildAckBody(input: {
  summaries: AttachmentSummary[];
  dealId: string | null;
  postcodesFound: string[];
}): string {
  const lines: string[] = ['Kept docs intake received your forward.', ''];

  const extracted = input.summaries.filter((s) => s.status === 'extracted');
  const saved = input.summaries.filter((s) => s.status === 'saved');
  const problems = input.summaries.filter(
    (s) => s.status === 'skipped_size' || s.status === 'failed'
  );

  if (input.summaries.length === 0) {
    lines.push('No attachments found. The email itself was logged.', '');
  }

  if (extracted.length > 0) {
    lines.push(
      `Read ${extracted.length} document${extracted.length === 1 ? '' : 's'}:`
    );
    for (const s of extracted) {
      const conf =
        s.confidence !== undefined
          ? ` — ${Math.round(s.confidence * 100)}% confidence`
          : '';
      lines.push(`  · ${s.filename}${conf}`);
    }
    lines.push('');
  }

  if (saved.length > 0) {
    lines.push(`Saved ${saved.length} file${saved.length === 1 ? '' : 's'}:`);
    for (const s of saved) {
      lines.push(`  · ${s.filename}`);
    }
    lines.push('');
  }

  if (problems.length > 0) {
    lines.push(`Not kept (${problems.length}):`);
    for (const s of problems) {
      lines.push(
        `  · ${s.filename} (${s.status}${s.detail ? `: ${s.detail}` : ''})`
      );
    }
    lines.push('');
  }

  if (input.dealId) {
    lines.push(`Filed on the deal — ${DASHBOARD_URL}/deals/${input.dealId}`);
  } else if (input.postcodesFound.length > 0) {
    lines.push(
      `Postcodes found (${input.postcodesFound.join(', ')}) but no single deal matched. Pick the deal at ${DASHBOARD_URL}/deals/email-log`
    );
  } else {
    lines.push(
      `No postcode in the email. Pick the deal at ${DASHBOARD_URL}/deals/email-log`
    );
  }

  lines.push('', 'Kept');
  return lines.join('\n');
}

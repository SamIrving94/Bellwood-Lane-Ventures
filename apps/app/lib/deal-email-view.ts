/**
 * Display shaping for the deal email log. Pure: no database or env imports,
 * so it is unit-tested (deal-email-view.test.ts). The loaders that feed it
 * are in ./deal-emails.
 */

export type EmailAttachment = {
  filename: string;
  contentType: string;
  sizeBytes: number;
  url?: string;
  skipped?: string;
  extractId?: string;
};

export type EmailCardData = {
  id: string;
  dealId: string | null;
  threadKey: string;
  direction: string;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  /** The new part of the email when Postmark could isolate it. */
  replyText: string | null;
  bodyText: string;
  sentAt: string;
  matchedBy: string | null;
  summary: string | null;
  party: string | null;
  nextStep: string | null;
  /** They asked us something and no later email from us is in the thread. */
  waitingOnUs: boolean;
  attachments: EmailAttachment[];
};

/** Longest body sent to the browser. The mailbox still has the rest. */
const DISPLAY_BODY_CHARS = 20_000;

/** The columns of a DealEmail row this file reads. */
export type EmailRow = {
  id: string;
  dealId: string | null;
  threadKey: string;
  direction: string;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  bodyText: string;
  replyText: string | null;
  sentAt: Date;
  matchedBy: string | null;
  summary: string | null;
  party: string | null;
  needsReply: boolean | null;
  nextStep: string | null;
  attachments: unknown;
};

function trimBody(text: string): string {
  return text.length > DISPLAY_BODY_CHARS
    ? `${text.slice(0, DISPLAY_BODY_CHARS)}\n\n[Long email trimmed here. The full text is in your mailbox.]`
    : text;
}

function readAttachments(raw: unknown): EmailAttachment[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (a): a is EmailAttachment =>
      typeof a === 'object' &&
      a !== null &&
      typeof (a as EmailAttachment).filename === 'string'
  );
}

/**
 * Shape rows for display. `waitingOnUs` is worked out across the rows given,
 * so pass whole threads where you can: a question is no longer open once a
 * later email from us sits in the same thread.
 */
export function toEmailCards(rows: EmailRow[]): EmailCardData[] {
  const lastOutbound = new Map<string, number>();
  for (const r of rows) {
    if (r.direction !== 'outbound') {
      continue;
    }
    const at = r.sentAt.getTime();
    if (at > (lastOutbound.get(r.threadKey) ?? 0)) {
      lastOutbound.set(r.threadKey, at);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    dealId: r.dealId,
    threadKey: r.threadKey,
    direction: r.direction,
    fromEmail: r.fromEmail,
    fromName: r.fromName,
    toEmails: r.toEmails,
    ccEmails: r.ccEmails,
    subject: r.subject,
    replyText: r.replyText ? trimBody(r.replyText) : null,
    bodyText: trimBody(r.bodyText),
    sentAt: r.sentAt.toISOString(),
    matchedBy: r.matchedBy,
    summary: r.summary,
    party: r.party,
    nextStep: r.nextStep,
    waitingOnUs:
      r.direction !== 'outbound' &&
      r.needsReply === true &&
      r.sentAt.getTime() > (lastOutbound.get(r.threadKey) ?? 0),
    attachments: readAttachments(r.attachments),
  }));
}

/**
 * A deal's own address: `log+<dealId>@…`. Mail to it is filed on that deal
 * with no matching at all. For the email that names no postcode and goes to
 * someone who is not on the deal yet.
 */
export function dealLogAddress(base: string, dealId: string): string {
  const at = base.lastIndexOf('@');
  const local = base.slice(0, at).replace(/\+.*$/, '');
  return `${local}+${dealId}${base.slice(at)}`;
}

/**
 * Display shaping for the deal email log. Pure: no database or env imports,
 * so it is unit-tested (deal-email-view.test.ts). The loaders that feed it
 * are in ./deal-emails; the importer that fills the table is
 * `importDealMail` in @repo/google.
 */

export type EmailAttachment = {
  filename: string;
  contentType: string;
  sizeBytes: number;
};

export type EmailCardData = {
  id: string;
  dealId: string | null;
  gmailThreadId: string;
  threadKey: string;
  direction: string;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  /** The new part of the email when the importer could isolate it. */
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

/** Longest body sent to the browser. Gmail still has the rest. */
const DISPLAY_BODY_CHARS = 20_000;

/** The columns of a DealEmail row this file reads. */
export type EmailRow = {
  id: string;
  dealId: string | null;
  gmailThreadId: string;
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
    ? `${text.slice(0, DISPLAY_BODY_CHARS)}\n\n[Long email trimmed here. Open it in Gmail for the rest.]`
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
    gmailThreadId: r.gmailThreadId,
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

// ───────────────────────────────────────────────────────────────────────────
// Links into Gmail
// ───────────────────────────────────────────────────────────────────────────

// Every Gmail link names the account (`authuser`). With a personal Gmail
// signed in beside the Kept mailbox, Gmail would otherwise open whichever is
// first, and a seller would get an email from the wrong address. The account
// is the one connected in Settings → Google, so there is nothing to guess.
// Not yet checked in a real browser.
const GMAIL = 'https://mail.google.com/mail/';

/**
 * A Gmail compose window with the recipient and subject filled in. A draft
 * only: a person writes it and sends it. There is no address to copy in:
 * the email log reads the mailbox, so the sent email is picked up from
 * there.
 */
export function gmailComposeUrl(input: {
  to: string;
  subject: string;
  account: string | null;
}): string {
  const params = new URLSearchParams();
  if (input.account) {
    params.set('authuser', input.account);
  }
  params.set('view', 'cm');
  params.set('fs', '1');
  params.set('to', input.to);
  params.set('su', input.subject);
  return `${GMAIL}?${params.toString()}`;
}

/** The same email as a `mailto:` link, for a phone or another mail app. */
export function mailtoUrl(input: { to: string; subject: string }): string {
  const to = encodeURIComponent(input.to).replace(/%40/g, '@');
  return `mailto:${to}?subject=${encodeURIComponent(input.subject)}`;
}

/** Open a logged conversation in Gmail, where its attachments are. */
export function gmailThreadUrl(
  gmailThreadId: string,
  account: string | null
): string {
  const query = account ? `?authuser=${encodeURIComponent(account)}` : '';
  return `${GMAIL}${query}#all/${encodeURIComponent(gmailThreadId)}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Is the importer alive?
// ───────────────────────────────────────────────────────────────────────────

export type SyncHealth = 'never' | 'ok' | 'stale';

/**
 * The google-sync cron runs every 30 minutes. Two hours without a run means
 * it has stopped, and "0 emails kept" then says nothing about the mailbox.
 */
export function syncHealth(
  lastRunAt: string | null,
  now: Date = new Date()
): SyncHealth {
  if (!lastRunAt) {
    return 'never';
  }
  const at = new Date(lastRunAt).getTime();
  if (Number.isNaN(at)) {
    return 'never';
  }
  return now.getTime() - at > 2 * 60 * 60 * 1000 ? 'stale' : 'ok';
}

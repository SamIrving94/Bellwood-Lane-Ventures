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

// ───────────────────────────────────────────────────────────────────────────
// Starting an email from the deal page
// ───────────────────────────────────────────────────────────────────────────

export type ComposeInput = {
  to: string;
  /** The deal's own log address, so the email files itself with no matching. */
  cc: string;
  subject: string;
};

/**
 * A Gmail compose window with To, CC and subject filled in. The founders are
 * on Google Workspace, so this is the main button.
 *
 * `account` picks WHICH signed-in Google account composes (`authuser`). It
 * matters: with a personal Gmail signed in beside the company mailbox, Gmail
 * would otherwise open whichever is first, and a seller would get an email
 * from the wrong address. Leave it out when we cannot tell.
 */
export function gmailComposeUrl(
  input: ComposeInput & { account?: string | null }
): string {
  // URLSearchParams writes "+" as %2B, which the tagged CC address needs: a
  // bare "+" in a query string means a space.
  const params = new URLSearchParams({ view: 'cm', fs: '1' });
  if (input.account) {
    params.set('authuser', input.account);
  }
  params.set('to', input.to);
  params.set('cc', input.cc);
  params.set('su', input.subject);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

/** The same email as a `mailto:` link, for a phone or another mail app. */
export function mailtoUrl(input: ComposeInput): string {
  const to = encodeURIComponent(input.to).replace(/%40/g, '@');
  return `mailto:${to}?cc=${encodeURIComponent(input.cc)}&subject=${encodeURIComponent(input.subject)}`;
}

/**
 * Which of a founder's own addresses is the company one: the address at the
 * domain the log address hangs off (`log@in.wearekept.co.uk` ←
 * `sam@wearekept.co.uk`). Null when none is, and then we do not guess.
 * The same direct-parent rule as `looksOurs` in the webhook.
 */
export function companyAccount(
  emails: string[],
  logAddress: string
): string | null {
  const logDomain = logAddress.slice(logAddress.lastIndexOf('@') + 1);
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    const domain = email.slice(email.lastIndexOf('@') + 1);
    if (!domain.includes('.')) {
      continue;
    }
    const isParent =
      logDomain.endsWith(`.${domain}`) &&
      logDomain.split('.').length === domain.split('.').length + 1;
    if (domain === logDomain || isParent) {
      return email;
    }
  }
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// The automatic copy (Google Workspace → log address)
// ───────────────────────────────────────────────────────────────────────────

export type AutoCopyStatus = {
  lastSeenAt: Date;
  /** No copied email for over a day. A mailbox is rarely that quiet. */
  quiet: boolean;
};

/**
 * Read the webhook's "last mailbox copy seen" mark (Setting
 * `deal_email_auto_copy`). Null when the automatic copy has never delivered
 * anything, which is also what it looks like when it is not switched on.
 */
export function autoCopyStatus(
  value: unknown,
  now: Date = new Date()
): AutoCopyStatus | null {
  const raw = (value as { lastSeenAt?: unknown } | null)?.lastSeenAt;
  if (typeof raw !== 'string') {
    return null;
  }
  const lastSeenAt = new Date(raw);
  if (Number.isNaN(lastSeenAt.getTime())) {
    return null;
  }
  return {
    lastSeenAt,
    quiet: now.getTime() - lastSeenAt.getTime() > 24 * 60 * 60 * 1000,
  };
}

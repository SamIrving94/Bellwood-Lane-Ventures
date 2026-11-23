/**
 * The deal email log — pure logic.
 *
 * A founder CCs the log address on an email. Postmark POSTs a copy to
 * /webhooks/postmark/inbound, and every reply-all after that arrives the
 * same way. This file turns that payload into one normalised email and
 * decides which deal it belongs to. It has no database or network imports,
 * so every rule below is unit-tested (apps/api/__tests__/deal-email.test.ts).
 *
 * Two rules shape everything here:
 *
 *  - NEVER GUESS THE DEAL. A match must be the only candidate. Two deals in
 *    one postcode, or a solicitor acting on two of our purchases, leaves the
 *    email unfiled for a person to place. Putting a seller's email on
 *    someone else's deal is a privacy problem, not a tidy-up.
 *
 *  - MAIL FROM A STRANGER MUST EARN ITS PLACE. The log address ends up in
 *    other people's inboxes the moment it is CC'd. A sender who is not a
 *    founder is only accepted when the email continues a thread we hold,
 *    carries a real deal's own address, or comes from a deal's seller or
 *    solicitor. Anything else is dropped, as before.
 *
 * The payload field names come from Postmark's own SDK types
 * (`InboundWebhook` in postmark@5.1.1), not from memory. Every field beyond
 * the original four is optional so an absent one degrades the matching
 * rather than rejecting the email.
 */

import { z } from 'zod';

// ───────────────────────────────────────────────────────────────────────────
// Payload
// ───────────────────────────────────────────────────────────────────────────

const RecipientSchema = z.object({
  Email: z.string().nullish(),
  Name: z.string().nullish(),
  MailboxHash: z.string().nullish(),
});

export const AttachmentSchema = z.object({
  Name: z.string(),
  ContentType: z.string(),
  Content: z.string(), // base64
  // Optional in Postmark's SDK types; derived from the base64 when absent.
  ContentLength: z.number().int().nonnegative().nullish(),
  // Set on images embedded in the body (signature logos, pasted photos).
  ContentID: z.string().nullish(),
});

export const InboundSchema = z.object({
  From: z.string(),
  FromName: z.string().nullish(),
  FromFull: RecipientSchema.nullish(),
  To: z.string().nullish(),
  ToFull: z.array(RecipientSchema).nullish(),
  Cc: z.string().nullish(),
  CcFull: z.array(RecipientSchema).nullish(),
  Bcc: z.string().nullish(),
  BccFull: z.array(RecipientSchema).nullish(),
  ReplyTo: z.string().nullish(),
  OriginalRecipient: z.string().nullish(),
  Subject: z.string().nullish(),
  Date: z.string().nullish(),
  MailboxHash: z.string().nullish(),
  MessageID: z.string().nullish(), // Postmark's own id, NOT the RFC header
  TextBody: z.string().nullish(),
  HtmlBody: z.string().nullish(),
  StrippedTextReply: z.string().nullish(),
  Headers: z
    .array(z.object({ Name: z.string(), Value: z.string().nullish() }))
    .nullish(),
  Attachments: z.array(AttachmentSchema).nullish(),
});

export type InboundPayload = z.infer<typeof InboundSchema>;
export type InboundAttachment = z.infer<typeof AttachmentSchema>;

// ───────────────────────────────────────────────────────────────────────────
// Normalised email
// ───────────────────────────────────────────────────────────────────────────

export type EmailDirection = 'inbound' | 'outbound' | 'forward';

export type NormalisedEmail = {
  /** RFC Message-ID without angle brackets, or `postmark:<id>` as a fallback. */
  messageId: string;
  inReplyTo: string | null;
  /** Ancestors, oldest first, as the References header lists them. */
  references: string[];
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  /** The address Postmark received this copy at. */
  originalRecipient: string | null;
  subject: string;
  bodyText: string;
  replyText: string | null;
  sentAt: Date;
  /** The `+tag` on our address, when it looks like a deal id. */
  dealTag: string | null;
  /** Full UK postcodes found in the subject and body, as "M14 5AB". */
  postcodes: string[];
};

/** Longest body we keep. A long legal thread fits; a pasted novel does not. */
export const MAX_BODY_CHARS = 100_000;

const EMAIL_RE = /[A-Z0-9._%+'-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/gi;
// Deal ids are cuids: lowercase letters and digits. The length window keeps
// an ordinary plus-tag ("+newsletter") from being looked up as a deal.
const DEAL_TAG_RE = /^[a-z0-9]{20,36}$/;

export function normaliseAddress(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

/** Every email address in a header-style string, lowercased, in order. */
export function parseAddressList(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }
  return unique((raw.match(EMAIL_RE) ?? []).map(normaliseAddress));
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/** `<abc@mail.example>` → `abc@mail.example`. Case is kept: ids are opaque. */
export function cleanMessageId(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const inner = raw.match(/<([^<>\s]+)>/);
  const id = (inner ? inner[1] : raw).trim();
  return id.length > 0 ? id : null;
}

/** The ids in a References header, oldest first. */
export function parseReferences(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }
  const bracketed = raw.match(/<[^<>\s]+>/g);
  const tokens = bracketed ?? raw.split(/[\s,]+/);
  return unique(
    tokens.map((t) => cleanMessageId(t)).filter((t): t is string => t !== null)
  );
}

export function headerValue(
  headers: InboundPayload['Headers'],
  name: string
): string | null {
  const wanted = name.toLowerCase();
  for (const h of headers ?? []) {
    if (h.Name.toLowerCase() === wanted && h.Value) {
      return h.Value;
    }
  }
  return null;
}

/** "m145ab" / "M14  5AB" → "M14 5AB". */
export function formatPostcode(raw: string): string {
  const compact = raw.toUpperCase().replace(/\s+/g, '');
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function compactPostcode(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '');
}

/** Full postcodes only. An outward code alone ("M14") names a district, not a home. */
export function extractPostcodes(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(POSTCODE_RE)) {
    found.push(formatPostcode(`${m[1]}${m[2]}`));
  }
  return unique(found);
}

/** Plain text from an HTML-only email. Good enough to read and to search. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function recipientEmails(
  full: InboundPayload['ToFull'],
  fallback: string | null | undefined
): string[] {
  const fromFull = (full ?? [])
    .map((r) => normaliseAddress(r.Email))
    .filter((e) => e.length > 0);
  return fromFull.length > 0 ? unique(fromFull) : parseAddressList(fallback);
}

function findDealTag(payload: InboundPayload): string | null {
  const hashes = [
    payload.MailboxHash,
    ...(payload.ToFull ?? []).map((r) => r.MailboxHash),
    ...(payload.CcFull ?? []).map((r) => r.MailboxHash),
    ...(payload.BccFull ?? []).map((r) => r.MailboxHash),
    // Last resort: read the +tag off the address Postmark received it at.
    payload.OriginalRecipient?.match(/\+([^@]+)@/)?.[1],
  ];
  for (const h of hashes) {
    const tag = (h ?? '').trim().toLowerCase();
    if (DEAL_TAG_RE.test(tag)) {
      return tag;
    }
  }
  return null;
}

function parseDate(raw: string | null | undefined, now: Date): Date {
  if (!raw) {
    return now;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return now;
  }
  // A clock set in the future must not pin an email to the top of a deal.
  return parsed.getTime() > now.getTime() ? now : parsed;
}

/**
 * Turn Postmark's payload into one email. Null when there is no usable
 * sender address, which is the only thing we cannot do without.
 */
export function normaliseInbound(
  payload: InboundPayload,
  now: Date = new Date()
): NormalisedEmail | null {
  const fromEmail =
    normaliseAddress(payload.FromFull?.Email) ||
    parseAddressList(payload.From)[0] ||
    '';
  if (!fromEmail) {
    return null;
  }

  const headers = payload.Headers;
  const rfcId = cleanMessageId(headerValue(headers, 'Message-ID'));
  const postmarkId = (payload.MessageID ?? '').trim();
  // No id at all: fall back to something stable for THIS delivery, so a
  // Postmark retry of it still collapses to one row.
  const messageId =
    rfcId ??
    (postmarkId
      ? `postmark:${postmarkId}`
      : `nomsgid:${fromEmail}:${payload.Date ?? ''}:${payload.Subject ?? ''}`);

  const subject = (payload.Subject ?? '').trim();
  const text = (payload.TextBody ?? '').trim();
  const body = text.length > 0 ? text : htmlToText(payload.HtmlBody ?? '');
  const reply = (payload.StrippedTextReply ?? '').trim();

  return {
    messageId,
    inReplyTo: cleanMessageId(headerValue(headers, 'In-Reply-To')),
    references: parseReferences(headerValue(headers, 'References')),
    fromEmail,
    fromName: (payload.FromFull?.Name ?? payload.FromName ?? '').trim() || null,
    toEmails: recipientEmails(payload.ToFull, payload.To),
    ccEmails: recipientEmails(payload.CcFull, payload.Cc),
    originalRecipient: normaliseAddress(payload.OriginalRecipient) || null,
    subject: subject.slice(0, 500),
    bodyText: body.slice(0, MAX_BODY_CHARS),
    replyText: reply.length > 0 ? reply.slice(0, MAX_BODY_CHARS) : null,
    sentAt: parseDate(payload.Date, now),
    dealTag: findDealTag(payload),
    postcodes: extractPostcodes(`${subject}\n${body}`),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Whose address is whose
// ───────────────────────────────────────────────────────────────────────────

/** The comma-separated founder allowlist (EMAIL_FORWARD_ALLOWLIST) as a set. */
export function parseAllowlist(raw: string | null | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map(normaliseAddress)
      .filter((s) => s.length > 0)
  );
}

function domainOf(address: string): string {
  return address.slice(address.lastIndexOf('@') + 1);
}

/** `log+abc123@in.example.co.uk` → `log@in.example.co.uk`. */
function stripTag(address: string): string {
  return address.replace(/\+[^@]*@/, '@');
}

export type AddressBook = {
  /** Founders: mail FROM these is ours. */
  founders: Set<string>;
  /** Our inbound addresses (DEAL_LOG_ADDRESS), tag stripped. */
  logAddresses: Set<string>;
};

/**
 * Is this one of OUR addresses (a founder, or the log inbox)? Used to find
 * the other side of a conversation, so it errs toward "ours": anything at
 * the domain Postmark received this copy on counts.
 */
export function isOwnAddress(
  address: string,
  email: Pick<NormalisedEmail, 'originalRecipient'>,
  book: AddressBook
): boolean {
  const a = normaliseAddress(address);
  if (book.founders.has(a)) {
    return true;
  }
  if (book.logAddresses.has(stripTag(a))) {
    return true;
  }
  const received = email.originalRecipient;
  return received !== null && domainOf(a) === domainOf(received);
}

/**
 * Is this address at the domain our log address hangs off? Mail received at
 * `log@in.wearekept.co.uk` puts `someone@wearekept.co.uk` at our own domain.
 *
 * Postmark's own `…@inbound.postmarkapp.com` address says nothing about OUR
 * domain, so it is never used as evidence.
 */
function isOurDomain(
  address: string,
  email: Pick<NormalisedEmail, 'originalRecipient'>,
  book: AddressBook
): boolean {
  const domain = domainOf(normaliseAddress(address));
  if (!domain.includes('.')) {
    return false;
  }
  const received = [
    ...book.logAddresses,
    ...(email.originalRecipient ? [email.originalRecipient] : []),
  ]
    .map(domainOf)
    .filter((d) => !d.endsWith('postmarkapp.com'));
  // The same domain, or its direct parent: `in.wearekept.co.uk` ←
  // `wearekept.co.uk`. Not any suffix, or `co.uk` would count as ours.
  const labels = domain.split('.').length;
  return received.some(
    (d) =>
      d === domain ||
      (d.endsWith(`.${domain}`) && d.split('.').length === labels + 1)
  );
}

/**
 * Is the SENDER at our own domain? When such a sender is not on the founder
 * list it is almost always a founder address missing from the allowlist, and
 * that failure is total and silent: every email they copy the log on is
 * refused. The webhook raises a card for it.
 */
export function looksOurs(
  email: Pick<NormalisedEmail, 'fromEmail' | 'originalRecipient'>,
  book: AddressBook
): boolean {
  return isOurDomain(email.fromEmail, email, book);
}

/**
 * Did someone put the log address on this email (To or CC), or did a copy
 * simply arrive? The difference matters once Google Workspace copies the
 * whole mailbox to the log: a deliberate CC is always worth keeping, a
 * mailbox copy only when it is deal mail. See `resolveDeal`.
 *
 * A BCC looks exactly like a mailbox copy (the address is on the envelope,
 * not in the headers), so it is treated as one.
 *
 * When we have no way to recognise our own address (no DEAL_LOG_ADDRESS, and
 * the copy came in on Postmark's hash address) this answers TRUE. Getting it
 * wrong that way costs a visible "needs a deal" card; the other way would
 * silently lose a deliberate CC.
 */
export function addressedToLog(
  email: Pick<NormalisedEmail, 'toEmails' | 'ccEmails' | 'originalRecipient'>,
  book: AddressBook
): boolean {
  const received = email.originalRecipient;
  const receivedDomain =
    received && !received.endsWith('postmarkapp.com')
      ? domainOf(received)
      : null;
  if (book.logAddresses.size === 0 && receivedDomain === null) {
    return true;
  }
  return [...email.toEmails, ...email.ccEmails].some(
    (a) =>
      book.logAddresses.has(stripTag(a)) ||
      (receivedDomain !== null && domainOf(a) === receivedDomain)
  );
}

/** Everyone on the email who is not us, sender first. */
export function otherParties(
  email: NormalisedEmail,
  book: AddressBook
): string[] {
  return unique(
    [email.fromEmail, ...email.toEmails, ...email.ccEmails].filter(
      (a) => !isOwnAddress(a, email, book)
    )
  );
}

/**
 * - `forward`: a founder sent it to the log and nobody else. The old "send a
 *   PDF to docs@" flow: gets an acknowledgement and PDF extraction.
 * - `outbound`: a founder wrote to someone and copied the log.
 * - `inbound`: anyone else.
 */
/**
 * Everyone on the email from OUTSIDE the company: `otherParties` minus
 * anyone at our own domain. A colleague who is not on the founder list is
 * still not the other side of a deal.
 */
export function outsideParties(
  email: NormalisedEmail,
  book: AddressBook
): string[] {
  return otherParties(email, book).filter((a) => !isOurDomain(a, email, book));
}

export function directionOf(
  email: NormalisedEmail,
  book: AddressBook
): EmailDirection {
  if (!book.founders.has(email.fromEmail)) {
    return 'inbound';
  }
  return otherParties(email, book).length === 0 ? 'forward' : 'outbound';
}

// ───────────────────────────────────────────────────────────────────────────
// Which deal
// ───────────────────────────────────────────────────────────────────────────

export type DealCandidate = {
  id: string;
  postcode: string;
  /** False once a deal is completed, rejected or withdrawn. */
  open: boolean;
};

export type KnownThread = { threadKey: string; dealId: string | null };

/** The database questions the matcher asks, so tests can answer them. */
export type DealLookups = {
  dealById(id: string): Promise<DealCandidate | null>;
  /** A stored email that this one replies to, or that shares its root. */
  threadFor(messageIds: string[]): Promise<KnownThread | null>;
  /** Deals whose seller or solicitor email is one of these. */
  dealsByParticipant(emails: string[]): Promise<DealCandidate[]>;
  /** Deals at exactly one of these full postcodes. */
  dealsByPostcode(postcodes: string[]): Promise<DealCandidate[]>;
};

export type MatchedBy = 'deal_tag' | 'thread' | 'participant' | 'postcode';

export type DealMatch = {
  dealId: string | null;
  matchedBy: MatchedBy | null;
  threadKey: string;
  /**
   * Whether to keep the email at all. For an email addressed to the log:
   * always true for a founder; for anyone else only when it continues a
   * thread we hold, carries a real deal's own address, or the SENDER is a
   * deal's seller or solicitor. For a mailbox copy (automatic copy on): only
   * when it is deal mail.
   */
  accepted: boolean;
  /**
   * True when the email was addressed to the log (To, CC, or a deal's own
   * address). False for a mailbox copy. A refused explicit email is worth
   * showing a founder; a mailbox copy that is not deal mail is nobody's
   * business and leaves no trace.
   */
  explicit: boolean;
};

export type ResolveOptions = {
  /**
   * Google Workspace is copying the founders' mailbox to the log
   * (DEAL_LOG_AUTO_COPY=on). Off by default: without it every email counts
   * as addressed to the log, which is how the log behaved before.
   */
  autoCopy?: boolean;
};

/**
 * One deal from a set of candidates, or null. Narrowing order: the only
 * candidate → the only open one → the only one whose postcode is in the
 * email. Still more than one after that is ambiguous, and ambiguous is null.
 */
export function pickOne(
  candidates: DealCandidate[],
  postcodes: string[]
): DealCandidate | null {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const all = Array.from(byId.values());
  if (all.length <= 1) {
    return all[0] ?? null;
  }

  const open = all.filter((c) => c.open);
  if (open.length === 1) {
    return open[0] ?? null;
  }

  const pool = open.length > 0 ? open : all;
  const wanted = new Set(postcodes.map(compactPostcode));
  const named = pool.filter((c) => wanted.has(compactPostcode(c.postcode)));
  return named.length === 1 ? (named[0] ?? null) : null;
}

/**
 * Decide the deal for one email. Strongest evidence first:
 *
 *   1. deal tag     — sent to the deal's own address (`log+<dealId>@…`)
 *   2. thread       — a reply in a conversation already on a deal
 *   3. participant  — the other side is a deal's seller or solicitor
 *   4. postcode     — a full postcode in the text names exactly one deal
 *
 * A postcode never makes a stranger's email acceptable: anyone can type one.
 *
 * TWO KINDS OF EMAIL, once the automatic copy is on (`opts.autoCopy`):
 *
 *  - ADDRESSED TO THE LOG (someone put it in To or CC, or used a deal's own
 *    address). A founder's is always kept; with no single deal it waits
 *    unfiled for a person. This is the only kind when autoCopy is off.
 *
 *  - A MAILBOX COPY (Google Workspace copied it; the log is not in To/CC).
 *    This is the founders' whole mailbox, so it is kept only when it is deal
 *    mail: it continues a conversation we hold, it is to or from a deal's
 *    seller or solicitor, or a founder wrote it and a postcode names one
 *    deal. It must also involve someone OUTSIDE the company: a note between
 *    founders is never picked up unasked, even inside a deal's thread.
 *    Anything else is ignored and leaves no trace.
 */
export async function resolveDeal(
  email: NormalisedEmail,
  book: AddressBook,
  lookups: DealLookups,
  opts: ResolveOptions = {}
): Promise<DealMatch> {
  const senderIsFounder = book.founders.has(email.fromEmail);
  const explicit =
    !opts.autoCopy || email.dealTag !== null || addressedToLog(email, book);

  // Decided before any database call: most of a mailbox ends here.
  if (!explicit && outsideParties(email, book).length === 0) {
    return {
      dealId: null,
      matchedBy: null,
      threadKey: email.references[0] ?? email.inReplyTo ?? email.messageId,
      accepted: false,
      explicit,
    };
  }

  const ancestors = unique(
    [email.inReplyTo, ...email.references].filter(
      (id): id is string => id !== null
    )
  );
  const thread =
    ancestors.length > 0 ? await lookups.threadFor(ancestors) : null;
  const threadKey =
    thread?.threadKey ??
    email.references[0] ??
    email.inReplyTo ??
    email.messageId;

  if (email.dealTag) {
    const tagged = await lookups.dealById(email.dealTag);
    if (tagged) {
      return {
        dealId: tagged.id,
        matchedBy: 'deal_tag',
        threadKey,
        accepted: true,
        explicit,
      };
    }
  }

  if (thread?.dealId) {
    return {
      dealId: thread.dealId,
      matchedBy: 'thread',
      threadKey,
      accepted: true,
      explicit,
    };
  }

  // A founder's email is matched on everyone it went to. A stranger's is
  // matched on the sender alone: naming a seller in CC proves nothing.
  const parties = senderIsFounder
    ? otherParties(email, book)
    : [email.fromEmail];
  const partyDeals =
    parties.length > 0 ? await lookups.dealsByParticipant(parties) : [];
  // Being a founder is enough to keep an email they addressed to the log. It
  // is NOT enough for a mailbox copy, or every email they send would be kept.
  const accepted =
    (explicit && senderIsFounder) || thread !== null || partyDeals.length > 0;

  const byParty = pickOne(partyDeals, email.postcodes);
  if (byParty) {
    return {
      dealId: byParty.id,
      matchedBy: 'participant',
      threadKey,
      accepted: true,
      explicit,
    };
  }

  // Several deals share this party (one solicitor, two purchases) and the
  // text did not settle it. Do not let a postcode pick a deal OUTSIDE that
  // set; leave it for a person.
  if (partyDeals.length > 0) {
    return { dealId: null, matchedBy: null, threadKey, accepted, explicit };
  }

  // A postcode can place an email we are keeping anyway, and it can make a
  // founder's own mailbox copy worth keeping (they wrote to a surveyor about
  // the home). It never does that for a stranger's.
  if (email.postcodes.length > 0 && (accepted || senderIsFounder)) {
    const byPostcode = pickOne(
      await lookups.dealsByPostcode(email.postcodes),
      email.postcodes
    );
    if (byPostcode) {
      return {
        dealId: byPostcode.id,
        matchedBy: 'postcode',
        threadKey,
        accepted: true,
        explicit,
      };
    }
  }

  return { dealId: null, matchedBy: null, threadKey, accepted, explicit };
}

// ───────────────────────────────────────────────────────────────────────────
// Attachments
// ───────────────────────────────────────────────────────────────────────────

/** Below this an embedded image is a signature logo, not a photo of a house. */
export const INLINE_IMAGE_NOISE_BYTES = 50 * 1024;

export function attachmentBytes(att: InboundAttachment): number {
  if (typeof att.ContentLength === 'number') {
    return att.ContentLength;
  }
  // base64 is 4 characters per 3 bytes.
  return Math.floor((att.Content.length * 3) / 4);
}

/** Embedded signature logos and social icons. Not worth a row or a file. */
export function isInlineNoise(att: InboundAttachment): boolean {
  return (
    Boolean(att.ContentID) &&
    att.ContentType.toLowerCase().startsWith('image/') &&
    attachmentBytes(att) < INLINE_IMAGE_NOISE_BYTES
  );
}

export function isPdf(att: InboundAttachment): boolean {
  return (
    att.ContentType.toLowerCase() === 'application/pdf' ||
    att.Name.toLowerCase().endsWith('.pdf')
  );
}

/** A filename safe to use as a path segment. */
export function safeFilename(name: string): string {
  const cleaned = name
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^[._]+/, '')
    .slice(-120);
  return cleaned.length > 0 ? cleaned : 'attachment';
}

export type StoredAttachment = {
  filename: string;
  contentType: string;
  sizeBytes: number;
  /** Where the file is kept. Absent when it was not stored. */
  url?: string;
  /** Why it was not stored: too_large | store_failed. */
  skipped?: string;
  /** DocumentExtract row, when the PDF pipeline read it. */
  extractId?: string;
};

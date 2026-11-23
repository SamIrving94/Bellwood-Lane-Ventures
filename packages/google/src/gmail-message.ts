/**
 * Turn a Gmail API message into the plain facts the deal email log needs.
 *
 * Pure: no network, no database, no `server-only`, so every rule here is
 * unit-tested. The shapes follow the Gmail API's `users.messages` resource
 * (`format=metadata` and `format=full`), written from the API as documented;
 * they have not yet been checked against a live mailbox.
 */

export type GmailHeader = { name: string; value: string };

export type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
};

export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  /** First ~200 characters of the body. Present in every format. */
  snippet?: string;
  /** Epoch milliseconds, as a string. */
  internalDate?: string;
  payload?: GmailPart;
};

export type MailAttachment = {
  filename: string;
  contentType: string;
  sizeBytes: number;
};

/** One email, read from Gmail. Body fields are empty until `format=full`. */
export type DealMail = {
  gmailId: string;
  gmailThreadId: string;
  /** RFC Message-ID without angle brackets. Reference only. */
  messageId: string | null;
  /** `gmail:<thread id>`. Gmail does the threading; we do not re-derive it. */
  threadKey: string;
  labelIds: string[];
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  sentAt: Date;
  /** Gmail's short preview. Enough to spot a postcode without the body. */
  snippet: string;
  bodyText: string;
  /** The new part only, quoted history cut off. Null when nothing was cut. */
  replyText: string | null;
  attachments: MailAttachment[];
};

/** Longest body we keep. A long legal thread fits; a pasted novel does not. */
export const MAX_BODY_CHARS = 100_000;
/** Below this an embedded image is a signature logo, not a photo of a house. */
export const INLINE_IMAGE_NOISE_BYTES = 50 * 1024;

const EMAIL_RE = /[A-Z0-9._%+'-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/gi;
const BRACKETED_ID_RE = /<([^<>\s]+)>/;
const DISPLAY_NAME_RE = /^\s*"?([^"<]*?)"?\s*</;

const unique = <T>(items: T[]): T[] => Array.from(new Set(items));

export const headerOf = (
  part: GmailPart | undefined,
  name: string
): string | null => {
  const wanted = name.toLowerCase();
  for (const h of part?.headers ?? []) {
    if (h.name.toLowerCase() === wanted && h.value) {
      return h.value;
    }
  }
  return null;
};

/** Every email address in a header value, lowercased, in order. */
export const parseAddressList = (raw: string | null | undefined): string[] =>
  raw ? unique((raw.match(EMAIL_RE) ?? []).map((a) => a.toLowerCase())) : [];

/** `"Jo Bloggs" <jo@x.co.uk>` → `Jo Bloggs`. Null when there is no name. */
export const displayName = (fromHeader: string | null): string | null => {
  const name = fromHeader?.match(DISPLAY_NAME_RE)?.[1]?.trim();
  return name && !name.includes('@') ? name : null;
};

/** "m145ab" / "M14  5AB" → "M14 5AB". */
export const formatPostcode = (raw: string): string => {
  const compact = raw.toUpperCase().replace(/\s+/g, '');
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
};

export const compactPostcode = (raw: string): string =>
  raw.toUpperCase().replace(/\s+/g, '');

/** Full postcodes only. An outward code alone ("M14") names a district, not a home. */
export const extractPostcodes = (text: string): string[] => {
  const found: string[] = [];
  for (const m of text.matchAll(POSTCODE_RE)) {
    found.push(formatPostcode(`${m[1]}${m[2]}`));
  }
  return unique(found);
};

/** Gmail sends bodies as base64url of the UTF-8 bytes. */
export const decodeBase64Url = (data: string): string =>
  Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
    'utf-8'
  );

/** Plain text from an HTML-only email. Good enough to read and to search. */
export const htmlToText = (html: string): string =>
  html
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

const isAttachment = (part: GmailPart): boolean =>
  Boolean(part.filename && part.filename.length > 0);

/** Every leaf of the MIME tree, depth first, in document order. */
const leaves = (part: GmailPart | undefined): GmailPart[] => {
  if (!part) {
    return [];
  }
  return part.parts && part.parts.length > 0
    ? part.parts.flatMap(leaves)
    : [part];
};

/**
 * The readable body: the first text/plain part that is not an attachment,
 * else the first text/html part turned into text. Empty when there is
 * neither (a message that is only an attachment).
 */
export const extractBody = (payload: GmailPart | undefined): string => {
  const texts = leaves(payload).filter((p) => !isAttachment(p) && p.body?.data);
  const plain = texts.find((p) => p.mimeType === 'text/plain');
  if (plain?.body?.data) {
    return decodeBase64Url(plain.body.data).trim().slice(0, MAX_BODY_CHARS);
  }
  const html = texts.find((p) => p.mimeType === 'text/html');
  return html?.body?.data
    ? htmlToText(decodeBase64Url(html.body.data)).slice(0, MAX_BODY_CHARS)
    : '';
};

/**
 * The files on an email, by name only. Embedded signature logos (a small
 * image with a Content-ID) are left out: they are on every email and tell
 * nobody anything.
 */
export const listAttachments = (
  payload: GmailPart | undefined
): MailAttachment[] =>
  leaves(payload)
    .filter(isAttachment)
    .filter((p) => {
      const size = p.body?.size ?? 0;
      const embedded = headerOf(p, 'Content-ID') !== null;
      const image = (p.mimeType ?? '').toLowerCase().startsWith('image/');
      return !(embedded && image && size < INLINE_IMAGE_NOISE_BYTES);
    })
    .map((p) => ({
      filename: p.filename ?? 'attachment',
      contentType: p.mimeType ?? 'application/octet-stream',
      sizeBytes: p.body?.size ?? 0,
    }));

// Where the quoted history starts, for the common mail clients. Gmail and
// Apple Mail ("On … wrote:", sometimes wrapped onto a second line), Outlook
// ("-----Original Message-----", or a From:/Sent: block), and a run of
// lines that all start with ">".
const QUOTE_MARKERS = [
  /^On .{6,200}\bwrote:\s*$/m,
  /^On .{6,200}\n.{0,200}\bwrote:\s*$/m,
  /^-{2,}\s*Original Message\s*-{2,}\s*$/im,
  /^From: .+\n(?:Sent|Date): .+$/m,
  /^>.*(?:\n>.*)+\s*$/m,
];

/**
 * The part of an email its sender actually wrote this time. Best effort:
 * when no marker is found, or cutting would leave nothing, the answer is
 * null and the whole body stands.
 */
export const stripQuotedHistory = (body: string): string | null => {
  let cut = body.length;
  for (const marker of QUOTE_MARKERS) {
    const at = body.search(marker);
    if (at >= 0 && at < cut) {
      cut = at;
    }
  }
  if (cut === body.length) {
    return null;
  }
  const reply = body.slice(0, cut).trim();
  return reply.length > 0 ? reply : null;
};

const parseDate = (message: GmailMessage, now: Date): Date => {
  // internalDate is when Gmail received or sent it: no time zones to parse
  // and nothing a sender can forge into the future.
  const ms = Number(message.internalDate);
  if (Number.isFinite(ms) && ms > 0) {
    return new Date(Math.min(ms, now.getTime()));
  }
  const fromHeader = new Date(headerOf(message.payload, 'Date') ?? '');
  return Number.isNaN(fromHeader.getTime()) || fromHeader > now
    ? now
    : fromHeader;
};

/**
 * One Gmail message as a `DealMail`. Works for both formats: with
 * `format=metadata` the body and attachments are simply empty. Null when
 * there is no sender address, the one thing we cannot work without.
 */
export const toDealMail = (
  message: GmailMessage,
  now: Date = new Date()
): DealMail | null => {
  const from = headerOf(message.payload, 'From');
  const fromEmail = parseAddressList(from)[0];
  if (!fromEmail) {
    return null;
  }
  const bodyText = extractBody(message.payload);
  return {
    gmailId: message.id,
    gmailThreadId: message.threadId,
    messageId:
      headerOf(message.payload, 'Message-ID')?.match(BRACKETED_ID_RE)?.[1] ??
      null,
    threadKey: `gmail:${message.threadId}`,
    labelIds: message.labelIds ?? [],
    fromEmail,
    fromName: displayName(from),
    toEmails: parseAddressList(headerOf(message.payload, 'To')),
    ccEmails: parseAddressList(headerOf(message.payload, 'Cc')),
    subject: (headerOf(message.payload, 'Subject') ?? '').trim().slice(0, 500),
    sentAt: parseDate(message, now),
    snippet: message.snippet ?? '',
    bodyText,
    replyText: stripQuotedHistory(bodyText),
    attachments: listAttachments(message.payload),
  };
};

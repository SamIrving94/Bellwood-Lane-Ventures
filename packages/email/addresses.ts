/**
 * Pure address helpers for the correspondence log. No I/O, so they are
 * tested directly (apps/api/__tests__/email-addresses.test.ts).
 */

/**
 * Where replies go when a caller does not say otherwise.
 *
 * Founder decision (Oct 2026, "one live mailbox"): sam@wearekept.co.uk is the
 * only mailbox that exists on the Kept domain. The sender address
 * (RESEND_FROM) is send-only at Resend; it has no inbox behind it. Without an
 * explicit Reply-To, a reply goes to the sender address and Google rejects
 * it with 550 "no such user". That is the Nov 2026 bounce: a reply to a
 * "Welcome to Kept" email, addressed to hello@, never arrived.
 */
export const DEFAULT_REPLY_TO = 'sam@wearekept.co.uk';

/** Domains we own. Mail to these is an internal notification, not a conversation. */
const OWN_DOMAINS = ['wearekept.co.uk', 'bellwoodslane.co.uk'];

/**
 * Pull the bare address out of `Name <a@b.c>` or `a@b.c`, lower-cased.
 * Returns null when there is no address to find: a guessed address would
 * file the message under the wrong person.
 */
export function bareAddress(input: string | null | undefined): string | null {
  if (!input) return null;
  const angled = input.match(/<([^<>\s]+@[^<>\s]+)>/);
  const candidate = (angled ? angled[1] : input).trim().toLowerCase();
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(candidate)
    ? candidate
    : null;
}

export function isOwnAddress(address: string): boolean {
  const domain = address.toLowerCase().split('@')[1] ?? '';
  return OWN_DOMAINS.includes(domain);
}

/**
 * Rough HTML → text, for showing an inbound email that came without a text
 * part. The dashboard never renders inbound HTML (it is untrusted), so this
 * only has to be readable, not faithful.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** `Re: ` once, however many times the thread has already been replied to. */
export function replySubject(subject: string): string {
  const stripped = subject.replace(/^(\s*re:\s*)+/i, '').trim();
  return `Re: ${stripped || '(no subject)'}`;
}

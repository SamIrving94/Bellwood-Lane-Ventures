/**
 * Outreach routing: who may be emailed automatically, and who is held.
 *
 * CLAUDE.md safety rail: "Vendor-facing emails are never auto-sent — they are
 * always held for founder review (OutreachHold)."
 *
 * `Contact.type` is a bare `String` in the Prisma schema — no enum, no check
 * constraint — and every writer (the founder's contact form, the prospecting
 * crons, imports) puts whatever it likes in it. The rail therefore CANNOT be
 * expressed as a deny-list of individual types: it used to be
 * `['vendor','seller','individual']`, so 'executor' (the word the probate
 * pipeline itself uses), 'homeowner', or a stray 'Vendor ' with a trailing
 * space all fell straight through to auto-send.
 *
 * Inverted here: auto-send is an ALLOW-list of known business counterparties.
 * Anything unrecognised — including empty, misspelt, or newly invented types —
 * fails CLOSED and is held for founder review. A false hold costs the founder
 * one click; a false send costs a vendor relationship.
 */

/**
 * Contact types that may be emailed without founder review. These are the
 * business/trade audiences in the CRM vocabulary (see the type filters in
 * apps/app/app/(authenticated)/outreach and /contacts). Vendors and sellers
 * are deliberately absent, and so is anything not on this list.
 */
export const AUTO_SEND_CONTACT_TYPES: readonly string[] = [
  'estate_agent',
  'solicitor',
  'investor',
  'sourcer',
];

const AUTO_SEND = new Set(AUTO_SEND_CONTACT_TYPES);

/**
 * True only when the contact is a known business counterparty. Whitespace and
 * casing are normalised first — 'Estate_Agent ' is the same contact type as
 * 'estate_agent', while an unknown or empty value is never auto-sendable.
 */
export function canAutoSend(contactType: string | null | undefined): boolean {
  if (!contactType) return false;
  return AUTO_SEND.has(contactType.trim().toLowerCase());
}

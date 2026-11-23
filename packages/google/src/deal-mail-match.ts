/**
 * The deal email log: which emails are kept, and on which deal.
 *
 * Pure: no network, no database, no `server-only`. The database questions
 * are asked through `DealLookups`, so tests answer them.
 *
 * Kept reads the WHOLE Kept mailbox through the Google connection, so two
 * rules shape everything here:
 *
 *  - ONLY DEAL MAIL IS KEPT. An email is kept when it continues a
 *    conversation already in the log, when it is to or from a deal's seller
 *    or solicitor, or when we wrote it to someone outside and a full
 *    postcode names one deal. Anything else is ignored and leaves no trace.
 *    A note between colleagues is never picked up, even inside a deal's
 *    thread. The one way to override that is deliberate: put the `Kept/Log`
 *    label on the email in Gmail.
 *
 *  - NEVER GUESS THE DEAL. A match must be the only candidate. Two deals in
 *    one postcode, or a solicitor acting on two of our purchases, leaves the
 *    email unfiled for a person to place. A seller's email on someone else's
 *    deal is a privacy problem, not a tidy-up.
 */

import { compactPostcode } from './gmail-message';

export type MailForMatch = {
  fromEmail: string;
  toEmails: string[];
  ccEmails: string[];
  /** `gmail:<thread id>`. */
  threadKey: string;
  /** Full postcodes seen in the email so far, as "M14 5AB". */
  postcodes: string[];
  /** A founder put the `Kept/Log` label on it: keep it whatever it is. */
  explicit: boolean;
};

export type DealCandidate = {
  id: string;
  postcode: string;
  /** False once a deal is completed, rejected or withdrawn. */
  open: boolean;
};

/** The database questions the matcher asks. */
export type DealLookups = {
  /**
   * Is this conversation already in the log? Null when it is not; a row
   * with `dealId: null` when it is there but still waiting for a deal.
   */
  threadDeal(threadKey: string): Promise<{ dealId: string | null } | null>;
  /** Deals whose seller or solicitor email is one of these. */
  dealsByParticipant(emails: string[]): Promise<DealCandidate[]>;
  /** Deals at exactly one of these full postcodes. */
  dealsByPostcode(postcodes: string[]): Promise<DealCandidate[]>;
};

export type MatchedBy = 'thread' | 'participant' | 'postcode';

export type DealMatch = {
  /** Keep the email at all? */
  accepted: boolean;
  dealId: string | null;
  matchedBy: MatchedBy | null;
};

const IGNORED: DealMatch = { accepted: false, dealId: null, matchedBy: null };

const unique = <T>(items: T[]): T[] => Array.from(new Set(items));

const domainOf = (address: string): string =>
  address.slice(address.lastIndexOf('@') + 1).toLowerCase();

/**
 * Is this address inside the company? The connected mailbox is the Kept
 * Workspace account (personal Gmail is refused at connection), so "inside"
 * is simply its domain.
 */
export const isOurs = (address: string, mailbox: string): boolean =>
  domainOf(address) === domainOf(mailbox);

/** Everyone on the email from outside the company, sender first. */
export const outsideParties = (
  mail: Pick<MailForMatch, 'fromEmail' | 'toEmails' | 'ccEmails'>,
  mailbox: string
): string[] =>
  unique(
    [mail.fromEmail, ...mail.toEmails, ...mail.ccEmails]
      .map((a) => a.toLowerCase())
      .filter((a) => !isOurs(a, mailbox))
  );

/** `outbound` when someone at the company wrote it, `inbound` otherwise. */
export const directionOf = (
  mail: Pick<MailForMatch, 'fromEmail'>,
  mailbox: string
): 'inbound' | 'outbound' =>
  isOurs(mail.fromEmail, mailbox) ? 'outbound' : 'inbound';

/**
 * One deal from a set of candidates, or null. Narrowing order: the only
 * candidate → the only open one → the only one whose postcode is in the
 * email. Still more than one after that is ambiguous, and ambiguous is null.
 */
export const pickOne = (
  candidates: DealCandidate[],
  postcodes: string[]
): DealCandidate | null => {
  const all = Array.from(new Map(candidates.map((c) => [c.id, c])).values());
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
};

/**
 * Decide whether one email is kept, and on which deal. Strongest evidence
 * first:
 *
 *   1. thread       — a reply in a conversation already on a deal
 *   2. participant  — the other side is a deal's seller or solicitor
 *   3. postcode     — a full postcode in the text names exactly one deal
 *
 * A postcode never makes an inbound stranger's email worth keeping: a
 * property newsletter can name any postcode.
 */
export const resolveDeal = async (
  mail: MailForMatch,
  mailbox: string,
  lookups: DealLookups
): Promise<DealMatch> => {
  const outside = outsideParties(mail, mailbox);
  // Decided before any database call: most of a mailbox ends here.
  if (!mail.explicit && outside.length === 0) {
    return IGNORED;
  }

  const thread = await lookups.threadDeal(mail.threadKey);
  if (thread?.dealId) {
    return { accepted: true, dealId: thread.dealId, matchedBy: 'thread' };
  }

  // Our own email is matched on everyone outside it went to. Someone else's
  // is matched on the sender alone: naming a seller in CC proves nothing.
  const fromUs = isOurs(mail.fromEmail, mailbox);
  const parties = fromUs ? outside : [mail.fromEmail.toLowerCase()];
  const partyDeals =
    parties.length > 0 ? await lookups.dealsByParticipant(parties) : [];
  const accepted = mail.explicit || thread !== null || partyDeals.length > 0;

  const byParty = pickOne(partyDeals, mail.postcodes);
  if (byParty) {
    return { accepted: true, dealId: byParty.id, matchedBy: 'participant' };
  }

  // Several deals share this party (one solicitor, two purchases) and the
  // text did not settle it. Do not let a postcode pick a deal OUTSIDE that
  // set; leave it for a person.
  if (partyDeals.length > 0) {
    return { accepted, dealId: null, matchedBy: null };
  }

  // A postcode can place an email we are keeping anyway, and it can make
  // OUR OWN email worth keeping (we wrote to a surveyor about the home).
  if (mail.postcodes.length > 0 && (accepted || fromUs)) {
    const byPostcode = pickOne(
      await lookups.dealsByPostcode(mail.postcodes),
      mail.postcodes
    );
    if (byPostcode) {
      return { accepted: true, dealId: byPostcode.id, matchedBy: 'postcode' };
    }
  }

  return { accepted, dealId: null, matchedBy: null };
};

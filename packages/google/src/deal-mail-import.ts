/**
 * The deal email log's import run, with Gmail and the database behind two
 * small interfaces so the whole run is tested with in-memory fakes.
 *
 * What a run does, in order:
 *   1. Ask Gmail for the ids of mail since the last run, plus anything
 *      carrying the `Kept/Log` label. Ids only: no content yet.
 *   2. Drop the ids we already hold (including emails a founder removed).
 *   3. Read the HEADERS of the rest and decide, per email, whether it is
 *      deal mail (`resolveDeal`). Most of a mailbox stops here, unread.
 *   4. For the ones that are: read the full email, store it, and mark it in
 *      Gmail with `Kept/Logged` so the founder can see it was taken.
 *
 * Nothing is ever sent, archived, deleted or marked read. The only change
 * made in Gmail is adding the `Kept/Logged` label.
 */

import {
  type DealLookups,
  type DealMatch,
  directionOf,
  resolveDeal,
} from './deal-mail-match';
import {
  type DealMail,
  type GmailMessage,
  extractPostcodes,
  toDealMail,
} from './gmail-message';

export type GmailPort = {
  /** Message ids (with their thread ids), newest first. No content. */
  listIds(query: {
    q?: string;
    labelId?: string;
    max: number;
  }): Promise<{ id: string; threadId: string }[]>;
  /** Headers, labels and snippet. No body. */
  getMeta(id: string): Promise<GmailMessage>;
  /** The whole message. */
  getFull(id: string): Promise<GmailMessage>;
  addLabel(id: string, labelId: string): Promise<void>;
};

/** One email ready to store. */
export type MailToSave = DealMail & {
  dealId: string | null;
  matchedBy: DealMatch['matchedBy'];
  direction: 'inbound' | 'outbound';
};

export type StorePort = {
  /** Which of these Gmail ids we already hold (kept OR removed). */
  knownGmailIds(ids: string[]): Promise<Set<string>>;
  lookups: DealLookups;
  /** False when another run stored it first. */
  save(mail: MailToSave): Promise<boolean>;
  /**
   * A conversation now has its deal: file the emails in it that were
   * waiting, and close its "needs a deal" card.
   */
  adoptThread(threadKey: string, dealId: string): Promise<void>;
  /** One card per conversation asking a person to place it. */
  raiseUnfiledCard(mail: MailToSave): Promise<void>;
};

export type ImportInput = {
  gmail: GmailPort;
  store: StorePort;
  /** The connected Kept mailbox. Its domain is "us". */
  mailbox: string;
  labelIds: { log: string; logged: string };
  /** Gmail search for the mail to consider, e.g. `after:1763900000`. */
  query: string;
  /** Most messages to consider in one run. */
  max: number;
  /**
   * History import for one deal: keep only what resolves to THIS deal, and
   * leave alone anything that could belong to another.
   */
  onlyDealId?: string;
  now?: Date;
};

export type ImportResult = {
  /** New messages whose headers were read. */
  scanned: number;
  /** Stored on a deal. */
  kept: number;
  /** Stored, waiting for a deal. */
  unfiled: number;
  /** Not deal mail. Nothing about these is kept. */
  ignored: number;
  errors: number;
  /** The run hit `max`: there may be more mail than it looked at. */
  capped: boolean;
};

/** Gmail's own labels for mail that is not a real, delivered message. */
const NOT_MAIL = new Set(['DRAFT', 'SPAM', 'TRASH', 'CHAT']);
/** Messages with the Kept/Log label considered per run. */
const LABELLED_MAX = 200;
/** Header reads in flight at once. Well inside Gmail's per-user quota. */
const CONCURRENCY = 5;

const inBatches = async <T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> => {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
};

export const runDealMailImport = async (
  input: ImportInput
): Promise<ImportResult> => {
  const { gmail, store, labelIds } = input;
  const now = input.now ?? new Date();
  const result: ImportResult = {
    scanned: 0,
    kept: 0,
    unfiled: 0,
    ignored: 0,
    errors: 0,
    capped: false,
  };

  // 1. Ids only. The label query runs on every pass, so an old email a
  //    founder labels today is still found.
  const recent = await gmail.listIds({ q: input.query, max: input.max });
  result.capped = recent.length >= input.max;
  const labelled = input.onlyDealId
    ? []
    : await gmail.listIds({ labelId: labelIds.log, max: LABELLED_MAX });
  const ids = Array.from(new Set([...recent, ...labelled].map((m) => m.id)));
  if (ids.length === 0) {
    return result;
  }

  // 2. Skip what we hold. A removed email is held too, as a tombstone.
  const known = await store.knownGmailIds(ids);
  const fresh = ids.filter((id) => !known.has(id));

  // 3. Headers, then oldest first: the start of a conversation has to be
  //    stored before the replies that are matched by its thread.
  const metas = (
    await inBatches(fresh, CONCURRENCY, async (id) => {
      try {
        return toDealMail(await gmail.getMeta(id), now);
      } catch {
        result.errors += 1;
        return null;
      }
    })
  )
    .filter((m): m is DealMail => m !== null)
    .filter((m) => !m.labelIds.some((l) => NOT_MAIL.has(l)))
    .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  result.scanned = metas.length;

  for (const meta of metas) {
    try {
      const outcome = await importOne(input, meta, now);
      result[outcome] += 1;
    } catch {
      // One bad email must not stop the run. It is not stored, so the next
      // run meets it again.
      result.errors += 1;
    }
  }
  return result;
};

const importOne = async (
  input: ImportInput,
  meta: DealMail,
  now: Date
): Promise<'kept' | 'unfiled' | 'ignored'> => {
  const { gmail, store, mailbox, labelIds, onlyDealId } = input;
  const explicit = meta.labelIds.includes(labelIds.log);
  const forMatch = (mail: DealMail, text: string) => ({
    fromEmail: mail.fromEmail,
    toEmails: mail.toEmails,
    ccEmails: mail.ccEmails,
    threadKey: mail.threadKey,
    postcodes: extractPostcodes(text),
    explicit,
  });

  // Decide on the headers and Gmail's short preview. The body of an email
  // that is not deal mail is never fetched.
  let match = await resolveDeal(
    forMatch(meta, `${meta.subject}\n${meta.snippet}`),
    mailbox,
    store.lookups
  );
  if (!match.accepted) {
    return 'ignored';
  }

  const full = toDealMail(await gmail.getFull(meta.gmailId), now);
  if (!full) {
    return 'ignored';
  }
  // Kept, but no single deal yet: the postcode may be further down the body.
  if (!match.dealId) {
    match = await resolveDeal(
      forMatch(full, `${full.subject}\n${full.bodyText}`),
      mailbox,
      store.lookups
    );
  }

  if (onlyDealId && match.dealId !== onlyDealId) {
    // Belongs to another deal, or could belong to more than one.
    return 'ignored';
  }

  const mail: MailToSave = {
    ...full,
    dealId: match.dealId,
    matchedBy: match.matchedBy,
    direction: directionOf(full, mailbox),
  };
  if (!(await store.save(mail))) {
    return 'ignored';
  }

  if (mail.dealId) {
    await store.adoptThread(mail.threadKey, mail.dealId);
  } else {
    await store.raiseUnfiledCard(mail);
  }

  // Visible proof in Gmail that this one is in the log. Best effort: the
  // email is stored either way.
  try {
    await gmail.addLabel(mail.gmailId, labelIds.logged);
  } catch {
    // The label is a courtesy; the dashboard is the record.
  }
  return mail.dealId ? 'kept' : 'unfiled';
};

/**
 * The Gmail search for one deal's history: every message to, from or
 * copying one of its people. `{a b}` is Gmail's OR.
 */
export const dealHistoryQuery = (addresses: string[], days: number): string => {
  const terms = addresses
    .map((a) => a.trim().toLowerCase())
    .filter((a) => /^[^\s@{}()"]+@[^\s@{}()"]+$/.test(a))
    .flatMap((a) => [`from:${a}`, `to:${a}`, `cc:${a}`]);
  return terms.length === 0
    ? ''
    : `{${terms.join(' ')}} newer_than:${days}d -in:drafts -in:chats`;
};

/** The Gmail search for mail since a moment. Gmail takes epoch seconds. */
export const sinceQuery = (since: Date): string =>
  `after:${Math.floor(since.getTime() / 1000)} -in:drafts -in:chats`;

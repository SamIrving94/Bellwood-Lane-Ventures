import 'server-only';

import { database } from '@repo/database';
import { log } from '@repo/observability/log';
import {
  addGmailLabels,
  ensureGmailLabels,
  getGmailMessage,
  listGmailMessageIds,
} from './api';
import {
  type GoogleSession,
  getLink,
  getMailboxSessions,
  setLink,
} from './connection';
import {
  type GmailPort,
  type ImportResult,
  type MailToSave,
  type StorePort,
  dealHistoryQuery,
  runDealMailImport,
  sinceQuery,
} from './deal-mail-import';
import type { DealCandidate } from './deal-mail-match';
import { compactPostcode, formatPostcode } from './gmail-message';

/**
 * The deal email log, read from the Kept mailboxes: the main account and
 * any other Kept mailbox added in Settings → Google. No address to CC and
 * no mail provider in the middle: the Google connection already has the
 * mailboxes, so we read them and keep only the deal mail. The rules for
 * what counts are in `deal-mail-match.ts`; this file is the wiring.
 *
 * Mailboxes are read one after another, main account first. An email that
 * reached two of them is stored once: the second copy has a different
 * Gmail id but the same Message-ID, and is skipped.
 *
 * Like every other Google feature it returns `{ skipped: true }` when
 * Google is not connected, and it only ever READS mail. The single change
 * it makes in Gmail is adding the `Kept/Logged` label to what it stored.
 */
type Skipped = { skipped: true };
const SKIPPED: Skipped = { skipped: true };

/** A founder puts this on an email to log it whatever it is. */
export const LOG_LABEL = 'Kept/Log';
/** We put this on every email we stored, so it shows in Gmail. */
export const LOGGED_LABEL = 'Kept/Logged';

/** The last run across every mailbox, for the email log page. */
const STATE_KEY = 'deal-mail';
/** Each mailbox keeps its own place: `deal-mail:<address>`. */
const cursorKey = (mailbox: string) => `deal-mail:${mailbox.toLowerCase()}`;
const DAY_MS = 24 * 60 * 60 * 1000;
/** How far back the very first run looks. Older mail: the history button. */
const FIRST_RUN_DAYS = 3;
/**
 * Each run re-reads this much before the last one, so mail that arrived
 * while a run was in flight is not missed. Already-stored mail is skipped.
 */
const OVERLAP_MS = 15 * 60 * 1000;
/** Most messages one cron run considers. A half-hour of mail is far less. */
const RUN_MAX = 500;
const HISTORY_DAYS = 180;
const HISTORY_MAX = 200;
const CLOSED = ['completed', 'rejected', 'withdrawn'];

type MailboxCursor = {
  /** Start of the last run on this mailbox that finished with no errors. */
  lastSyncAt?: string | null;
};

type LastRun = ImportResult & {
  at: string;
  /** The mailboxes that run read. */
  mailboxes?: string[];
};

type DealMailState = { lastRun?: LastRun };

const EMPTY: ImportResult = {
  scanned: 0,
  kept: 0,
  unfiled: 0,
  ignored: 0,
  errors: 0,
  capped: false,
};

const addUp = (a: ImportResult, b: ImportResult): ImportResult => ({
  scanned: a.scanned + b.scanned,
  kept: a.kept + b.kept,
  unfiled: a.unfiled + b.unfiled,
  ignored: a.ignored + b.ignored,
  errors: a.errors + b.errors,
  capped: a.capped || b.capped,
});

const gmailPort = (session: GoogleSession): GmailPort => ({
  listIds: (query) => listGmailMessageIds(session, query),
  getMeta: (id) => getGmailMessage(session, id, 'metadata'),
  getFull: (id) => getGmailMessage(session, id, 'full'),
  addLabel: (id, labelId) => addGmailLabels(session, id, [labelId]),
});

const isUniqueViolation = (err: unknown): boolean =>
  (err as { code?: string } | null)?.code === 'P2002';

const toCandidate = (deal: {
  id: string;
  postcode: string;
  status: string;
}): DealCandidate => ({
  id: deal.id,
  postcode: deal.postcode,
  open: !CLOSED.includes(deal.status),
});

const DEAL_SELECT = { id: true, postcode: true, status: true } as const;
const unfiledKey = (threadKey: string) => `deal_email_unfiled:${threadKey}`;

const store: StorePort = {
  async knownGmailIds(ids) {
    const rows = await database.dealEmail.findMany({
      where: { gmailId: { in: ids } },
      select: { gmailId: true },
    });
    return new Set(rows.map((r) => r.gmailId));
  },

  async knownMessageIds(ids) {
    // Removed emails keep their Message-ID, so a copy in another mailbox
    // does not bring one back.
    const rows = await database.dealEmail.findMany({
      where: { messageId: { in: ids } },
      select: { messageId: true },
    });
    return new Set(
      rows.map((r) => r.messageId).filter((id): id is string => id !== null)
    );
  },

  lookups: {
    async threadDeal(threadKey) {
      // A removed email is a tombstone, not part of the conversation.
      const rows = await database.dealEmail.findMany({
        where: { threadKey, removedAt: null },
        orderBy: { sentAt: 'desc' },
        take: 20,
        select: { dealId: true },
      });
      return rows.find((r) => r.dealId !== null) ?? rows[0] ?? null;
    },

    async dealsByParticipant(emails) {
      const deals = await database.deal.findMany({
        where: {
          OR: emails.slice(0, 15).flatMap((email) => [
            { sellerEmail: { equals: email, mode: 'insensitive' as const } },
            {
              solicitorEmail: { equals: email, mode: 'insensitive' as const },
            },
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
  },

  async save(mail: MailToSave) {
    try {
      await database.dealEmail.create({
        data: {
          dealId: mail.dealId,
          gmailId: mail.gmailId,
          gmailThreadId: mail.gmailThreadId,
          mailbox: mail.mailbox,
          messageId: mail.messageId,
          threadKey: mail.threadKey,
          direction: mail.direction,
          fromEmail: mail.fromEmail,
          fromName: mail.fromName,
          toEmails: mail.toEmails,
          ccEmails: mail.ccEmails,
          subject: mail.subject,
          bodyText: mail.bodyText,
          replyText: mail.replyText,
          sentAt: mail.sentAt,
          matchedBy: mail.matchedBy,
          attachments: mail.attachments,
        },
      });
      return true;
    } catch (err) {
      // The cron and a history import met the same email. One of them won.
      if (isUniqueViolation(err)) {
        return false;
      }
      throw err;
    }
  },

  async adoptThread(threadKey, dealId) {
    const moved = await database.dealEmail.updateMany({
      where: { threadKey, dealId: null, removedAt: null },
      data: { dealId, matchedBy: 'thread' },
    });
    if (moved.count > 0) {
      await database.founderAction.updateMany({
        where: { dedupKey: unfiledKey(threadKey), status: 'pending' },
        data: { status: 'completed', resolvedAt: new Date() },
      });
    }
  },

  async raiseUnfiledCard(mail) {
    try {
      await database.founderAction.create({
        data: {
          type: 'general',
          priority: 'medium',
          status: 'pending',
          agent: 'system',
          title: `Email needs a deal: ${mail.subject || '(no subject)'}`.slice(
            0,
            200
          ),
          description: [
            `From: ${mail.fromName ? `${mail.fromName} ` : ''}<${mail.fromEmail}>`,
            '',
            'It is deal mail, but no single deal matched, so it was not filed. Pick the deal and the whole conversation follows.',
          ].join('\n'),
          dedupKey: unfiledKey(mail.threadKey),
          metadata: { link: '/deals/email-log', sourceType: 'deal_email' },
        },
      });
    } catch (err) {
      // P2002 = this conversation already has its card.
      if (!isUniqueViolation(err)) {
        throw err;
      }
    }
  },
};

const labelIdsFor = async (session: GoogleSession) => {
  const ids = await ensureGmailLabels(session, [LOG_LABEL, LOGGED_LABEL]);
  return { log: ids[LOG_LABEL], logged: ids[LOGGED_LABEL] };
};

/**
 * The regular pass (google-sync cron): for each mailbox, everything since
 * its last clean run. A run with errors does not move that mailbox's
 * cursor, so those emails are tried again; the three-day floor stops one
 * bad email holding it back forever. One mailbox failing (a revoked
 * token, a Gmail error) does not stop the others.
 */
export const importDealMail = async (
  now: Date = new Date()
): Promise<
  Skipped | ({ skipped: false; mailboxes: string[] } & ImportResult)
> => {
  const sessions = await getMailboxSessions();
  if (sessions.length === 0) {
    return SKIPPED;
  }

  let total = EMPTY;
  for (const session of sessions) {
    total = addUp(total, await importOneMailbox(session, now));
  }

  const mailboxes = sessions.map((s) => s.email);
  await setLink(STATE_KEY, {
    lastRun: { ...total, at: now.toISOString(), mailboxes },
  });
  return { skipped: false, mailboxes, ...total };
};

const importOneMailbox = async (
  session: GoogleSession,
  now: Date
): Promise<ImportResult> => {
  const key = cursorKey(session.email);
  const cursor = (await getLink<MailboxCursor>(key)) ?? {};
  const floor = now.getTime() - FIRST_RUN_DAYS * DAY_MS;
  const since = new Date(
    Math.max(
      floor,
      cursor.lastSyncAt
        ? new Date(cursor.lastSyncAt).getTime() - OVERLAP_MS
        : floor
    )
  );

  try {
    const result = await runDealMailImport({
      gmail: gmailPort(session),
      store,
      mailbox: session.email,
      labelIds: await labelIdsFor(session),
      query: sinceQuery(since),
      max: RUN_MAX,
      now,
    });
    await setLink(key, {
      lastSyncAt:
        result.errors === 0 ? now.toISOString() : (cursor.lastSyncAt ?? null),
    });
    return result;
  } catch (err) {
    log.warn('deal-mail: a mailbox could not be read', {
      mailbox: session.email,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ...EMPTY, errors: 1 };
  }
};

/**
 * "Find older emails" on a deal: search every Kept mailbox for mail to,
 * from or copying the deal's seller and solicitor over the last six months,
 * and keep what belongs to THIS deal. Mail that could belong to another
 * deal is left.
 */
export const importDealHistory = async (
  dealId: string
): Promise<
  Skipped | ({ skipped: false; noAddresses: boolean } & ImportResult)
> => {
  const sessions = await getMailboxSessions();
  if (sessions.length === 0) {
    return SKIPPED;
  }
  const deal = await database.deal.findUnique({
    where: { id: dealId },
    select: { sellerEmail: true, solicitorEmail: true },
  });
  const query = dealHistoryQuery(
    [deal?.sellerEmail, deal?.solicitorEmail].filter(
      (a): a is string => typeof a === 'string'
    ),
    HISTORY_DAYS
  );
  if (!query) {
    return { skipped: false, noAddresses: true, ...EMPTY };
  }
  let total = EMPTY;
  for (const session of sessions) {
    try {
      total = addUp(
        total,
        await runDealMailImport({
          gmail: gmailPort(session),
          store,
          mailbox: session.email,
          labelIds: await labelIdsFor(session),
          query,
          max: HISTORY_MAX,
          onlyDealId: dealId,
        })
      );
    } catch (err) {
      // One mailbox failing must not hide what the others found.
      log.warn('deal-mail: history search failed for a mailbox', {
        mailbox: session.email,
        error: err instanceof Error ? err.message : String(err),
      });
      total = addUp(total, { ...EMPTY, errors: 1 });
    }
  }
  return { skipped: false, noAddresses: false, ...total };
};

export type DealMailStatus = {
  /** When the cron last looked at the mailboxes. Null before the first run. */
  lastRunAt: string | null;
  lastRun: LastRun | null;
};

/** What the email log page shows about the last run. Reads `Setting` only. */
export const getDealMailStatus = async (): Promise<DealMailStatus> => {
  const state = await getLink<DealMailState>(STATE_KEY);
  return {
    lastRunAt: state?.lastRun?.at ?? null,
    lastRun: state?.lastRun ?? null,
  };
};

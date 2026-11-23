/**
 * Read side of the deal email log. The write side is `importDealMail` in
 * @repo/google, run by the google-sync cron: it reads the Kept mailbox and
 * keeps the deal mail. The rules for what is kept, and on which deal, live
 * there (`resolveDeal`).
 */

import { database } from '@repo/database';
import { type EmailCardData, toEmailCards } from './deal-email-view';

export {
  type EmailAttachment,
  type EmailCardData,
  toEmailCards,
} from './deal-email-view';

/**
 * A deal's emails, newest first. Null when the log is not available yet:
 * the table arrives with `pnpm migrate`, and the deal page must not depend
 * on that having been run.
 */
export async function loadDealEmails(
  dealId: string
): Promise<EmailCardData[] | null> {
  try {
    const rows = await database.dealEmail.findMany({
      // A removed email stays as a tombstone so it is not imported again.
      where: { dealId, removedAt: null },
      orderBy: { sentAt: 'desc' },
      take: 60,
    });
    return toEmailCards(rows);
  } catch (err) {
    console.warn('[deal-emails] email log unavailable', err);
    return null;
  }
}

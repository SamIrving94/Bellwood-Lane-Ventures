/**
 * Read side of the deal email log. The write side is the Postmark webhook
 * in apps/api (/webhooks/postmark/inbound); the rules for which deal an
 * email lands on live there (`resolveDeal`).
 */

import { env } from '@/env';
import { database } from '@repo/database';
import { type EmailCardData, toEmailCards } from './deal-email-view';

export {
  type EmailAttachment,
  type EmailCardData,
  dealLogAddress,
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
      where: { dealId },
      orderBy: { sentAt: 'desc' },
      take: 60,
    });
    return toEmailCards(rows);
  } catch (_err) {
    return null;
  }
}

/** The address to CC, or null when DEAL_LOG_ADDRESS is not set. */
export function logAddress(): string | null {
  const first = (env.DEAL_LOG_ADDRESS ?? '').split(',')[0]?.trim();
  return first?.includes('@') ? first.toLowerCase() : null;
}

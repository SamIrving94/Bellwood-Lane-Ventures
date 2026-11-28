'use server';

import { emailLogDb } from '@/lib/email-log-db';
import { switchOnEmailLog } from '@/lib/email-log-setup';
import { requireFounder } from '@repo/auth/server';
import { revalidatePath } from 'next/cache';

export type SwitchOnResult = { ok: boolean; message: string };

/**
 * "Switch on the email log": create the `DealEmail` table from the
 * dashboard, or bring an older one up to date, for when `pnpm migrate` has
 * not been run. Founders only. The SQL is a fixed list (`EMAIL_LOG_DDL`,
 * `EMAIL_LOG_UPGRADES`): nothing from the request reaches the database.
 *
 * A database failure comes back as a sentence rather than a throw: Next
 * hides thrown messages in production, and "it did not work, and nothing
 * was changed" is exactly what the founder needs to read.
 */
export async function switchOnDealEmailLog(): Promise<SwitchOnResult> {
  const { userId } = await requireFounder();

  try {
    const outcome = await switchOnEmailLog(emailLogDb);

    console.info(`[email-log] switched on by ${userId}: ${outcome}`);
    revalidatePath('/deals/email-log');
    revalidatePath('/deals/[id]', 'page');

    const MESSAGES: Record<typeof outcome, string> = {
      created:
        'The email log is on. Gmail is checked every 30 minutes, so the first emails can take up to half an hour.',
      upgraded:
        'The email log is up to date. Emails show again, and new ones arrive within 30 minutes.',
      already_on:
        'The email log was already on. Reload this page. If it still says it is off, something else is wrong.',
    };
    return { ok: true, message: MESSAGES[outcome] };
  } catch (err) {
    console.error('[email-log] switch-on failed', err);
    const reason =
      err instanceof Error ? err.message.trim().split('\n').pop() : '';
    return {
      ok: false,
      message: `Could not switch on the email log. Nothing was changed.${reason ? ` The database said: ${reason}` : ''}`,
    };
  }
}

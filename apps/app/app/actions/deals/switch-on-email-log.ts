'use server';

import {
  EMAIL_LOG_TABLE_EXISTS_SQL,
  switchOnEmailLog,
} from '@/lib/email-log-setup';
import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

export type SwitchOnResult = { ok: boolean; message: string };

/**
 * "Switch on the email log": create the `DealEmail` table from the
 * dashboard, for when `pnpm migrate` has not been run. Founders only. The
 * SQL is a fixed list (`EMAIL_LOG_DDL`): nothing from the request reaches
 * the database.
 *
 * A database failure comes back as a sentence rather than a throw: Next
 * hides thrown messages in production, and "it did not work, and nothing
 * was changed" is exactly what the founder needs to read.
 */
export async function switchOnDealEmailLog(): Promise<SwitchOnResult> {
  const { userId } = await requireFounder();

  try {
    const outcome = await switchOnEmailLog({
      tableExists: async () => {
        const rows = await database.$queryRawUnsafe<{ exists: boolean }[]>(
          EMAIL_LOG_TABLE_EXISTS_SQL
        );
        return rows[0]?.exists === true;
      },
      runTogether: (statements) =>
        database.$transaction(async (tx) => {
          for (const sql of statements) {
            // In order, one at a time: the indexes need the table first.
            await tx.$executeRawUnsafe(sql);
          }
        }),
    });

    console.info(`[email-log] switched on by ${userId}: ${outcome}`);
    revalidatePath('/deals/email-log');
    revalidatePath('/deals/[id]', 'page');

    return outcome === 'created'
      ? {
          ok: true,
          message:
            'The email log is on. Gmail is checked every 30 minutes, so the first emails can take up to half an hour.',
        }
      : {
          ok: true,
          message:
            'The email log was already on. Reload this page. If it still says it is off, something else is wrong.',
        };
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

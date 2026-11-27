import 'server-only';

import { database } from '@repo/database';
import {
  EMAIL_LOG_TABLE_CURRENT_SQL,
  EMAIL_LOG_TABLE_EXISTS_SQL,
  type EmailLogDb,
  type EmailLogState,
  emailLogState,
} from './email-log-setup';

/**
 * The real database behind `EmailLogDb`. The SQL is the fixed text in
 * email-log-setup.ts: nothing from a request reaches it.
 */
export const emailLogDb: EmailLogDb = {
  tableExists: async () => {
    const rows = await database.$queryRawUnsafe<{ exists: boolean }[]>(
      EMAIL_LOG_TABLE_EXISTS_SQL
    );
    return rows[0]?.exists === true;
  },
  tableCurrent: async () => {
    const rows = await database.$queryRawUnsafe<{ current: boolean }[]>(
      EMAIL_LOG_TABLE_CURRENT_SQL
    );
    return rows[0]?.current === true;
  },
  runTogether: (statements) =>
    database.$transaction(async (tx) => {
      for (const sql of statements) {
        // In order, one at a time: the indexes need the table first.
        await tx.$executeRawUnsafe(sql);
      }
    }),
};

/**
 * Why the log cannot be read, for the pages. Only asked after a read
 * failed. If even this fails, say "missing": the button then reports
 * honestly what the database says.
 */
export const getEmailLogState = async (): Promise<EmailLogState> => {
  try {
    return await emailLogState(emailLogDb);
  } catch {
    return 'missing';
  }
};

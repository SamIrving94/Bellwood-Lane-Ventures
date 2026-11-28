/**
 * Switching on the deal email log from the dashboard: the one table it
 * needs, created by a button instead of a terminal.
 *
 * Why this exists. Schema changes normally arrive with `pnpm migrate`
 * (`prisma db push`), run from a machine that holds the database password.
 * The email log went live before that step was run, and the founder asked
 * for a way to finish it without a terminal (26 Nov 2026). Until the table
 * exists the google-sync cron logs "table does not exist" every half hour
 * and stores nothing.
 *
 * The statements below are Prisma's own output for the `DealEmail` model:
 * `prisma migrate diff` between the schema before and after the model was
 * added. So the table is the one `pnpm migrate` would create, and a later
 * `db push` finds nothing left to change. That was checked against a real
 * Postgres before this shipped; the test beside this file guards the column
 * and index names against the schema from here on.
 *
 * There is no foreign key to `Deal`, on purpose: the schema runs with
 * `relationMode = "prisma"`, so Prisma enforces relations itself and
 * creates none in the database.
 *
 * Upgrades. When the model gains a field after a table already exists, the
 * same button brings the table up to date (`EMAIL_LOG_UPGRADES`): Prisma's
 * own ALTER statements, written with IF NOT EXISTS so they are safe on any
 * version of the table. Each one is also in the CREATE above, so a fresh
 * table needs none of them.
 *
 * Pure: the database is passed in as a port, so the rules are unit-tested.
 */

/** Resolves the table the same way the CREATE below does (the search path). */
export const EMAIL_LOG_TABLE_EXISTS_SQL = `SELECT to_regclass('"DealEmail"') IS NOT NULL AS "exists"`;

/**
 * True when the table has everything the upgrades add. Update this with
 * `EMAIL_LOG_UPGRADES`.
 */
export const EMAIL_LOG_TABLE_CURRENT_SQL = `SELECT (
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'DealEmail'
      AND column_name = 'mailbox'
  )
  AND to_regclass('"DealEmail_messageId_idx"') IS NOT NULL
) AS "current"`;

/**
 * Everything the `DealEmail` model needs, in order. No `IF NOT EXISTS`: a
 * table of that name with another shape should fail loudly, not be adopted.
 */
export const EMAIL_LOG_DDL: readonly string[] = [
  `CREATE TABLE "DealEmail" (
    "id" TEXT NOT NULL,
    "dealId" TEXT,
    "gmailId" TEXT NOT NULL,
    "gmailThreadId" TEXT NOT NULL,
    "messageId" TEXT,
    "threadKey" TEXT NOT NULL,
    "mailbox" TEXT,
    "direction" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "toEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ccEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "replyText" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "matchedBy" TEXT,
    "summary" TEXT,
    "party" TEXT,
    "needsReply" BOOLEAN,
    "nextStep" TEXT,
    "digestedAt" TIMESTAMP(3),
    "attachments" JSONB,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealEmail_pkey" PRIMARY KEY ("id")
)`,
  `CREATE UNIQUE INDEX "DealEmail_gmailId_key" ON "DealEmail"("gmailId")`,
  `CREATE INDEX "DealEmail_dealId_sentAt_idx" ON "DealEmail"("dealId", "sentAt")`,
  `CREATE INDEX "DealEmail_threadKey_idx" ON "DealEmail"("threadKey")`,
  `CREATE INDEX "DealEmail_sentAt_idx" ON "DealEmail"("sentAt")`,
  `CREATE INDEX "DealEmail_messageId_idx" ON "DealEmail"("messageId")`,
];

/**
 * For a table made before these were in the model (27 Nov 2026: the email
 * log started reading more than one mailbox). Safe to run again.
 */
export const EMAIL_LOG_UPGRADES: readonly string[] = [
  `ALTER TABLE "DealEmail" ADD COLUMN IF NOT EXISTS "mailbox" TEXT`,
  `CREATE INDEX IF NOT EXISTS "DealEmail_messageId_idx" ON "DealEmail"("messageId")`,
];

/** The three things the switch needs from a database. */
export type EmailLogDb = {
  tableExists(): Promise<boolean>;
  /** The table has every upgrade (`EMAIL_LOG_TABLE_CURRENT_SQL`). */
  tableCurrent(): Promise<boolean>;
  /** Run every statement in ONE transaction: all of them, or none. */
  runTogether(statements: readonly string[]): Promise<void>;
};

export type SwitchOnOutcome = 'created' | 'upgraded' | 'already_on';

export type EmailLogState = 'missing' | 'outdated' | 'current';

/** What the pages say while the log cannot be read. */
export const emailLogState = async (db: EmailLogDb): Promise<EmailLogState> => {
  if (!(await db.tableExists())) {
    return 'missing';
  }
  return (await db.tableCurrent()) ? 'current' : 'outdated';
};

/**
 * Create the email log's table if it is not there, or bring an older one up
 * to date. Safe to press twice, and safe for two people to press at once:
 * whoever loses the race finds the work done and reports it as on. It only
 * creates and adds; it never drops or rewrites anything.
 */
export const switchOnEmailLog = async (
  db: EmailLogDb
): Promise<SwitchOnOutcome> => {
  if (await db.tableExists()) {
    if (await db.tableCurrent()) {
      return 'already_on';
    }
    await db.runTogether(EMAIL_LOG_UPGRADES);
    if (!(await db.tableCurrent())) {
      throw new Error(
        'The update ran but cannot be seen. Nothing else was changed.'
      );
    }
    return 'upgraded';
  }
  try {
    await db.runTogether(EMAIL_LOG_DDL);
  } catch (err) {
    if (await db.tableExists()) {
      return 'already_on';
    }
    throw err;
  }
  // Say "on" only once we have seen it, not because nothing threw.
  if (!(await db.tableExists())) {
    throw new Error(
      'The table was created but cannot be seen. Nothing else was changed.'
    );
  }
  return 'created';
};

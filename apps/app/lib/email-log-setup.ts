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
 * Pure: the database is passed in as a port, so the rules are unit-tested.
 */

/** Resolves the table the same way the CREATE below does (the search path). */
export const EMAIL_LOG_TABLE_EXISTS_SQL = `SELECT to_regclass('"DealEmail"') IS NOT NULL AS "exists"`;

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
];

/** The two things the switch needs from a database. */
export type EmailLogDb = {
  tableExists(): Promise<boolean>;
  /** Run every statement in ONE transaction: all of them, or none. */
  runTogether(statements: readonly string[]): Promise<void>;
};

export type SwitchOnOutcome = 'created' | 'already_on';

/**
 * Create the email log's table if it is not there. Safe to press twice,
 * and safe for two people to press at once: whoever loses the race finds
 * the table there and reports it as on. It only ever creates; it never
 * alters or drops anything.
 */
export const switchOnEmailLog = async (
  db: EmailLogDb
): Promise<SwitchOnOutcome> => {
  if (await db.tableExists()) {
    return 'already_on';
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

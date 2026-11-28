/**
 * Scripts Prisma 6.4.1 really printed (`prisma migrate diff --script`), kept
 * word for word. The tests judge these rather than hand-written SQL, so a
 * change in how Prisma words a step shows up here first.
 */

/**
 * 27 Nov 2026: live database compared with master's schema. `EmailMessage`
 * belonged to an open PR; `DealEmail` was live code's missing table.
 */
export const LIVE_27_NOV = `-- DropTable
DROP TABLE "EmailMessage";

-- DropEnum
DROP TYPE "EmailDeliveryStatus";

-- DropEnum
DROP TYPE "EmailDirection";

-- CreateTable
CREATE TABLE "DealEmail" (
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
);

-- CreateIndex
CREATE UNIQUE INDEX "DealEmail_gmailId_key" ON "DealEmail"("gmailId");

-- CreateIndex
CREATE INDEX "DealEmail_dealId_sentAt_idx" ON "DealEmail"("dealId", "sentAt");

-- CreateIndex
CREATE INDEX "DealEmail_threadKey_idx" ON "DealEmail"("threadKey");

-- CreateIndex
CREATE INDEX "DealEmail_sentAt_idx" ON "DealEmail"("sentAt");
`;

/** One of everything: adds, drops and alterations, some in one statement. */
export const MIXED = `-- CreateEnum
CREATE TYPE "Fresh" AS ENUM ('X');

-- AlterEnum
ALTER TYPE "Colour" ADD VALUE 'GREEN';

-- DropIndex
DROP INDEX "Keep_size_idx";

-- AlterTable
ALTER TABLE "Keep" DROP COLUMN "old",
ADD COLUMN     "added" TEXT,
ADD COLUMN     "f" "Fresh",
ALTER COLUMN "size" SET DATA TYPE TEXT,
ALTER COLUMN "note" SET NOT NULL;

-- DropTable
DROP TABLE "Leaving";

-- DropEnum
DROP TYPE "Gone";

-- CreateTable
CREATE TABLE "Arriving" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Arriving_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Arriving_name_key" ON "Arriving"("name");

-- CreateIndex
CREATE INDEX "Keep_colour_idx" ON "Keep"("colour");
`;

/** Values removed from an enum (rebuilt inside a transaction), a column added. */
export const ENUM_VALUES_REMOVED = `-- AlterEnum
BEGIN;
CREATE TYPE "Colour_new" AS ENUM ('RED', 'TEAL', 'PINK');
ALTER TABLE "Keep" ALTER COLUMN "colour" TYPE "Colour_new" USING ("colour"::text::"Colour_new");
ALTER TYPE "Colour" RENAME TO "Colour_old";
ALTER TYPE "Colour_new" RENAME TO "Colour";
DROP TYPE "Colour_old";
COMMIT;

-- AlterTable
ALTER TABLE "Keep" ADD COLUMN     "extra" INTEGER NOT NULL DEFAULT 0;
`;

/** Two values added to an enum. Prisma adds a prose comment of its own. */
export const ENUM_VALUES_ADDED = `-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Colour" ADD VALUE 'TEAL';
ALTER TYPE "Colour" ADD VALUE 'PINK';
`;

/** What Prisma prints when the database already matches. */
export const NOTHING_TO_DO = `-- This is an empty migration.
`;

import { describe, expect, it } from 'vitest';
import { planMigration } from '../migrate-plan.mjs';
import {
  ENUM_VALUES_ADDED,
  ENUM_VALUES_REMOVED,
  LIVE_27_NOV,
  MIXED,
  NOTHING_TO_DO,
} from './fixtures.mjs';

const ANYTHING_BUT_ADDING =
  /\b(DROP|DELETE|TRUNCATE|RENAME|ALTER COLUMN|BEGIN|COMMIT)\b/i;
const CREATE_AT_LINE_START = /^CREATE /gm;

describe('planMigration', () => {
  describe('the real case: live database against master, 27 Nov 2026', () => {
    const plan = planMigration(LIVE_27_NOV);

    it("sees the other branch's table and types as deletions", () => {
      expect(plan.deletes).toEqual([
        'table "EmailMessage"',
        'type "EmailDeliveryStatus"',
        'type "EmailDirection"',
      ]);
    });

    it('sees the missing table and its indexes as additions', () => {
      expect(plan.adds).toEqual([
        'table "DealEmail"',
        'index "DealEmail_gmailId_key" on table "DealEmail"',
        'index "DealEmail_dealId_sentAt_idx" on table "DealEmail"',
        'index "DealEmail_threadKey_idx" on table "DealEmail"',
        'index "DealEmail_sentAt_idx" on table "DealEmail"',
      ]);
      expect(plan.changes).toEqual([]);
      expect(plan.empty).toBe(false);
    });

    it('offers SQL that only creates, with the table whole', () => {
      expect(plan.addSql).not.toMatch(ANYTHING_BUT_ADDING);
      expect(plan.addSql.match(CREATE_AT_LINE_START)).toHaveLength(5);
      // CREATE TABLE has a blank line before its last clause. Cutting the
      // script at blank lines loses the primary key and the closing bracket.
      expect(plan.addSql).toContain(
        'CONSTRAINT "DealEmail_pkey" PRIMARY KEY ("id")\n);'
      );
    });
  });

  describe('one statement that adds, drops and alters at once', () => {
    const plan = planMigration(MIXED);

    it('lists every deletion, including the dropped column', () => {
      expect(plan.deletes).toEqual([
        'column "old" in table "Keep"',
        'table "Leaving"',
        'type "Gone"',
      ]);
    });

    it('lists every addition', () => {
      expect(plan.adds).toEqual([
        'type "Fresh"',
        'value \'GREEN\' in type "Colour"',
        'column "added" in table "Keep"',
        'column "f" in table "Keep"',
        'table "Arriving"',
        'index "Arriving_name_key" on table "Arriving"',
        'index "Keep_colour_idx" on table "Keep"',
      ]);
    });

    it('files alterations and a lost index as changes, not deletions', () => {
      expect(plan.changes).toEqual([
        'index "Keep_size_idx" (removed)',
        'column "size" in table "Keep" (changed)',
        'column "note" in table "Keep" (changed)',
      ]);
    });

    it('lifts the added columns out of the statement that also drops', () => {
      expect(plan.addSql).toContain(
        'ALTER TABLE "Keep" ADD COLUMN     "added" TEXT,\nADD COLUMN     "f" "Fresh";'
      );
      expect(plan.addSql).not.toMatch(ANYTHING_BUT_ADDING);
    });
  });

  it('counts values removed from an enum as a deletion', () => {
    const plan = planMigration(ENUM_VALUES_REMOVED);
    expect(plan.deletes).toEqual(['one or more values of type "Colour"']);
    expect(plan.adds).toEqual(['column "extra" in table "Keep"']);
    expect(plan.addSql).toBe(
      'ALTER TABLE "Keep" ADD COLUMN     "extra" INTEGER NOT NULL DEFAULT 0;'
    );
  });

  it("reads past Prisma's own prose comments", () => {
    const plan = planMigration(ENUM_VALUES_ADDED);
    expect(plan.adds).toEqual([
      'value \'TEAL\' in type "Colour"',
      'value \'PINK\' in type "Colour"',
    ]);
    expect(plan.deletes).toEqual([]);
    expect(plan.addSql).toBe(
      'ALTER TYPE "Colour" ADD VALUE \'TEAL\';\nALTER TYPE "Colour" ADD VALUE \'PINK\';'
    );
  });

  it('knows when there is nothing to do', () => {
    expect(planMigration(NOTHING_TO_DO)).toEqual({
      empty: true,
      adds: [],
      deletes: [],
      changes: [],
      addSql: '',
    });
    expect(planMigration('').empty).toBe(true);
  });

  it('reads Windows line endings the same as Linux ones', () => {
    for (const script of [LIVE_27_NOV, MIXED, ENUM_VALUES_REMOVED]) {
      expect(planMigration(script.replaceAll('\n', '\r\n'))).toEqual(
        planMigration(script)
      );
    }
  });

  describe('fails closed on SQL it does not recognise', () => {
    it('treats an unfamiliar DROP as a deletion', () => {
      const plan = planMigration(
        '-- SomethingNew\nDROP TABLE IF EXISTS "Deal" CASCADE;\n'
      );
      expect(plan.deletes).toEqual([
        'something not recognised: DROP TABLE IF EXISTS "Deal" CASCADE;',
      ]);
      expect(plan.addSql).toBe('');
    });

    it('treats TRUNCATE and DELETE FROM as deletions', () => {
      expect(planMigration('TRUNCATE "Deal";').deletes).toHaveLength(1);
      expect(planMigration('DELETE FROM "Deal";').deletes).toHaveLength(1);
    });

    it('still judges a script that has lost its step headers', () => {
      const plan = planMigration(
        'CREATE TABLE "A" (\n    "id" TEXT NOT NULL\n);\nDROP TABLE "B";\n'
      );
      expect(plan.empty).toBe(false);
      expect(plan.deletes).toHaveLength(1);
      expect(plan.addSql).toBe('');
    });

    it('offers nothing from an ALTER TABLE it cannot fully read', () => {
      const plan = planMigration(
        '-- AlterTable\nALTER TABLE "Keep" ADD COLUMN     "a" TEXT,\nDROP CONSTRAINT "Keep_pkey";\n'
      );
      expect(plan.adds).toEqual([]);
      expect(plan.addSql).toBe('');
      expect(plan.changes).toHaveLength(1);
    });

    it('is not fooled by a second statement hiding after a CREATE', () => {
      const plan = planMigration(
        '-- CreateIndex\nCREATE INDEX "i" ON "Deal"("a"); DROP TABLE "Deal";\n'
      );
      expect(plan.adds).toEqual([]);
      expect(plan.addSql).toBe('');
      expect(plan.deletes).toHaveLength(1);
    });
  });

  it('does not mistake a name or a default for a keyword', () => {
    const plan = planMigration(
      [
        '-- CreateTable',
        'CREATE TABLE "Truncate" (',
        '    "id" TEXT NOT NULL,',
        '    "note" TEXT NOT NULL DEFAULT \'drop table; delete from\',',
        '',
        '    CONSTRAINT "Truncate_pkey" PRIMARY KEY ("id")',
        ');',
      ].join('\n')
    );
    expect(plan.adds).toEqual(['table "Truncate"']);
    expect(plan.deletes).toEqual([]);
  });
});

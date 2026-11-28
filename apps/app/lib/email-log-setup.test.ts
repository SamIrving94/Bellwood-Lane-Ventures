import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  EMAIL_LOG_DDL,
  EMAIL_LOG_TABLE_CURRENT_SQL,
  EMAIL_LOG_UPGRADES,
  type EmailLogDb,
  emailLogState,
  switchOnEmailLog,
} from './email-log-setup';

const ONLY_CREATES = /^CREATE (TABLE|INDEX|UNIQUE INDEX) "DealEmail/;
const ONLY_ADDS =
  /^(ALTER TABLE "DealEmail" ADD COLUMN IF NOT EXISTS "(\w+)" |CREATE INDEX IF NOT EXISTS "(\w+)" ON "DealEmail")/;
const REMOVES = /\b(DROP|DELETE|TRUNCATE|UPDATE|RENAME)\b/i;
const CHANGES_OR_REMOVES = /\b(DROP|ALTER|DELETE|TRUNCATE|UPDATE)\b/i;
const MODEL_BLOCK = /^model DealEmail \{\n([\s\S]*?)\n\}/m;
const LINE_COMMENT = /\/\/.*$/;
const SPACES = /\s+/;
const COLUMN_NAMES = /^\s+"(\w+)" /gm;
const INDEX_FIELDS = /\[(.*)\]/;
const INDEX_NAME = /INDEX "(\w+)"/;
const WINDOWS_LINE_ENDINGS = /\r\n/g;

/**
 * A database that is two flags (is there a table, is it current), and
 * remembers what it was asked to run. Running anything leaves both true.
 */
const fakeDb = (opts: {
  exists: boolean;
  current?: boolean;
  failWith?: Error;
}) => {
  const state = {
    exists: opts.exists,
    current: opts.current ?? opts.exists,
    runs: [] as (readonly string[])[],
  };
  const db: EmailLogDb = {
    tableExists: () => Promise.resolve(state.exists),
    tableCurrent: () => Promise.resolve(state.exists && state.current),
    runTogether: (statements) => {
      state.runs.push(statements);
      if (opts.failWith) {
        return Promise.reject(opts.failWith);
      }
      state.exists = true;
      state.current = true;
      return Promise.resolve();
    },
  };
  return { db, state };
};

describe('switchOnEmailLog', () => {
  it('creates the table when it is missing, in one go', async () => {
    const { db, state } = fakeDb({ exists: false });
    expect(await switchOnEmailLog(db)).toBe('created');
    expect(state.runs).toEqual([EMAIL_LOG_DDL]);
  });

  it('touches nothing when the table is already there and current', async () => {
    const { db, state } = fakeDb({ exists: true });
    expect(await switchOnEmailLog(db)).toBe('already_on');
    expect(state.runs).toEqual([]);
  });

  it('brings an older table up to date, in one go', async () => {
    const { db, state } = fakeDb({ exists: true, current: false });
    expect(await switchOnEmailLog(db)).toBe('upgraded');
    expect(state.runs).toEqual([EMAIL_LOG_UPGRADES]);
    expect(await switchOnEmailLog(db)).toBe('already_on');
    expect(state.runs).toHaveLength(1);
  });

  it('a failed update is passed on, not reported as on', async () => {
    const { db } = fakeDb({
      exists: true,
      current: false,
      failWith: new Error('lock timeout'),
    });
    await expect(switchOnEmailLog(db)).rejects.toThrow('lock timeout');
  });

  it('does not say "up to date" unless it can be seen afterwards', async () => {
    const db: EmailLogDb = {
      tableExists: () => Promise.resolve(true),
      tableCurrent: () => Promise.resolve(false),
      runTogether: () => Promise.resolve(),
    };
    await expect(switchOnEmailLog(db)).rejects.toThrow('cannot be seen');
  });

  it('tells the pages which wording to show', async () => {
    expect(await emailLogState(fakeDb({ exists: false }).db)).toBe('missing');
    expect(
      await emailLogState(fakeDb({ exists: true, current: false }).db)
    ).toBe('outdated');
    expect(await emailLogState(fakeDb({ exists: true }).db)).toBe('current');
  });

  it('pressed twice: the second press does nothing', async () => {
    const { db, state } = fakeDb({ exists: false });
    await switchOnEmailLog(db);
    expect(await switchOnEmailLog(db)).toBe('already_on');
    expect(state.runs).toHaveLength(1);
  });

  it('two people at once: the one who loses the race reports it as on', async () => {
    const state = { exists: false };
    const db: EmailLogDb = {
      tableExists: () => Promise.resolve(state.exists),
      tableCurrent: () => Promise.resolve(state.exists),
      runTogether: () => {
        // Someone else's transaction committed first; ours fails on the name.
        state.exists = true;
        return Promise.reject(new Error('relation "DealEmail" already exists'));
      },
    };
    expect(await switchOnEmailLog(db)).toBe('already_on');
  });

  it('a real failure is passed on, not reported as on', async () => {
    const { db } = fakeDb({
      exists: false,
      failWith: new Error('permission denied for schema public'),
    });
    await expect(switchOnEmailLog(db)).rejects.toThrow('permission denied');
  });

  it('does not say "on" unless the table can be seen afterwards', async () => {
    const db: EmailLogDb = {
      tableExists: () => Promise.resolve(false),
      tableCurrent: () => Promise.resolve(false),
      runTogether: () => Promise.resolve(),
    };
    await expect(switchOnEmailLog(db)).rejects.toThrow('cannot be seen');
  });
});

describe('EMAIL_LOG_UPGRADES', () => {
  it('only ever adds, and is safe to run twice', () => {
    for (const sql of EMAIL_LOG_UPGRADES) {
      expect(sql).toMatch(ONLY_ADDS);
      expect(sql).not.toMatch(REMOVES);
      expect(sql).not.toContain(';');
    }
  });

  // A fresh table must not need an upgrade, and the "is it current" check
  // must look for exactly what the upgrades add.
  it('everything it adds is already in the CREATE, and is what the check looks for', () => {
    const create = EMAIL_LOG_DDL.join('\n');
    for (const sql of EMAIL_LOG_UPGRADES) {
      const m = sql.match(ONLY_ADDS);
      const column = m?.[2];
      const index = m?.[3];
      if (column) {
        expect(create).toContain(`"${column}" `);
        expect(EMAIL_LOG_TABLE_CURRENT_SQL).toContain(`'${column}'`);
      }
      if (index) {
        expect(create).toContain(`INDEX "${index}"`);
        expect(EMAIL_LOG_TABLE_CURRENT_SQL).toContain(`"${index}"`);
      }
    }
  });
});

describe('EMAIL_LOG_DDL', () => {
  it('only ever creates', () => {
    for (const sql of EMAIL_LOG_DDL) {
      expect(sql).toMatch(ONLY_CREATES);
      expect(sql).not.toMatch(CHANGES_OR_REMOVES);
      // One statement each: a stray semicolon would smuggle in a second.
      expect(sql).not.toContain(';');
    }
  });

  // The button is only right while it builds the table the Prisma model
  // describes. If someone adds a field or an index to `DealEmail`, this
  // fails until the statements here are regenerated to match.
  describe('matches the DealEmail model in schema.prisma', () => {
    // Git on Windows checks the schema out with CRLF line endings. Read as
    // is, the model is never found and this fails on Windows only, which
    // blocks every push from a Windows machine at the pre-push build.
    const schema = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        '../../../packages/database/prisma/schema.prisma'
      ),
      'utf-8'
    ).replace(WINDOWS_LINE_ENDINGS, '\n');
    const model = schema.match(MODEL_BLOCK)?.[1];
    const lines = (model ?? '')
      .split('\n')
      .map((l) => l.replace(LINE_COMMENT, '').trim())
      .filter((l) => l.length > 0);
    const fields = lines
      .filter((l) => !l.startsWith('@@'))
      .map((l) => l.split(SPACES))
      // `deal Deal? @relation(...)` is the relation, not a column.
      .filter(([, type]) => !type?.startsWith('Deal'));

    it('found the model', () => {
      expect(model).toBeDefined();
      expect(fields.length).toBeGreaterThan(10);
    });

    it('has the same columns, in the same order', () => {
      const columns = Array.from(
        (EMAIL_LOG_DDL[0] ?? '').matchAll(COLUMN_NAMES)
      ).map((m) => m[1]);
      expect(columns).toEqual(fields.map(([name]) => name));
    });

    it('makes a column NOT NULL exactly when the field is required', () => {
      for (const [name, type] of fields) {
        const column = (EMAIL_LOG_DDL[0] ?? '').match(
          new RegExp(`"${name}" (.*),`)
        )?.[1];
        // Lists are never NOT NULL in Prisma's SQL; they default to empty.
        const required = !(type?.endsWith('?') || type?.endsWith('[]'));
        expect(column?.includes('NOT NULL'), name).toBe(required);
      }
    });

    it('has the same indexes', () => {
      const wanted = [
        ...fields
          .filter((parts) => parts.includes('@unique'))
          .map(([name]) => `DealEmail_${name}_key`),
        ...lines
          .filter((l) => l.startsWith('@@index'))
          .map(
            (l) =>
              `DealEmail_${(l.match(INDEX_FIELDS)?.[1] ?? '')
                .split(',')
                .map((f) => f.trim())
                .join('_')}_idx`
          ),
      ];
      const made = EMAIL_LOG_DDL.slice(1).map(
        (sql) => sql.match(INDEX_NAME)?.[1]
      );
      expect(made.sort()).toEqual(wanted.sort());
    });
  });
});

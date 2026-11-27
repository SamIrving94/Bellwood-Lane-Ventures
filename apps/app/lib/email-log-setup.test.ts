import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  EMAIL_LOG_DDL,
  type EmailLogDb,
  switchOnEmailLog,
} from './email-log-setup';

const ONLY_CREATES = /^CREATE (TABLE|INDEX|UNIQUE INDEX) "DealEmail/;
const CHANGES_OR_REMOVES = /\b(DROP|ALTER|DELETE|TRUNCATE|UPDATE)\b/i;
const MODEL_BLOCK = /^model DealEmail \{\n([\s\S]*?)\n\}/m;
const LINE_COMMENT = /\/\/.*$/;
const SPACES = /\s+/;
const COLUMN_NAMES = /^\s+"(\w+)" /gm;
const INDEX_FIELDS = /\[(.*)\]/;
const INDEX_NAME = /INDEX "(\w+)"/;
const WINDOWS_LINE_ENDINGS = /\r\n/g;

/** A database that is just a flag, and remembers what it was asked to run. */
const fakeDb = (opts: { exists: boolean; failWith?: Error }) => {
  const state = { exists: opts.exists, runs: [] as (readonly string[])[] };
  const db: EmailLogDb = {
    tableExists: () => Promise.resolve(state.exists),
    runTogether: (statements) => {
      state.runs.push(statements);
      if (opts.failWith) {
        return Promise.reject(opts.failWith);
      }
      state.exists = true;
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

  it('touches nothing when the table is already there', async () => {
    const { db, state } = fakeDb({ exists: true });
    expect(await switchOnEmailLog(db)).toBe('already_on');
    expect(state.runs).toEqual([]);
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
      runTogether: () => Promise.resolve(),
    };
    await expect(switchOnEmailLog(db)).rejects.toThrow('cannot be seen');
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

import { describe, expect, it } from 'vitest';
import {
  describeTarget,
  findDatabaseUrl,
  readMode,
  runMigrate,
} from '../migrate-run.mjs';
import { LIVE_27_NOV, MIXED, NOTHING_TO_DO } from './fixtures.mjs';

const ADDS_ONLY = `-- CreateTable
CREATE TABLE "Arriving" (
    "id" TEXT NOT NULL,

    CONSTRAINT "Arriving_pkey" PRIMARY KEY ("id")
);
`;

const LIVE = { label: 'db.example.test/neondb', placeholder: false };
const PLACEHOLDER = { label: 'localhost:5432/test', placeholder: true };
const DELETING_SQL = /\b(DROP|DELETE|TRUNCATE)\b/i;

/**
 * A stand-in for the Prisma CLI. It answers each "what would a push do?"
 * with the next script in `previews` (the last one repeats), and remembers
 * every command it was asked to run.
 */
const fakePrisma = ({ previews, fail = {} }) => {
  const calls = [];
  let asked = 0;
  const prisma = (args, options = {}) => {
    const command = args.slice(0, 2).join(' ');
    calls.push({ command, input: options.input });
    if (fail[command]) {
      return { status: 1, stdout: '', stderr: fail[command] };
    }
    if (command === 'migrate diff') {
      const stdout = previews[Math.min(asked, previews.length - 1)];
      asked += 1;
      return { status: 0, stdout, stderr: '' };
    }
    return { status: 0, stdout: '', stderr: '' };
  };
  return { prisma, calls, commands: () => calls.map((call) => call.command) };
};

const run = (args, fake, target = LIVE) => {
  const said = [];
  const code = runMigrate({
    args,
    prisma: fake.prisma,
    say: (message) => said.push(message),
    target,
  });
  return { code, said: said.join('\n') };
};

describe('pnpm migrate', () => {
  it('stops, and never pushes, when something would be deleted', () => {
    const fake = fakePrisma({ previews: [LIVE_27_NOV] });
    const { code, said } = run([], fake);
    expect(code).toBe(1);
    expect(fake.commands()).toEqual(['format', 'generate', 'migrate diff']);
    expect(said).toContain('Stopped. Nothing in the database was changed.');
    expect(said).toContain('table "EmailMessage"');
    expect(said).toContain('table "DealEmail"');
    expect(said).toContain('pnpm migrate:add-only');
  });

  it('pushes when nothing would be deleted', () => {
    const fake = fakePrisma({ previews: [ADDS_ONLY] });
    expect(run([], fake).code).toBe(0);
    expect(fake.commands()).toEqual([
      'format',
      'generate',
      'migrate diff',
      'db push',
    ]);
  });

  it("passes on Prisma's own refusal", () => {
    const fake = fakePrisma({
      previews: [ADDS_ONLY],
      fail: { 'db push': 'data loss' },
    });
    expect(run([], fake).code).toBe(1);
  });

  it('does nothing when the database already matches', () => {
    const fake = fakePrisma({ previews: [NOTHING_TO_DO] });
    const { code, said } = run([], fake);
    expect(code).toBe(0);
    expect(fake.commands()).not.toContain('db push');
    expect(said).toContain('already matches');
  });

  it('says which database it is looking at', () => {
    const fake = fakePrisma({ previews: [NOTHING_TO_DO] });
    expect(run([], fake).said).toContain('Database: db.example.test/neondb');
  });

  it('changes nothing when the database cannot be read', () => {
    const fake = fakePrisma({
      previews: [],
      fail: { 'migrate diff': "Can't reach database server" },
    });
    const { code, said } = run([], fake, PLACEHOLDER);
    expect(code).toBe(1);
    expect(fake.commands()).not.toContain('db push');
    expect(said).toContain('Could not read the database');
    expect(said).toContain("Can't reach database server");
    expect(said).toContain('local placeholder');
  });

  it('does not look at the database if the schema file is broken', () => {
    const fake = fakePrisma({
      previews: [ADDS_ONLY],
      fail: { format: 'schema error' },
    });
    expect(run([], fake).code).toBe(1);
    expect(fake.commands()).toEqual(['format']);
  });

  it('rejects a flag it does not know, before touching anything', () => {
    const fake = fakePrisma({ previews: [ADDS_ONLY] });
    const { code, said } = run(['--force'], fake);
    expect(code).toBe(2);
    expect(fake.calls).toEqual([]);
    expect(said).toContain('pnpm migrate:check');
  });
});

describe('pnpm migrate --allow-deletes', () => {
  it('pushes even though something would be deleted', () => {
    const fake = fakePrisma({ previews: [LIVE_27_NOV] });
    expect(run(['--allow-deletes'], fake).code).toBe(0);
    expect(fake.commands().at(-1)).toBe('db push');
  });
});

describe('pnpm migrate:check', () => {
  it('only looks: no format, no generate, no push', () => {
    const fake = fakePrisma({ previews: [MIXED] });
    const { code, said } = run(['--check'], fake);
    expect(code).toBe(0);
    expect(fake.commands()).toEqual(['migrate diff']);
    expect(said).toContain('Going ahead would ADD:');
    expect(said).toContain('Going ahead would DELETE:');
    expect(said).toContain('Going ahead would CHANGE:');
    expect(said).toContain('column "old" in table "Keep"');
  });
});

describe('pnpm migrate:add-only', () => {
  // After the additions, only the deletions are left to do.
  const AFTER = `-- DropTable
DROP TABLE "EmailMessage";
`;

  it('adds what is new in one transaction, and never pushes', () => {
    const fake = fakePrisma({ previews: [LIVE_27_NOV, AFTER] });
    const { code, said } = run(['--add-only'], fake);
    expect(code).toBe(0);
    expect(fake.commands()).toEqual([
      'format',
      'generate',
      'migrate diff',
      'db execute',
      'migrate diff',
    ]);
    const { input } = fake.calls[3];
    expect(input.startsWith('BEGIN;\n')).toBe(true);
    expect(input.endsWith('COMMIT;\n')).toBe(true);
    expect(input).toContain('CREATE TABLE "DealEmail"');
    expect(input).not.toMatch(DELETING_SQL);
    expect(said).toContain('Added, and checked');
    expect(said).toContain('Left alone, not deleted:');
    expect(said).toContain('table "EmailMessage"');
  });

  it('reports a refusal, having checked that nothing was added', () => {
    const fake = fakePrisma({
      previews: [LIVE_27_NOV],
      fail: { 'db execute': 'relation "DealEmail" already exists' },
    });
    const { code, said } = run(['--add-only'], fake);
    expect(code).toBe(1);
    expect(said).toContain('Nothing was added.');
    expect(said).toContain('already exists');
  });

  it('does not claim success if the additions are still missing', () => {
    // Prisma reported success, but the second look says otherwise.
    const fake = fakePrisma({ previews: [LIVE_27_NOV] });
    const { code, said } = run(['--add-only'], fake);
    expect(code).toBe(1);
    expect(said).toContain('Still missing:');
  });

  it('runs nothing when there is nothing to add', () => {
    const fake = fakePrisma({ previews: [AFTER] });
    const { code, said } = run(['--add-only'], fake);
    expect(code).toBe(0);
    expect(fake.commands()).not.toContain('db execute');
    expect(said).toContain('Nothing new to add.');
    expect(said).toContain('table "EmailMessage"');
  });
});

describe('readMode', () => {
  it('reads each flag, and a bare -- from pnpm', () => {
    expect(readMode([])).toBe('push');
    expect(readMode(['--check'])).toBe('check');
    expect(readMode(['--', '--add-only'])).toBe('add-only');
    expect(readMode(['--allow-deletes'])).toBe('allow-deletes');
  });

  it('refuses unknown or combined flags', () => {
    expect(readMode(['--accept-data-loss'])).toBeNull();
    expect(readMode(['--check', '--allow-deletes'])).toBeNull();
    expect(readMode(['toString'])).toBeNull();
  });
});

describe('findDatabaseUrl', () => {
  it('prefers the environment, as Prisma does', () => {
    expect(
      findDatabaseUrl({ DATABASE_URL: 'from-env' }, 'DATABASE_URL="from-file"')
    ).toBe('from-env');
  });

  it('reads the .env file, quoted or not, on either line ending', () => {
    expect(findDatabaseUrl({}, 'DATABASE_URL="postgresql://a/b"\r\n')).toBe(
      'postgresql://a/b'
    );
    expect(
      findDatabaseUrl({}, 'OTHER=1\nDATABASE_URL=postgresql://a/b\n')
    ).toBe('postgresql://a/b');
  });

  it('is undefined when there is none', () => {
    expect(findDatabaseUrl({}, '')).toBeUndefined();
    expect(findDatabaseUrl({}, 'OTHER=1')).toBeUndefined();
  });
});

describe('describeTarget', () => {
  it('shows host and database, never the user name or password', () => {
    const target = describeTarget(
      'postgresql://owner:s3cret@ep-example-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
    );
    expect(target).toEqual({
      label: 'ep-example-pooler.eu-west-2.aws.neon.tech/neondb',
      placeholder: false,
    });
    expect(target.label).not.toContain('s3cret');
    expect(target.label).not.toContain('owner');
  });

  it('recognises the local placeholder', () => {
    expect(
      describeTarget('postgresql://test:test@localhost:5432/test')
    ).toEqual({ label: 'localhost:5432/test', placeholder: true });
  });

  it('copes with a missing or unreadable address', () => {
    expect(describeTarget(undefined).label).toBe('not set');
    expect(describeTarget('not a url').placeholder).toBe(false);
  });
});

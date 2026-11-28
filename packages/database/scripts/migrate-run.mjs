/**
 * The decisions behind `pnpm migrate`: look at what a schema push would do,
 * and refuse to delete anything unless told to.
 *
 *   pnpm migrate                   stop if anything would be deleted
 *   pnpm migrate:check             show what would happen, change nothing
 *   pnpm migrate:add-only          add what is new, leave everything else
 *   pnpm migrate --allow-deletes   push as before, for a deletion you mean
 *
 * `migrate-plan.mjs` explains why. This file holds the order of events and
 * takes Prisma as an argument, so the tests can prove what matters without a
 * database: when a deletion is pending, `db push` is never called.
 */

import { planMigration } from './migrate-plan.mjs';

const SCHEMA = 'prisma/schema.prisma';
// Read-only: compares the live database with the schema file and prints the
// SQL a push would run. It changes nothing.
const PREVIEW = [
  'migrate',
  'diff',
  '--from-schema-datasource',
  SCHEMA,
  '--to-schema-datamodel',
  SCHEMA,
  '--script',
];

const MODES = {
  '--check': 'check',
  '--add-only': 'add-only',
  '--allow-deletes': 'allow-deletes',
};

const COMMANDS = [
  'pnpm migrate                   stop if anything would be deleted',
  'pnpm migrate:check             show what would happen, change nothing',
  'pnpm migrate:add-only          add what is new, delete nothing',
  'pnpm migrate --allow-deletes   go ahead, only if the deletions are meant',
];
const USAGE = COMMANDS.join('\n');
// Shown when plain `pnpm migrate` has just stopped: the three other ways on.
const WAYS_ON = COMMANDS.slice(1)
  .map((line) => `  ${line}`)
  .join('\n');

const WHY_NOT_DELETE = [
  'Something that is in the database but not in this branch usually belongs',
  'to work that has not been merged yet. Deleting it would break that work.',
].join('\n');

const PLACEHOLDER_HINT =
  'That address is the local placeholder in packages/database/.env, not the live database.';

const DATABASE_URL_LINE = /^\s*DATABASE_URL\s*=\s*(.*?)\s*$/m;
const WRAPPING_QUOTES = /^(['"])(.*)\1$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * The address Prisma will use: the environment first, then the package's
 * `.env`, the same order Prisma follows. Resolved here so the address shown
 * to the person is the address that is used.
 */
export function findDatabaseUrl(env, envFileText = '') {
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }
  const line = envFileText.match(DATABASE_URL_LINE)?.[1] ?? '';
  const value = line.replace(WRAPPING_QUOTES, '$2');
  return value === '' ? undefined : value;
}

/** Host and database name only. Never the user name or the password. */
export function describeTarget(url) {
  if (!url) {
    return { label: 'not set', placeholder: false };
  }
  try {
    const { host, hostname, pathname } = new URL(url);
    return {
      label: `${host}${pathname}`,
      placeholder: LOCAL_HOSTS.has(hostname),
    };
  } catch {
    return { label: 'an address that could not be read', placeholder: false };
  }
}

/** @returns {'push' | 'check' | 'add-only' | 'allow-deletes' | null} */
export function readMode(args) {
  // Some pnpm versions hand a bare `--` through to the script.
  const flags = args.filter((arg) => arg !== '--');
  if (flags.length === 0) {
    return 'push';
  }
  if (flags.length > 1 || !Object.hasOwn(MODES, flags[0])) {
    return null;
  }
  return MODES[flags[0]];
}

const list = (items) => items.map((item) => `  - ${item}`).join('\n');

const section = (title, items) =>
  items.length > 0 ? `\n${title}\n${list(items)}` : '';

const report = (plan) =>
  [
    section('Going ahead would ADD:', plan.adds),
    section('Going ahead would DELETE:', plan.deletes),
    section('Going ahead would CHANGE:', plan.changes),
  ]
    .filter(Boolean)
    .join('\n');

const stopped = (plan) =>
  [
    '\nStopped. Nothing in the database was changed.',
    section('Going ahead would DELETE:', plan.deletes),
    `\n${WHY_NOT_DELETE}`,
    section('It would also ADD:', plan.adds),
    section('And CHANGE:', plan.changes),
    `\nWhat you can do:\n${WAYS_ON}`,
  ]
    .filter(Boolean)
    .join('\n');

const leftAlone = (plan) =>
  [
    section('Left alone, not deleted:', plan.deletes),
    section('Not done, because it alters something that exists:', plan.changes),
  ]
    .filter(Boolean)
    .join('\n');

/** Runs the read-only comparison. Null when the database cannot be read. */
const preview = (prisma) => {
  const result = prisma(PREVIEW, { capture: true });
  return result.status === 0
    ? { plan: planMigration(result.stdout), error: '' }
    : { plan: null, error: result.stderr.trim() };
};

const cannotRead = (target, error) =>
  [
    '\nCould not read the database. Nothing in the database was changed.',
    target.placeholder ? PLACEHOLDER_HINT : '',
    error === '' ? '' : `\n${error}`,
  ]
    .filter(Boolean)
    .join('\n');

/**
 * Adds what is new and nothing else. One transaction, so a failure part-way
 * adds nothing. It does not take that on trust: afterwards it compares the
 * database with the schema again and reports what it actually finds.
 */
const addOnly = ({ plan, prisma, say }) => {
  if (plan.addSql === '') {
    say(['\nNothing new to add.', leftAlone(plan)].filter(Boolean).join('\n'));
    return 0;
  }
  const applied = prisma(['db', 'execute', '--stdin', '--schema', SCHEMA], {
    capture: true,
    input: `BEGIN;\n\n${plan.addSql}\n\nCOMMIT;\n`,
  });
  const after = preview(prisma).plan;
  if (after === null) {
    say(
      '\nCould not check the database afterwards. Run pnpm migrate:check to see where it stands.'
    );
    return 1;
  }
  const missing = plan.adds.filter((item) => after.adds.includes(item));
  if (applied.status === 0 && missing.length === 0) {
    say(
      [
        section(
          'Added, and checked that it is now in the database:',
          plan.adds
        ),
        leftAlone(plan),
      ]
        .filter(Boolean)
        .join('\n')
    );
    return 0;
  }
  say(
    [
      missing.length === plan.adds.length
        ? '\nThe additions did not go in. Nothing was added.'
        : '\nOnly part was added.',
      section('Still missing:', missing),
      applied.stderr.trim() === '' ? '' : `\n${applied.stderr.trim()}`,
    ]
      .filter(Boolean)
      .join('\n')
  );
  return 1;
};

/** Tidy the schema file and rebuild the client, as `pnpm migrate` always has. */
const prepare = (prisma) =>
  prisma(['format']).status === 0 && prisma(['generate']).status === 0;

/**
 * @param {object} deps
 * @param {string[]} deps.args      command-line flags
 * @param {Function} deps.prisma    runs the Prisma CLI: (args, options) =>
 *                                  ({ status, stdout, stderr })
 * @param {Function} deps.say       prints a message
 * @param {{ label: string, placeholder: boolean }} deps.target
 * @returns {number} the exit code
 */
export function runMigrate({ args, prisma, say, target }) {
  const mode = readMode(args);
  if (mode === null) {
    say(USAGE);
    return 2;
  }
  say(`Database: ${target.label}`);
  if (mode !== 'check' && !prepare(prisma)) {
    return 1;
  }
  const { plan, error } = preview(prisma);
  if (plan === null) {
    say(cannotRead(target, error));
    return 1;
  }
  if (plan.empty) {
    say('\nThe database already matches the schema. Nothing to do.');
    return 0;
  }
  if (mode === 'check') {
    say(report(plan));
    return 0;
  }
  if (mode === 'add-only') {
    return addOnly({ plan, prisma, say });
  }
  if (plan.deletes.length > 0 && mode !== 'allow-deletes') {
    say(stopped(plan));
    return 1;
  }
  // Nothing would be deleted (or the deletions are meant). Prisma's own
  // check still applies: it refuses to drop anything that holds rows.
  return prisma(['db', 'push']).status;
}

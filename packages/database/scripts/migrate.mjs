#!/usr/bin/env node
/**
 * Entry point for `pnpm migrate` and its two variants. All it does is wire
 * the real Prisma CLI and the real `.env` into `runMigrate`; the decisions
 * live in `migrate-run.mjs` and `migrate-plan.mjs`, where they are tested.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeTarget, findDatabaseUrl, runMigrate } from './migrate-run.mjs';

const DATABASE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = resolve(DATABASE_DIR, '.env');

const url = findDatabaseUrl(
  process.env,
  existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf-8') : ''
);

// This package's own Prisma, run with the Node that is running this script.
// No shell and no `npx`, so it behaves the same on Windows and Linux and can
// never pick up a globally installed Prisma that does not match the schema.
const prismaCli = createRequire(resolve(DATABASE_DIR, 'package.json')).resolve(
  'prisma/build/index.js'
);

const env = {
  ...process.env,
  // Prisma's "update available" box is noise here, and must never end up
  // inside the SQL this script reads back.
  PRISMA_HIDE_UPDATE_MESSAGE: '1',
  ...(url ? { DATABASE_URL: url } : {}),
};

const prisma = (args, { capture = false, input } = {}) => {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: DATABASE_DIR,
    env,
    encoding: 'utf-8',
    input,
    stdio: capture ? 'pipe' : 'inherit',
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
};

process.exitCode = runMigrate({
  args: process.argv.slice(2),
  prisma,
  say: (message) => process.stdout.write(`${message}\n`),
  target: describeTarget(url),
});

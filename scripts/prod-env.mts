/**
 * Load production env vars from a local `vercel env pull` file into
 * process.env for one-off scripts/*.mts runs.
 *
 * Reads `.env.production.local` in the repo root (override with
 * PROD_ENV_FILE). Only fills keys that are NOT already set, and never prints
 * a value — callers get key NAMES only. Fails loudly when DATABASE_URL ends
 * up missing or pointing at localhost (the dev-dummy value): a maintenance
 * script silently running against nothing is worse than one that stops.
 */

import { existsSync, readFileSync } from 'node:fs';

export function loadProdEnv(): { loadedKeys: string[]; file: string } {
  const file = process.env.PROD_ENV_FILE ?? '.env.production.local';
  const loadedKeys: string[] = [];

  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf-8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=("?)(.*)\2\s*$/);
      if (!m) {
        continue;
      }
      const key = m[1] as string;
      if (!process.env[key]) {
        process.env[key] = m[3];
        loadedKeys.push(key);
      }
    }
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!dbUrl) {
    throw new Error(
      `DATABASE_URL not set and not found in ${file} — run \`npx vercel env pull --environment=production --yes ${file}\` first.`
    );
  }
  if (dbUrl.includes('localhost')) {
    throw new Error(
      'DATABASE_URL points at localhost — that is the dev-dummy value, not production. Refusing to run against it.'
    );
  }

  return { loadedKeys, file };
}

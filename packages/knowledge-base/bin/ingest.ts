#!/usr/bin/env tsx
/**
 * One-shot ingester CLI.
 *
 *   pnpm --filter @repo/knowledge-base ingest
 *
 * Walks `docs/**` and `docs/templates/**` from the repo root (auto-detected
 * by walking up from this script's path), chunks + embeds + upserts.
 * Idempotent — unchanged files are detected by SHA-256 of body and skipped
 * without an embed call.
 *
 * Requires:
 *   - VOYAGE_API_KEY  (preferred) OR OPENAI_API_KEY (fallback)
 *   - DATABASE_URL    (Neon connection string, used by @repo/database)
 *   - pgvector extension enabled on the Neon DB:
 *         CREATE EXTENSION IF NOT EXISTS vector;
 *   - schema applied:
 *         pnpm --filter @repo/database build && pnpm --filter @repo/database prisma db push
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingest } from '../src/ingest';

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  // Walk up until we find pnpm-workspace.yaml. We stop after a generous
  // number of hops just to make sure we don't recurse forever in an
  // unexpected layout (e.g. someone moves this package out of the repo).
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not locate repo root (no pnpm-workspace.yaml found above ${startDir}).`,
  );
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = findRepoRoot(here);
  const docsRoot = resolve(repoRoot, 'docs');

  // We pass a single root — the walker already recurses into templates/
  // setup/ prds/ proposals/ marketing/ etc. Listing extra dirs here would
  // double-scan them.
  const result = await ingest({
    rootDir: repoRoot,
    docsDirs: [docsRoot],
  });

  process.stdout.write(
    JSON.stringify(
      {
        ok: result.errors.length === 0,
        ...result,
      },
      null,
      2,
    ) + '\n',
  );

  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  process.stderr.write(`\nIngest failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

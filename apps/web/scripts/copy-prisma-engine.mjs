/**
 * Copy the Linux Prisma query engine into apps/web/generated/client — the
 * FIRST location the bundled client searches at runtime
 * (/var/task/apps/web/generated/client).
 *
 * Why this exists: Keyhole (6 Sep 2026) is the first apps/web route that
 * touches the database at runtime, and every report 500'd with
 * PrismaClientInitializationError — the engine never reached the lambda.
 * The client is generated OUTSIDE node_modules (packages/database/generated/
 * client), where neither Next's file tracing nor the Prisma webpack plugin
 * reliably lands it somewhere web's chunk layout actually searches. Copying
 * it INSIDE the app directory before `next build` makes the path
 * unambiguous: project-relative, traced by the plain
 * `generated/client/**` include in next.config.ts, deployed to the exact
 * directory Prisma probes first.
 *
 * Runs via the web `build` script, after @repo/database#build has generated
 * the client (turbo dependsOn ^build). Fails LOUDLY if the engine is
 * missing — a silent skip here is a broken lambda later.
 */

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const engine = 'libquery_engine-rhel-openssl-3.0.x.so.node';
const src = join(
  here,
  '..',
  '..',
  '..',
  'packages',
  'database',
  'generated',
  'client',
  engine
);
const destDir = join(here, '..', 'generated', 'client');

if (!existsSync(src)) {
  // On a machine that generated the client without the rhel target the
  // build must stop here — shipping web without the engine is exactly the
  // production failure this script exists to prevent.
  console.error(
    `[copy-prisma-engine] ${engine} not found at ${src}. ` +
      'Run `pnpm exec prisma generate` in packages/database first ' +
      '(binaryTargets includes rhel-openssl-3.0.x, so it is always emitted).'
  );
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, engine));
console.log(`[copy-prisma-engine] ${engine} → apps/web/generated/client/`);

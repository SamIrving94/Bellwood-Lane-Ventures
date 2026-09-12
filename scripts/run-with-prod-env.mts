/**
 * Run another scripts/*.mts file with production env loaded first.
 *
 *   npx tsx scripts/run-with-prod-env.mts scripts/seed-london-prime.mts --districts=E11
 *
 * Exists because dotenv-cli + nested npx drops the target script's flags on
 * Windows (observed 2026-09-06: `--districts` AND `--write` never reached
 * seed-london-prime, which then planned all 33 tier-1 districts). This
 * wrapper dynamic-imports the target in-process, so process.argv reaches it
 * untouched — target scripts read argv.slice(2) and ignore non-flag entries.
 */

import { pathToFileURL } from 'node:url';
import { loadProdEnv } from './prod-env.mts';

const target = process.argv[2];
if (!target || target.startsWith('--')) {
  throw new Error(
    'usage: npx tsx scripts/run-with-prod-env.mts <script.mts> [script args]'
  );
}

const { loadedKeys, file } = loadProdEnv();
console.log(
  `[prod-env] loaded ${loadedKeys.length} keys from ${file} (values not shown)`
);

await import(pathToFileURL(target).href);

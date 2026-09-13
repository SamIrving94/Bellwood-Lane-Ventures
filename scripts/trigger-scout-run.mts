/**
 * One-off: trigger the production scouting cron once, founder-directed.
 *
 * Mirrors triggerScoutNow in settings/scouting/areas-actions.ts: POST to
 * /cron/scouting on bellwood-api with the CRON_SECRET bearer. The run can
 * take up to ~13 minutes; a client timeout here does NOT stop the function —
 * poll with scripts/watch-scout-run.mts afterwards.
 *
 *   npx tsx scripts/trigger-scout-run.mts
 *
 * Prints the HTTP status and response body only — never the secret.
 */

import { loadProdEnv } from './prod-env.mts';

loadProdEnv();

const secret = process.env.CRON_SECRET;
if (!secret) {
  throw new Error('CRON_SECRET not found in the pulled env — stopping.');
}

console.log(`Triggering scout at ${new Date().toISOString()} …`);

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 900_000);
try {
  const res = await fetch('https://bellwood-api.vercel.app/cron/scouting', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
    signal: controller.signal,
  });
  const body = await res.text();
  console.log(`HTTP ${res.status}`);
  console.log(body.slice(0, 6000));
} catch (err) {
  console.log(
    `Request ended without a response (${err instanceof Error ? err.name : 'error'}) — the function keeps running server-side. Poll with scripts/watch-scout-run.mts.`
  );
} finally {
  clearTimeout(timer);
}

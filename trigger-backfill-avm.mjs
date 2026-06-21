/**
 * Re-runs the AVM over every existing deal and rewrites the stored values in
 * correct pence (fixes the old 100x pounds-vs-pence bug). Loops the batched
 * admin route until nothing remains.
 *
 * Usage:
 *   node trigger-backfill-avm.mjs                 # against production app
 *   BASE=http://localhost:3000 node trigger-backfill-avm.mjs   # local
 */
import fs from 'node:fs';

const envText = fs.readFileSync('.env.local', 'utf8');
const CRON = envText
  .match(/^CRON_SECRET=(.*)$/m)[1]
  .trim()
  .replace(/^["']|["']$/g, '');

const BASE = process.env.BASE ?? 'https://bellwood-app.vercel.app';
const TAKE = Number(process.env.TAKE ?? 15);

let skip = 0;
let totalUpdated = 0;
let totalFailed = 0;

for (;;) {
  const url = `${BASE}/api/admin/backfill-avm?skip=${skip}&take=${TAKE}`;
  const t0 = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + CRON },
  });
  const ms = ((Date.now() - t0) / 1000).toFixed(1);

  if (!res.ok) {
    console.error('HTTP', res.status, await res.text());
    process.exit(1);
  }

  const body = await res.json();
  totalUpdated += body.updated ?? 0;
  totalFailed += body.failed ?? 0;
  console.log(
    `batch skip=${skip} → processed ${body.processed}, updated ${body.updated}, failed ${body.failed}, remaining ${body.remaining}  (${ms}s)`,
  );
  for (const r of body.results ?? []) {
    if (r.ok) {
      console.log(
        `   ✓ ${r.address} — EMV £${Math.round((r.estimatedMarketValuePence ?? 0) / 100).toLocaleString('en-GB')} [${r.source}]`,
      );
    } else {
      console.log(`   ✗ ${r.address} — ${r.error}`);
    }
  }

  if (body.remaining > 0 && body.nextSkip != null) {
    skip = body.nextSkip;
  } else {
    break;
  }
}

console.log(`\nDone. Updated ${totalUpdated}, failed ${totalFailed}.`);

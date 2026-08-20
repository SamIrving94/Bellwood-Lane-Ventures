/**
 * Prime-track audit — read-only. Answers "why isn't the prime scout finding
 * anything", with numbers rather than inference.
 *
 *   pnpm tsx scripts/prime-audit.mts
 *
 * Reads only. Writes nothing, deletes nothing.
 *
 * The hypothesis this was written to test (Aug 2026): the prime track was
 * near-empty for two structural reasons, not tuning ones.
 *
 *   1. `classifyTrack` keyed solely off `estateValuePence`, which is
 *      hard-coded null for every probate notice, receivership and Companies
 *      House charge. Only PropertyData listings carry a price, so the
 *      highest-intent cohort in the business could never be prime.
 *   2. The £700k floor was calibrated for London while every scanned postcode
 *      was Manchester, Stockport, Leeds or Sheffield.
 *
 * If (1) holds you will see `track=prime` at or near zero, and non-null
 * estate values almost entirely from propertydata_* sources. If (2) holds you
 * will see no London districts in the postcode breakdown at all.
 *
 * Run it again after seeding the London prime areas to see the difference.
 */

import { PrismaClient } from '../packages/database/generated/client/index.js';
import { outwardCode } from '../packages/scouting/src/track.js';

const db = new PrismaClient();

function pct(n: number, of: number): string {
  if (of === 0) return '  n/a';
  return `${((n / of) * 100).toFixed(1).padStart(5)}%`;
}

async function main() {
  const total = await db.scoutLead.count();
  if (total === 0) {
    console.log('No ScoutLead rows. Nothing to audit.');
    await db.$disconnect();
    return;
  }

  console.log(`\n═══ Prime-track audit — ${total} ScoutLead rows ═══\n`);

  // ── 1. The headline: how many are prime at all? ──
  const byTrack = await db.scoutLead.groupBy({
    by: ['track'],
    _count: { _all: true },
  });
  console.log('Track distribution');
  for (const t of byTrack.sort((a, b) => b._count._all - a._count._all)) {
    const n = t._count._all;
    console.log(
      `  ${String(t.track ?? 'null').padEnd(10)} ${String(n).padStart(6)}  ${pct(n, total)}`
    );
  }

  // ── 2. The suspected cause: can a lead even be valued? ──
  const withValue = await db.scoutLead.count({
    where: { estimatedEquityPence: { not: null } },
  });
  console.log('\nDo leads carry a value at all?');
  console.log(
    `  with a value    ${String(withValue).padStart(6)}  ${pct(withValue, total)}`
  );
  console.log(
    `  without         ${String(total - withValue).padStart(6)}  ${pct(total - withValue, total)}`
  );
  console.log('  (a lead with no value could never reach the old prime test)');

  // ── 3. Which sources can be valued, and which structurally cannot ──
  const bySource = await db.scoutLead.groupBy({
    by: ['source'],
    _count: { _all: true },
  });
  console.log('\nValue availability by source');
  for (const s of bySource
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 12)) {
    const src = s.source ?? 'unknown';
    const valued = await db.scoutLead.count({
      where: { source: src, estimatedEquityPence: { not: null } },
    });
    const flag = valued === 0 ? '  ← can never be prime' : '';
    console.log(
      `  ${src.padEnd(28)} ${String(s._count._all).padStart(5)} rows, ${String(valued).padStart(5)} valued${flag}`
    );
  }

  // ── 4. Geography: are we even looking where prime exists? ──
  const LONDON = /^(?:E|EC|N|NW|SE|SW|W|WC)\d/i;
  const rows = await db.scoutLead.findMany({
    select: { postcode: true },
    take: 20_000,
  });
  const districts = new Map<string, number>();
  let london = 0;
  for (const r of rows) {
    // outwardCode, not a prefix regex: "LS6 2AB" stripped of its space reads
    // as district "LS62A" under a greedy prefix match. The tested helper
    // anchors on the full postcode shape and returns null over guessing.
    const out = outwardCode(r.postcode);
    if (!out) continue;
    districts.set(out, (districts.get(out) ?? 0) + 1);
    if (LONDON.test(out)) london++;
  }
  console.log('\nGeography');
  console.log(
    `  London-postcode leads ${String(london).padStart(6)}  ${pct(london, rows.length)}`
  );
  console.log('  Top districts:');
  for (const [d, n] of [...districts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)) {
    console.log(`    ${d.padEnd(6)} ${String(n).padStart(5)}`);
  }

  // ── 5. The verdict ──
  const primeCount = byTrack.find((t) => t.track === 'prime')?._count._all ?? 0;
  console.log('\n─── Verdict ───');
  if (primeCount === 0) {
    console.log(
      '  ZERO prime leads. The track is not underperforming, it is not firing.'
    );
  } else {
    console.log(
      `  ${primeCount} prime leads (${pct(primeCount, total)} of all leads).`
    );
  }
  if (london === 0) {
    console.log(
      '  No London leads at all — the prime strategy has no stock to find.'
    );
    console.log('  Fix: pnpm tsx scripts/seed-london-prime.mts --write');
  }
  const unvaluable = total - withValue;
  if (unvaluable / total > 0.5) {
    console.log(
      `  ${pct(unvaluable, total).trim()} of leads carry no value. The classifier now falls back`
    );
    console.log(
      '  to the HM Land Registry area average, so these can reach prime.'
    );
  }
  console.log('');

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});

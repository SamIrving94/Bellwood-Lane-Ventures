/**
 * Seed the London prime-focus districts into `scouting.areas`.
 *
 * The prime book is a London refurb-arbitrage play: buy a period house below
 * what its street sells for, refurbish, sell on. Until now the scout had no
 * London coverage at all — every scanned district was Manchester, Stockport,
 * Leeds or Sheffield — so the prime track had nowhere to fire even after the
 * classifier was fixed.
 *
 * This adds the tier-1 districts from `packages/scouting/src/track.ts` as
 * `track: 'prime'` areas, which (per PR #79) are scanned on EVERY run rather
 * than sharing the 6-a-day volume rotation.
 *
 *   pnpm tsx scripts/seed-london-prime.mts            # dry run, prints only
 *   pnpm tsx scripts/seed-london-prime.mts --write    # actually writes
 *   pnpm tsx scripts/seed-london-prime.mts --write --tier2   # include super-prime
 *
 * SAFE BY DEFAULT. It is additive and idempotent: existing areas are never
 * modified or removed, and a district already present is skipped. Nothing is
 * written without `--write`.
 *
 * ── Read this before you run it ────────────────────────────────────────────
 *
 * Prime areas are scanned every run and are NOT capped, while the volume pool
 * is sliced to MAX_SEEDS_PER_RUN. Adding all 33 tier-1 districts therefore
 * adds 33 PropertyData probes to EVERY scout run, on top of the volume
 * rotation. At roughly 3 credits per postcode that is ~99 credits per run
 * before any volume work — check that against your plan before writing all of
 * them. Use --limit to start smaller.
 */

import { PrismaClient } from '../packages/database/generated/client/index.js';
import { LONDON_PRIME_DISTRICTS } from '../packages/scouting/src/track.js';

const db = new PrismaClient();

const args = new Set(process.argv.slice(2));
const WRITE = args.has('--write');
const INCLUDE_TIER2 = args.has('--tier2');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg
  ? Number(limitArg.split('=')[1])
  : Number.POSITIVE_INFINITY;

type Area = {
  id: string;
  label: string;
  seedPostcode: string;
  district: string;
  radiusMiles: number;
  lastProbe: null;
  track?: 'volume' | 'prime';
};

async function main() {
  const wanted = LONDON_PRIME_DISTRICTS.filter(
    (d) => d.tier === 1 || INCLUDE_TIER2
  ).slice(0, LIMIT);

  const row = await db.setting.findUnique({ where: { key: 'scouting.areas' } });
  const existing: Area[] = Array.isArray(row?.value)
    ? (row.value as Area[])
    : [];
  const have = new Set(existing.map((a) => (a.district ?? '').toUpperCase()));

  const toAdd = wanted.filter((d) => !have.has(d.district.toUpperCase()));

  console.log(`Existing areas:      ${existing.length}`);
  console.log(
    `  of which prime:    ${existing.filter((a) => a.track === 'prime').length}`
  );
  console.log(
    `London candidates:   ${wanted.length}${INCLUDE_TIER2 ? ' (incl. tier 2)' : ' (tier 1 only)'}`
  );
  console.log(`Already present:     ${wanted.length - toAdd.length}`);
  console.log(`Would add:           ${toAdd.length}`);
  console.log('');
  for (const d of toAdd) {
    console.log(`  + ${d.district.padEnd(5)} ${d.label}  (tier ${d.tier})`);
  }
  console.log('');
  console.log(
    `Estimated extra PropertyData probes per scout run: ~${toAdd.length} (~${toAdd.length * 3} credits)`
  );

  if (!WRITE) {
    console.log('\nDry run. Re-run with --write to apply.');
    await db.$disconnect();
    return;
  }

  const added: Area[] = toAdd.map((d) => ({
    id: `london-${d.district.toLowerCase()}`,
    label: `${d.label} (${d.district})`,
    seedPostcode: d.district,
    district: d.district,
    radiusMiles: 1,
    lastProbe: null,
    track: 'prime',
  }));

  const next = [...existing, ...added];
  await db.setting.upsert({
    where: { key: 'scouting.areas' },
    create: { key: 'scouting.areas', value: next },
    update: { value: next },
  });

  console.log(
    `\nWrote ${added.length} prime areas. Total areas now ${next.length}.`
  );
  console.log('They appear under "★ Prime focus" in Settings → Scouting.');
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});

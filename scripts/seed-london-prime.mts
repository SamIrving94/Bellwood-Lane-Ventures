/**
 * Seed the London prime-focus districts into `scouting.areas`.
 *
 * The prime book is a London refurb-arbitrage play: buy a period house below
 * what its street sells for, refurbish, sell on. This adds the tier-1
 * districts from `packages/scouting/src/track.ts` as `track: 'prime'` areas,
 * which are scanned on EVERY run rather than sharing the 6-a-day volume
 * rotation.
 *
 *   pnpm tsx scripts/seed-london-prime.mts            # dry run, prints only
 *   pnpm tsx scripts/seed-london-prime.mts --write    # actually writes
 *   pnpm tsx scripts/seed-london-prime.mts --write --tier2   # include super-prime
 *   pnpm tsx scripts/seed-london-prime.mts --write --limit=10
 *
 * SAFE BY DEFAULT: additive, idempotent, dry-run unless --write. Every seed
 * postcode is resolved LIVE from postcodes.io and verified to sit inside its
 * own district; a district that cannot be resolved is skipped loudly. A bare
 * district code or an invented postcode is never written (the SW3 incident).
 *
 * The district list is read from track.ts AS TEXT rather than imported: the
 * tsx loader cannot named-import workspace TS sources from scripts/, and
 * duplicating the list here would let it drift from the source of truth.
 * The resolution ladder mirrors seedPostcodeForOutcode in
 * packages/property-data/src/postcodes-io.ts (centroid -> radius 1000/2000
 * -> sector scan), which carries the unit tests for the behaviour.
 *
 * CREDIT COST: prime areas are scanned every run and are NOT capped, while
 * the volume pool is sliced to MAX_SEEDS_PER_RUN. Each area is ~3
 * PropertyData credits per run. Start with --limit=10 (~30 credits/run) and
 * check the plan before widening; the maths are in docs/PRIME-SCOUT.md.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '../packages/database/generated/client/index.js';

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

// ── District list, from the source of truth ────────────────────────────────

function loadDistricts(): Array<{
  district: string;
  label: string;
  tier: 1 | 2;
}> {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(
    join(here, '../packages/scouting/src/track.ts'),
    'utf-8'
  );
  const block = src.match(
    /LONDON_PRIME_DISTRICTS[\s\S]*?=\s*\[([\s\S]*?)\n\];/
  )?.[1];
  if (!block) {
    throw new Error('Could not find LONDON_PRIME_DISTRICTS in track.ts');
  }
  const out: Array<{ district: string; label: string; tier: 1 | 2 }> = [];
  const entry =
    /\{\s*district:\s*'([^']+)',\s*label:\s*'([^']+)',\s*tier:\s*([12])\s*\}/g;
  for (const m of block.matchAll(entry)) {
    out.push({
      district: m[1] as string,
      label: (m[2] as string).replace(/’/g, "'"),
      tier: Number(m[3]) as 1 | 2,
    });
  }
  if (out.length === 0) {
    throw new Error('Parsed zero districts from track.ts - format changed?');
  }
  return out;
}

// ── Seed resolution (mirrors packages/property-data postcodes-io.ts) ───────

const API = 'https://api.postcodes.io';

async function getJson(
  url: string
): Promise<{ status: number; body: { result?: unknown } | null }> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  return {
    status: res.status,
    body: (await res.json().catch(() => null)) as { result?: unknown } | null,
  };
}

async function resolveSeed(district: string): Promise<string | null> {
  const oc = await getJson(`${API}/outcodes/${encodeURIComponent(district)}`);
  const c = oc.body?.result as
    | { latitude?: number; longitude?: number }
    | undefined;
  if (oc.status !== 200 || typeof c?.latitude !== 'number') {
    return null;
  }

  for (const radius of [1000, 2000]) {
    const near = await getJson(
      `${API}/postcodes?lon=${c.longitude}&lat=${c.latitude}&limit=10&radius=${radius}`
    );
    const list = (near.body?.result ?? []) as Array<{
      outcode?: string;
      postcode?: string;
    }>;
    const hit = list.find(
      (p) => p.outcode?.toUpperCase() === district.toUpperCase() && p.postcode
    );
    if (hit?.postcode) {
      return hit.postcode;
    }
  }
  // Dense-centre fallback: sector scan, validated by prefix (the B2 case).
  for (let sector = 0; sector <= 9; sector++) {
    const q = await getJson(
      `${API}/postcodes?q=${encodeURIComponent(`${district} ${sector}`)}&limit=4`
    );
    const list = (q.body?.result ?? []) as Array<{ postcode?: string }>;
    const hit = list.find((p) =>
      p.postcode?.toUpperCase().startsWith(`${district.toUpperCase()} `)
    );
    if (hit?.postcode) {
      return hit.postcode;
    }
  }
  return null;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const wanted = loadDistricts()
    .filter((d) => d.tier === 1 || INCLUDE_TIER2)
    .slice(0, LIMIT);

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
    `Candidates:          ${wanted.length}${INCLUDE_TIER2 ? ' (incl. tier 2)' : ' (tier 1 only)'}`
  );
  console.log(`Already present:     ${wanted.length - toAdd.length}`);
  console.log('');

  const added: Area[] = [];
  for (const d of toAdd) {
    const seed = await resolveSeed(d.district);
    if (!seed) {
      console.log(
        `  ! ${d.district} SKIPPED - could not resolve a real seed, never writing a guess`
      );
      continue;
    }
    added.push({
      id: `london-${d.district.toLowerCase()}`,
      label: `${d.label} (${d.district})`,
      seedPostcode: seed,
      district: d.district,
      radiusMiles: 1.5,
      lastProbe: null,
      track: 'prime',
    });
    console.log(
      `  + ${d.district.padEnd(5)} seed ${seed.padEnd(9)} ${d.label}`
    );
  }

  console.log('');
  console.log(
    `Resolved ${added.length} prime areas (~${added.length * 3} PropertyData credits per run).`
  );

  if (!WRITE) {
    console.log('\nDry run. Re-run with --write to apply.');
    await db.$disconnect();
    return;
  }
  if (added.length === 0) {
    console.log('\nNothing to write.');
    await db.$disconnect();
    return;
  }

  const next = [...existing, ...added];
  await db.setting.upsert({
    where: { key: 'scouting.areas' },
    create: { key: 'scouting.areas', value: next as never },
    update: { value: next as never },
  });

  console.log(
    `\nWrote ${added.length} prime areas. Total areas now ${next.length}.`
  );
  console.log('They appear under the prime section in Settings -> Scouting.');
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});

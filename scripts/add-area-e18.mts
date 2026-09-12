/**
 * One-off: add South Woodford (E18) to `scouting.areas` as a PRIME area.
 *
 * E18 is not in LONDON_PRIME_DISTRICTS (packages/scouting/src/track.ts), so
 * seed-london-prime.mts refuses it by design. This mirrors that script's
 * rules plus the dashboard add flow (areas-actions.ts):
 *
 *   1. Resolve the seed postcode LIVE from postcodes.io — outcode centroid,
 *      then the nearest real postcode verified to sit inside E18. A guess is
 *      never written (the SW3 rule).
 *   2. Probe the seed once against PropertyData /sourced-properties exactly
 *      the way probeArea does, so a bad area is refused with PropertyData's
 *      own words instead of failing on every future cron run.
 *   3. Only then write the Area row (track 'prime', radius 1.5mi, lastProbe
 *      from the real probe).
 *
 * If E18 already exists it is NOT duplicated — its track is set to 'prime'.
 * As a courtesy the same track-flip is applied to an existing E11 row (the
 * Wanstead half of this errand), since PR #103's rotation-stamp fix for
 * fresh volume areas is not merged yet.
 *
 *   npx tsx scripts/add-area-e18.mts            # dry run, prints the plan
 *   npx tsx scripts/add-area-e18.mts --write    # actually writes
 *
 * SAFE BY DEFAULT: additive, idempotent, dry-run unless --write. Any resolve
 * or probe failure stops the script loudly — nothing is written on a guess.
 */

import { PrismaClient } from '../packages/database/generated/client/index.js';
import { loadProdEnv } from './prod-env.mts';

const WRITE = process.argv.includes('--write');
const DISTRICT = 'E18';
const LABEL = 'South Woodford';
const RADIUS_MILES = 1.5;

type Area = {
  id: string;
  label: string;
  seedPostcode: string;
  district: string;
  radiusMiles: number;
  lastProbe: {
    listingCount: number;
    checkedAt: string;
    error: string | null;
  } | null;
  history?: Array<{ date: string; count: number }>;
  track?: 'volume' | 'prime';
};

// ── Seed resolution (mirrors seed-london-prime.mts / postcodes-io.ts) ──────

const POSTCODES_API = 'https://api.postcodes.io';

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
  const oc = await getJson(
    `${POSTCODES_API}/outcodes/${encodeURIComponent(district)}`
  );
  const c = oc.body?.result as
    | { latitude?: number; longitude?: number }
    | undefined;
  if (oc.status !== 200 || typeof c?.latitude !== 'number') {
    return null;
  }

  for (const radius of [1000, 2000]) {
    const near = await getJson(
      `${POSTCODES_API}/postcodes?lon=${c.longitude}&lat=${c.latitude}&limit=10&radius=${radius}`
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
  for (let sector = 0; sector <= 9; sector++) {
    const q = await getJson(
      `${POSTCODES_API}/postcodes?q=${encodeURIComponent(`${district} ${sector}`)}&limit=4`
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

// ── Probe (mirrors probeArea in settings/scouting/areas-actions.ts) ────────
// First of the seven list types the daily cron actually queries; 404 means
// "no data", not "bad area"; any other failure stops the script.

async function probeSeed(
  seedPostcode: string
): Promise<{ listingCount: number }> {
  const apiKey = process.env.PROPERTYDATA_API_KEY;
  if (!apiKey) {
    throw new Error('PROPERTYDATA_API_KEY not set — cannot probe, stopping.');
  }
  const url = new URL('https://api.propertydata.co.uk/sourced-properties');
  url.searchParams.set('key', apiKey);
  url.searchParams.set(
    'postcode',
    seedPostcode.replace(/\s+/g, '').toUpperCase()
  );
  url.searchParams.set('list', 'repossessed-properties');
  url.searchParams.set('radius', String(RADIUS_MILES));
  url.searchParams.set('exclude_sstc', '1');

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  const body = (await res.json().catch(() => null)) as {
    properties?: unknown[];
    message?: string;
  } | null;

  if (res.ok) {
    return {
      listingCount: Array.isArray(body?.properties)
        ? body.properties.length
        : 0,
    };
  }
  if (res.status === 404) {
    return { listingCount: 0 };
  }
  throw new Error(
    `PropertyData probe failed (HTTP ${res.status}): ${body?.message ?? 'no detail'} — stopping, nothing written.`
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  loadProdEnv();
  const db = new PrismaClient();
  try {
    const row = await db.setting.findUnique({ where: { key: 'scouting.areas' } });
    const areas: Area[] = Array.isArray(row?.value) ? (row.value as Area[]) : [];

    console.log(`Current areas (${areas.length}):`);
    for (const a of areas) {
      console.log(
        `  ${(a.district ?? '?').padEnd(5)} ${(a.track ?? 'volume').padEnd(7)} ${a.label}`
      );
    }
    console.log('');

    const next = [...areas];
    const actions: string[] = [];

    // Courtesy flip: an existing E11 row must be prime for this errand
    // (fresh volume areas go to the back of the rotation until PR #103).
    const e11 = next.find((a) => (a.district ?? '').toUpperCase() === 'E11');
    if (e11 && e11.track !== 'prime') {
      e11.track = 'prime';
      actions.push(`E11 exists as volume -> set track 'prime' (${e11.label})`);
    }

    const e18 = next.find(
      (a) => (a.district ?? '').toUpperCase() === DISTRICT
    );
    if (e18) {
      if (e18.track === 'prime') {
        actions.push(`${DISTRICT} already present as prime — nothing to do`);
      } else {
        actions.push(
          `${DISTRICT} exists as ${e18.track ?? 'volume'} -> set track 'prime' (${e18.label})`
        );
        e18.track = 'prime';
      }
    } else {
      const seed = await resolveSeed(DISTRICT);
      if (!seed) {
        throw new Error(
          `Could not resolve a real ${DISTRICT} seed postcode from postcodes.io — stopping, never writing a guess.`
        );
      }
      const probe = await probeSeed(seed);
      const today = new Date().toISOString().slice(0, 10);
      next.push({
        id: `area_${DISTRICT}_${Date.now()}`,
        label: LABEL,
        seedPostcode: seed,
        district: DISTRICT,
        radiusMiles: RADIUS_MILES,
        lastProbe: {
          listingCount: probe.listingCount,
          checkedAt: new Date().toISOString(),
          error: null,
        },
        history: [{ date: today, count: probe.listingCount }],
        track: 'prime',
      });
      actions.push(
        `add ${DISTRICT} '${LABEL}' seed ${seed} (probe: ${probe.listingCount} listings on the first cron list type)`
      );
    }

    console.log('Plan:');
    for (const a of actions) {
      console.log(`  - ${a}`);
    }

    if (!WRITE) {
      console.log('\nDry run. Re-run with --write to apply.');
      return;
    }

    await db.setting.upsert({
      where: { key: 'scouting.areas' },
      create: { key: 'scouting.areas', value: next as never },
      update: { value: next as never },
    });
    console.log(`\nWrote. Total areas now ${next.length}.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

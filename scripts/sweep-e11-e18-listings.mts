/**
 * One-off: raw PropertyData /sourced-properties sweep of E11 + E18.
 *
 * The scout run confirmed ~97 distress-list listings in these districts, but
 * they rank out of the volume shortlist (family-house prices sit under the
 * prime capture floor). This pulls the listings DIRECTLY, one call per list
 * type per area — same endpoint, same radius as the cron — so the founder's
 * personal 3-bed hunt sees everything, attributed to the list it came from.
 *
 *   npx tsx scripts/sweep-e11-e18-listings.mts out.json
 *
 * Cost: 7 list types × 2 areas ≈ 42 PropertyData credits. Read-only.
 */

import { writeFileSync } from 'node:fs';
import { loadProdEnv } from './prod-env.mts';

loadProdEnv();

const outPath = process.argv[2];
if (!outPath) {
  throw new Error('usage: npx tsx scripts/sweep-e11-e18-listings.mts <out.json>');
}

const SEEDS = [
  { district: 'E11', label: 'Wanstead', seed: 'E11 3AD' },
  { district: 'E18', label: 'South Woodford', seed: 'E18 2BD' },
] as const;

const LIST_TYPES = [
  'repossessed-properties',
  'quick-sale-properties',
  'reduced-properties',
  'slow-to-sell-properties',
  'derelict-properties',
  'unmodernised-properties',
  'back-on-market',
] as const;

const RADIUS_MILES = 1.5;

type RawProp = {
  id?: string;
  address?: string;
  precise_address?: string | null;
  postcode?: string;
  type?: string;
  bedrooms?: number | null;
  price?: number | null;
  days_on_market?: number | null;
  price_history?: Array<{ date?: string; price?: number }>;
  summary?: string | null;
  url?: string | null;
  image_url?: string | null;
  sstc?: number | null;
};

type Merged = {
  district: string;
  address: string;
  postcode: string;
  propertyType: string | null;
  bedrooms: number | null;
  priceGbp: number | null;
  daysOnMarket: number | null;
  reductionCount: number;
  lists: string[];
  summary: string | null;
  url: string | null;
  imageUrl: string | null;
  gardenMentioned: boolean;
  isHouse: boolean | null;
  chainFree: boolean;
  unmodernised: boolean;
};

const apiKey = process.env.PROPERTYDATA_API_KEY;
if (!apiKey) {
  throw new Error('PROPERTYDATA_API_KEY not set — stopping.');
}

const merged = new Map<string, Merged>();
const errors: string[] = [];

function classifyHouse(type: string | null): boolean | null {
  if (!type) {
    return null;
  }
  const t = type.toLowerCase();
  if (/flat|apartment|maisonette|studio/.test(t)) {
    return false;
  }
  if (/house|terrace|semi|detached|bungalow|cottage/.test(t)) {
    return true;
  }
  return null;
}

for (const area of SEEDS) {
  for (const list of LIST_TYPES) {
    const url = new URL('https://api.propertydata.co.uk/sourced-properties');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('postcode', area.seed.replace(/\s+/g, '').toUpperCase());
    url.searchParams.set('list', list);
    url.searchParams.set('radius', String(RADIUS_MILES));
    url.searchParams.set('exclude_sstc', '1');

    try {
      const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });
      const body = (await res.json().catch(() => null)) as {
        properties?: RawProp[];
        message?: string;
      } | null;
      if (!res.ok) {
        if (res.status !== 404) {
          errors.push(`${area.district}/${list}: HTTP ${res.status} ${body?.message ?? ''}`);
        }
        continue;
      }
      for (const p of body?.properties ?? []) {
        if (p.sstc === 1) {
          continue;
        }
        const addr = p.precise_address || p.address || '';
        const pc = (p.postcode ?? '').toUpperCase();
        if (!addr || !pc) {
          continue;
        }
        const key = `${pc}|${addr.toLowerCase()}`;
        const existing = merged.get(key);
        if (existing) {
          if (!existing.lists.includes(list)) {
            existing.lists.push(list);
          }
          continue;
        }
        const text = [addr, p.type, p.summary].filter(Boolean).join(' | ');
        merged.set(key, {
          district: area.district,
          address: addr,
          postcode: pc,
          propertyType: p.type ?? null,
          bedrooms: typeof p.bedrooms === 'number' ? p.bedrooms : null,
          priceGbp: typeof p.price === 'number' ? p.price : null,
          daysOnMarket:
            typeof p.days_on_market === 'number' ? p.days_on_market : null,
          reductionCount: Math.max(0, (p.price_history?.length ?? 1) - 1),
          lists: [list],
          summary: p.summary ?? null,
          url: p.url ?? null,
          imageUrl: p.image_url ?? null,
          gardenMentioned: /\bgardens?\b/i.test(text),
          isHouse: classifyHouse(p.type ?? null),
          chainFree: /chain[- ]?free|no (?:onward )?chain/i.test(text),
          unmodernised:
            /unmodernised|needs? (?:of )?(?:modernisation|refurb|renovation|updating)|doer[- ]upper|in need of/i.test(
              text
            ),
        });
      }
    } catch (err) {
      errors.push(
        `${area.district}/${list}: ${err instanceof Error ? err.message : 'error'}`
      );
    }
    // Stay polite with the shared rate limit.
    await new Promise((r) => setTimeout(r, 400));
  }
}

const all = [...merged.values()].sort(
  (a, b) => (b.bedrooms ?? 0) - (a.bedrooms ?? 0)
);
console.log(`Distinct listings: ${all.length} (E11: ${all.filter((x) => x.district === 'E11').length}, E18: ${all.filter((x) => x.district === 'E18').length})`);
for (const e of errors) {
  console.log(`  ! ${e}`);
}
for (const x of all) {
  console.log(
    `  [${x.district}] ${x.address} | ${x.propertyType ?? '?'} | beds:${x.bedrooms ?? '?'} | £${x.priceGbp?.toLocaleString('en-GB') ?? '?'} | ${x.lists.join(',')} | dom:${x.daysOnMarket ?? '?'}${x.gardenMentioned ? ' | garden' : ''}${x.chainFree ? ' | chain-free' : ''}${x.unmodernised ? ' | unmodernised' : ''}`
  );
}

writeFileSync(outPath, JSON.stringify(all, null, 2));
console.log(`\nWrote ${all.length} listings to ${outPath}`);

/**
 * Rank prime districts by MEASURED refurb arbitrage.
 *
 * For each district: pull the last N months of house sales from HM Land
 * Registry (SPARQL, free, no key), match each sale to its EPC certificate
 * (free, needs EPC_API_TOKEN), and report median £/sqft for unmodernised
 * (band F/G) vs refurbished (band A–C) stock — the spread the prime book
 * trades on. The logic and its honest limits live in
 * `packages/property-data/src/arbitrage.ts`; this script is the IO.
 *
 *   pnpm tsx --env-file=.env scripts/arbitrage-rank.mts
 *   pnpm tsx --env-file=.env scripts/arbitrage-rank.mts --districts=SE22,W11,NW3
 *   pnpm tsx --env-file=.env scripts/arbitrage-rank.mts --months=36 --csv=out.csv
 *
 * READ-ONLY: no database, no writes anywhere but the optional --csv file.
 * Needs EPC_API_TOKEN (bearer token from the My account page of
 * get-energy-performance-data.communities.gov.uk). Refuses to start without
 * it — half a model (sales with no condition) would print rankings that
 * look measured and aren't.
 *
 * Budget: EPC allows 6000 requests / 5 min. This script spaces calls at
 * ~120ms (well under) and caps total certificate fetches with
 * --max-epc-calls (default 4000) so a fat district cannot run away. A full
 * 39-district sweep is a lot of calls — start with 3–5 districts.
 *
 * NOTE (dev sandboxes): landregistry.data.gov.uk and the EPC API may be
 * blocked by egress policy (like The Gazette — see
 * docs/architecture/sourcing-channels.md). Run this from a real machine.
 */

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type ArbitragePair,
  type DistrictArbitrage,
  type SoldSale,
  buildDistrictSalesQuery,
  isArbitrageHouse,
  matchSaleToEpcRow,
  parseSparqlSales,
  summariseDistrictArbitrage,
} from '../packages/property-data/src/arbitrage.js';
import {
  type EpcSearchRow,
  getEpcCertificateByNumber,
  searchDomesticEpc,
} from '../packages/property-data/src/epc.js';

const SPARQL_ENDPOINT = 'https://landregistry.data.gov.uk/landregistry/query';
const SPARQL_PAGE = 5000;
const EPC_CALL_SPACING_MS = 120;

const args = process.argv.slice(2);
const argValue = (name: string): string | null =>
  args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? null;

const MONTHS = Number(argValue('months') ?? 24);
const CSV_PATH = argValue('csv');
const MAX_EPC_CALLS = Number(argValue('max-epc-calls') ?? 4000);
const ONLY = argValue('districts')
  ?.split(',')
  .map((d) => d.trim().toUpperCase())
  .filter(Boolean);

// ── District list from the source of truth (same parse as seed script) ─────

function loadDistricts(): string[] {
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
  const out: string[] = [];
  for (const m of block.matchAll(/\{\s*district:\s*'([^']+)'/g)) {
    out.push((m[1] as string).toUpperCase());
  }
  return out;
}

// ── IO helpers ──────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sparqlSelect(query: string): Promise<unknown> {
  const res = await fetch(SPARQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/sparql-results+json',
    },
    body: new URLSearchParams({ query }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Land Registry SPARQL ${res.status}`);
  }
  return await res.json();
}

/** All house sales in a district since the cutoff, across SPARQL pages. */
async function fetchDistrictSales(
  district: string,
  fromIso: string
): Promise<SoldSale[]> {
  const all: SoldSale[] = [];
  for (let offset = 0; ; offset += SPARQL_PAGE) {
    const query = buildDistrictSalesQuery(district, fromIso, {
      limit: SPARQL_PAGE,
      offset,
    });
    const page = parseSparqlSales(await sparqlSelect(query));
    all.push(...page);
    if (page.length < SPARQL_PAGE) return all;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.EPC_API_TOKEN) {
    console.error(
      'EPC_API_TOKEN is not set. Get a bearer token from the My account page of\n' +
        'https://get-energy-performance-data.communities.gov.uk/ and run with\n' +
        '  pnpm tsx --env-file=.env scripts/arbitrage-rank.mts\n' +
        'Refusing to run without it: sales without condition data would rank\n' +
        'districts on numbers that look measured and are not.'
    );
    process.exit(1);
  }

  const known = loadDistricts();
  const districts = ONLY ?? known;
  for (const d of districts) {
    if (!known.includes(d)) {
      // Not fatal — measuring a non-list district is a legitimate way to
      // audition it — but say so, since it cannot classify prime today.
      console.warn(
        `  ~ ${d} is not in LONDON_PRIME_DISTRICTS — measuring anyway (an audition, not a current prime district)`
      );
    }
  }

  const from = new Date();
  from.setMonth(from.getMonth() - MONTHS);
  const fromIso = from.toISOString().slice(0, 10);
  console.log(
    `Measuring ${districts.length} district(s), sales since ${fromIso}, EPC budget ${MAX_EPC_CALLS} calls.\n`
  );

  let epcCalls = 0;
  const results: DistrictArbitrage[] = [];

  for (const district of districts) {
    const sales = (await fetchDistrictSales(district, fromIso)).filter(
      isArbitrageHouse
    );
    console.log(`[${district}] ${sales.length} house sales`);

    // One EPC search per postcode that actually had a house sale.
    const byPostcode = new Map<string, SoldSale[]>();
    for (const s of sales) {
      const list = byPostcode.get(s.postcode) ?? [];
      list.push(s);
      byPostcode.set(s.postcode, list);
    }

    const pairs: ArbitragePair[] = [];
    let budgetHit = false;
    for (const [postcode, postcodeSales] of byPostcode) {
      if (epcCalls >= MAX_EPC_CALLS) {
        budgetHit = true;
        break;
      }
      epcCalls++;
      const rows: EpcSearchRow[] = await searchDomesticEpc(postcode);
      await sleep(EPC_CALL_SPACING_MS);
      if (rows.length === 0) continue;

      for (const sale of postcodeSales) {
        const row = matchSaleToEpcRow(sale, rows);
        if (!row) continue;
        if (epcCalls >= MAX_EPC_CALLS) {
          budgetHit = true;
          break;
        }
        epcCalls++;
        const cert = await getEpcCertificateByNumber(
          row.certificateNumber,
          postcode
        );
        await sleep(EPC_CALL_SPACING_MS);
        if (!cert) continue;
        pairs.push({
          pricePounds: sale.pricePounds,
          date: sale.date,
          floorAreaSqm: cert.floorAreaSqm,
          band: cert.epcRating ?? row.band,
          epcAddress: row.address,
        });
      }
      if (budgetHit) break;
    }

    if (budgetHit) {
      console.warn(
        `[${district}] EPC call budget hit at ${epcCalls} — result covers a PARTIAL district; re-run with --districts=${district} --max-epc-calls=${MAX_EPC_CALLS * 2} for the full picture`
      );
    }

    const summary = summariseDistrictArbitrage(district, sales.length, pairs);
    results.push(summary);
    const verdict =
      summary.confidence === 'measured'
        ? `unmod £${summary.unmodernised.medianPoundsPerSqft}/sqft (n=${summary.unmodernised.n}) vs refurb £${summary.refurbished.medianPoundsPerSqft}/sqft (n=${summary.refurbished.n}), spread £${summary.spreadPoundsPerSqft}/sqft`
        : `insufficient (unmod n=${summary.unmodernised.n}, refurb n=${summary.refurbished.n}; need ≥5 each)`;
    console.log(
      `[${district}] matched ${summary.matched}, usable ${summary.usable} → ${verdict}`
    );
  }

  // ── Ranked table ──────────────────────────────────────────────────────────
  const ranked = [...results].sort(
    (a, b) => (b.spreadPoundsPerSqft ?? -1) - (a.spreadPoundsPerSqft ?? -1)
  );
  console.log('\n== Refurb arbitrage, ranked by measured £/sqft spread ==');
  console.log(
    'district  houseSales matched usable  unmod£/sqft(n)  refurb£/sqft(n)  spread  spread%'
  );
  for (const r of ranked) {
    const u = r.unmodernised;
    const f = r.refurbished;
    console.log(
      [
        r.district.padEnd(9),
        String(r.houseSales).padStart(9),
        String(r.matched).padStart(7),
        String(r.usable).padStart(6),
        `${u.medianPoundsPerSqft ?? '—'} (${u.n})`.padStart(15),
        `${f.medianPoundsPerSqft ?? '—'} (${f.n})`.padStart(16),
        String(r.spreadPoundsPerSqft ?? 'insufficient').padStart(7),
        r.spreadPct !== null ? `${Math.round(r.spreadPct * 100)}%` : '',
      ].join(' ')
    );
  }
  console.log(
    `\nEPC calls used: ${epcCalls}. Spread = refurbished median − unmodernised median; D/E-band pairs are excluded as ambiguous. A conservative floor, not a valuation.`
  );

  if (CSV_PATH) {
    writeFileSync(
      CSV_PATH,
      'district,houseSales,matched,usable,unmodN,unmodMedianPsf,refurbN,refurbMedianPsf,spreadPsf,spreadPct,confidence\n'
    );
    for (const r of ranked) {
      const line = [
        r.district,
        r.houseSales,
        r.matched,
        r.usable,
        r.unmodernised.n,
        r.unmodernised.medianPoundsPerSqft ?? '',
        r.refurbished.n,
        r.refurbished.medianPoundsPerSqft ?? '',
        r.spreadPoundsPerSqft ?? '',
        r.spreadPct ?? '',
        r.confidence,
      ].join(',');
      appendFileSync(CSV_PATH, `${line}\n`);
    }
    console.log(`CSV written to ${CSV_PATH}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

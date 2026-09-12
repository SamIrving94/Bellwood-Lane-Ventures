/**
 * PropertyData response-shape probe.
 *
 *   pnpm tsx scripts/propertydata-probe.mts --postcode "DL2 3JP"
 *   pnpm tsx scripts/propertydata-probe.mts --postcode "DL2 3JP" --endpoints demand,flood-risk
 *
 * Why this exists: eleven endpoints in packages/property-data/src/propertydata.ts
 * are coded against a `result.*` response shape that PropertyData does not
 * return. Production logs (bellwood-api, Sep 2026) show every call to them
 * ending in "SCHEMA DRIFT — response validated but carries none of the
 * expected fields. Top-level keys: status, postcode, postcode_type, data,
 * process_time" (or `demand_rating`, `flood_risk`, `known_floor_areas`,
 * `energy_efficiency`, `council_tax`). So flood risk, demand, yields,
 * growth, comps by sold price, agents, EPC, tenure, floor areas, £/sqft
 * and council tax have never fed a real value — and each cron run still
 * spends the credits.
 *
 * The schemas must be rewritten from REAL responses, not from memory (see
 * CLAUDE.md: never fabricate identifiers). This script hits each endpoint
 * ONCE for one postcode (≈2–3 credits each, ~30 credits in total), saves
 * the raw JSON under scratch/propertydata-probe/ (gitignored — the
 * responses carry real addresses) and prints the actual shape next to what
 * the code currently expects.
 *
 * Needs PROPERTYDATA_API_KEY in the environment or in apps/api/.env.local.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const API_BASE = 'https://api.propertydata.co.uk';
const OUT_DIR = 'scratch/propertydata-probe';

/** Endpoint → { params the code sends, the field path the code reads today }. */
const ENDPOINTS: Record<
  string,
  { params: Record<string, string>; codeExpects: string }
> = {
  demand: {
    params: {},
    codeExpects: 'result.sales_demand_score | result.days_on_market_average',
  },
  'flood-risk': {
    params: {},
    codeExpects: 'result.rivers_and_sea | result.surface_water',
  },
  agents: {
    params: {},
    codeExpects:
      'result.agents[] {name, phone, address, number_of_listings, url}',
  },
  'sold-prices': {
    params: { max_age: '18' },
    codeExpects:
      'result.transactions[] {address, price, date, property_type, tenure}; result.average_price',
  },
  yields: {
    params: {},
    codeExpects:
      'result.yield_average | result.gross_yield, result.yield_low, result.yield_high',
  },
  growth: {
    params: {},
    codeExpects:
      'result.annual_growth, result.five_year_growth, result.forecast_growth',
  },
  'council-tax': {
    params: {},
    codeExpects: 'result.band | result.bands | result.average_annual_bill',
  },
  'floor-areas': {
    params: {},
    codeExpects:
      'result.properties[] {address, total_floor_area, bedrooms, property_type}',
  },
  'prices-per-sqf': {
    params: {},
    codeExpects: 'result.average | result.median',
  },
  freeholds: {
    params: {},
    codeExpects: 'result.properties[] {address, tenure, lease_remaining_years}',
  },
  'energy-efficiency': {
    params: {},
    codeExpects:
      'result.properties[] {address, current_energy_rating, current_energy_efficiency}',
  },
};

function loadDotEnvLocal(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  for (const file of [
    '.env.local',
    'apps/api/.env.local',
    'apps/app/.env.local',
  ]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && m[1] === name && m[2]) return m[2];
    }
  }
  return undefined;
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** Describe a JSON value's shape, 3 levels deep, first element of arrays. */
function shape(value: unknown, depth = 0): string {
  const pad = '  '.repeat(depth);
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[] (empty)\n`;
    return `${pad}[${value.length} items] first item:\n${shape(value[0], depth + 1)}`;
  }
  if (value && typeof value === 'object') {
    if (depth >= 3) return `${pad}{…}\n`;
    let out = '';
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v && typeof v === 'object') {
        out += `${pad}${k}:\n${shape(v, depth + 1)}`;
      } else {
        out += `${pad}${k}: ${typeof v}${v === null ? ' (null)' : ''} = ${JSON.stringify(v)?.slice(0, 60)}\n`;
      }
    }
    return out;
  }
  return `${pad}${typeof value} = ${JSON.stringify(value)?.slice(0, 60)}\n`;
}

async function main() {
  const apiKey = loadDotEnvLocal('PROPERTYDATA_API_KEY');
  const postcode = arg('--postcode');
  if (!apiKey || !postcode) {
    console.error(
      'Usage: pnpm tsx scripts/propertydata-probe.mts --postcode "DL2 3JP"  (needs PROPERTYDATA_API_KEY)'
    );
    process.exit(1);
  }
  const only = arg('--endpoints')
    ?.split(',')
    .map((e) => e.trim());
  const endpoints = Object.keys(ENDPOINTS).filter(
    (e) => !only || only.includes(e)
  );
  mkdirSync(OUT_DIR, { recursive: true });

  for (const endpoint of endpoints) {
    const cfg = ENDPOINTS[endpoint];
    if (!cfg) {
      console.error(
        `Unknown endpoint "${endpoint}" — known: ${Object.keys(ENDPOINTS).join(', ')}`
      );
      continue;
    }
    const url = new URL(`${API_BASE}/${endpoint}`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set(
      'postcode',
      postcode.replace(/\s+/g, '').toUpperCase()
    );
    for (const [k, v] of Object.entries(cfg.params)) url.searchParams.set(k, v);

    console.log(`\n══ /${endpoint} ══`);
    let status = 0;
    let bodyText = '';
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      status = res.status;
      bodyText = await res.text();
    } catch (err) {
      console.log(
        `  network error: ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }
    const file = join(OUT_DIR, `${endpoint}.json`);
    writeFileSync(file, bodyText);
    console.log(`  HTTP ${status} → saved ${file}`);

    let json: unknown;
    try {
      json = JSON.parse(bodyText);
    } catch {
      console.log(`  NOT JSON (first 200 chars): ${bodyText.slice(0, 200)}`);
      continue;
    }
    console.log(`  code expects: ${cfg.codeExpects}`);
    console.log('  API returned:');
    process.stdout.write(shape(json, 2));

    // PropertyData allows 4 requests per 10 seconds; stay well inside it.
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.log(
    `\nRaw responses are in ${OUT_DIR}/ (gitignored). Rewrite each schema + hasContent in packages/property-data/src/propertydata.ts from these files, then add a fixture test per endpoint.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

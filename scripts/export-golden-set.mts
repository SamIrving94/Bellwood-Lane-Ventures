/**
 * Export a golden-set sheet for hand-labelling (data-quality spec, step 0).
 *
 * Picks real leads and deals at random, about half flats and half houses,
 * and writes a CSV with what the product currently believes about each home
 * next to blank "correct_*" columns for a person to fill in. The filled
 * sheet is what the precision report scores the matcher against.
 *
 *   npx tsx scripts/run-with-prod-env.mts scripts/export-golden-set.mts
 *   … --size=200 --out=docs/data-quality/golden-set.csv
 *
 * Read-only. No contact names, phones or emails are exported — address and
 * postcode only. An existing --out file is never overwritten (a labelled
 * sheet is hours of work); pick a new name instead.
 *
 * How to label each row (OS Places or the EPC register are the usual
 * sources): correct_uprn = the home's UPRN, or NONE if it has none / can't
 * be found; correct_type = detached | semi-detached | terraced | flat |
 * bungalow; floor area in m² from the matched EPC (blank if none); last
 * sale from Land Registry for THIS home (blank if never sold since 1995).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PrismaClient } from '../packages/database/generated/client/index.js';
import * as TypeNs from '../packages/property-data/src/property-type.ts';

// @repo/property-data has no `"type": "module"`, so under tsx its TS source
// arrives CJS-wrapped with named exports under `default` (same unwrap as
// scripts/avm-backtest.mts).
function unwrap<T>(ns: T): T {
  return ((ns as { default?: T }).default ?? ns) as T;
}
const { canonicalPropertyType } = unwrap(TypeNs);

const db = new PrismaClient();

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const size = Number.parseInt(arg('size', '200'), 10);
const out = arg('out', 'docs/data-quality/golden-set.csv');

type Row = {
  kind: 'lead' | 'deal';
  id: string;
  address: string;
  postcode: string;
  ourType: string | null;
  ourUprn: string | null;
  ourUprnConfidence: string | null;
  ourFloorAreaM2: number | null;
  ourEpcMatchedAddress: string | null;
};

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

function csv(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  if (existsSync(out)) {
    throw new Error(
      `${out} already exists — not overwriting a labelled sheet.`
    );
  }

  const [leads, deals] = await Promise.all([
    db.scoutLead.findMany({
      select: {
        id: true,
        address: true,
        postcode: true,
        rawPayload: true,
        uprn: true,
        uprnConfidence: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 3000,
    }),
    db.deal.findMany({
      select: {
        id: true,
        address: true,
        postcode: true,
        propertyType: true,
        uprn: true,
        uprnConfidence: true,
      },
    }),
  ]);

  const rows: Row[] = [
    ...leads.map((l): Row => {
      const raw = (l.rawPayload ?? {}) as {
        propertyData?: { preciseAddress?: unknown; propertyType?: unknown };
        avmFull?: { floorAreaSqm?: unknown };
        snapshot?: { epc?: { matchedAddress?: string | null } | null };
      };
      const pd = raw.propertyData ?? {};
      return {
        kind: 'lead',
        id: l.id,
        address:
          typeof pd.preciseAddress === 'string' ? pd.preciseAddress : l.address,
        postcode: l.postcode,
        ourType: canonicalPropertyType(
          typeof pd.propertyType === 'string' ? pd.propertyType : null
        ),
        ourUprn: l.uprn,
        ourUprnConfidence: l.uprnConfidence,
        ourFloorAreaM2:
          typeof raw.avmFull?.floorAreaSqm === 'number'
            ? (raw.avmFull.floorAreaSqm as number)
            : null,
        ourEpcMatchedAddress: raw.snapshot?.epc?.matchedAddress ?? null,
      };
    }),
    ...deals.map(
      (d): Row => ({
        kind: 'deal',
        id: d.id,
        address: d.address,
        postcode: d.postcode,
        ourType: canonicalPropertyType(d.propertyType),
        ourUprn: d.uprn,
        ourUprnConfidence: d.uprnConfidence,
        ourFloorAreaM2: null,
        ourEpcMatchedAddress: null,
      })
    ),
  ];

  // Half flats, half everything else. Rows with no type fill whichever half
  // is short — they are often the hard cases worth labelling.
  const isFlat = (r: Row) =>
    r.ourType === 'flat' || /\b(FLAT|APARTMENT|APT)\b/i.test(r.address);
  const flats = shuffle(rows.filter(isFlat));
  const houses = shuffle(rows.filter((r) => !isFlat(r)));
  const half = Math.floor(size / 2);
  const picked = [
    ...flats.slice(0, half),
    ...houses.slice(0, size - Math.min(half, flats.length)),
  ].slice(0, size);

  const header = [
    'kind',
    'id',
    'address',
    'postcode',
    'our_type',
    'our_uprn',
    'our_uprn_confidence',
    'our_floor_area_m2',
    'our_epc_matched_address',
    'correct_uprn',
    'correct_type',
    'correct_floor_area_m2',
    'correct_last_sale_price_gbp',
    'correct_last_sale_date',
    'labelled_by',
    'notes',
  ];
  const lines = [
    header.join(','),
    ...picked.map((r) =>
      [
        r.kind,
        r.id,
        r.address,
        r.postcode,
        r.ourType,
        r.ourUprn,
        r.ourUprnConfidence,
        r.ourFloorAreaM2,
        r.ourEpcMatchedAddress,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]
        .map(csv)
        .join(',')
    ),
  ];

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${lines.join('\n')}\n`);
  const nFlats = picked.filter(isFlat).length;
  console.log(
    `Wrote ${picked.length} rows to ${out} (${nFlats} flats, ${picked.length - nFlats} houses/other).`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

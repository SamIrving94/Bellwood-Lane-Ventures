/**
 * Pre-fill the golden-set sheet so a person only checks the hard rows.
 *
 * For each row of the sheet written by export-golden-set.mts, pulls the
 * postcode's EPC certificates, PropertyData homes (/uprns) and Land Registry sales,
 * and fills the correct_* columns with what the sources say about THIS
 * home. Each row gets a `status`:
 *
 *   AUTO     a house where EPC and PropertyData independently agree on one
 *            UPRN. Filled in, no human needed (except spot checks below).
 *   CHECK    a random 1 in 10 of the AUTO rows. Filled in, but a person
 *            confirms it — otherwise the matcher is marking its own homework.
 *   CONFIRM  filled with a suggestion, but it's a flat or only one source
 *            agreed. A person confirms or corrects the UPRN.
 *   PICK     no single answer. `candidates` lists the postcode's addresses
 *            with their UPRNs; a person picks one, or writes NONE.
 *   NO_DATA  the sources returned nothing (no keys, outage, bad postcode).
 *
 * Only CHECK, CONFIRM and PICK rows need a person. When you've checked a
 * row, put your name in labelled_by.
 *
 *   npx tsx --conditions=react-server scripts/prefill-golden-set.mts
 *   … --in=docs/data-quality/golden-set.csv --out=docs/data-quality/golden-set.prefilled.csv
 *
 * Needs EPC_API_TOKEN and PROPERTYDATA_API_KEY (both in apps/api/.env.local;
 * export them first). `--conditions=react-server` lets the server-only
 * PropertyData client load outside Next. Read-only: no database writes.
 * Costs ~6-9 PropertyData credits per postcode, cached 60 days in-process.
 * Never overwrites --out.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as EpcNs from '../packages/property-data/src/epc.ts';
import * as HmlrNs from '../packages/property-data/src/hmlr.ts';
import * as TypeNs from '../packages/property-data/src/property-type.ts';
import * as PdNs from '../packages/property-data/src/propertydata.ts';
import * as UprnNs from '../packages/property-data/src/uprn.ts';

// @repo/property-data has no `"type": "module"`, so under tsx its TS source
// arrives CJS-wrapped with named exports under `default` (same unwrap as
// scripts/avm-backtest.mts).
function unwrap<T>(ns: T): T {
  return ((ns as { default?: T }).default ?? ns) as T;
}
const { getEpcCertificateByNumber, searchDomesticEpc } = unwrap(EpcNs);
const { getPricePaidWithAddresses } = unwrap(HmlrNs);
const { getPostcodeUprnsResult } = unwrap(PdNs);
const { canonicalPropertyType } = unwrap(TypeNs);
const { addressKey, resolveUprn, sameHome } = unwrap(UprnNs);

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const inPath = arg('in', 'docs/data-quality/golden-set.csv');
const outPath = arg('out', inPath.replace(/\.csv$/, '.prefilled.csv'));

// --- tiny CSV (our own sheet: quoted fields, no embedded newlines) --------

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function csv(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// --- per-row prefill -------------------------------------------------------

type Fill = {
  status: 'AUTO' | 'CHECK' | 'CONFIRM' | 'PICK' | 'NO_DATA';
  uprn: string;
  type: string;
  floorArea: string;
  salePrice: string;
  saleDate: string;
  candidates: string;
  note: string;
};

async function prefill(address: string, postcode: string): Promise<Fill> {
  const [epcRows, pdRes, sales] = await Promise.all([
    searchDomesticEpc(postcode),
    getPostcodeUprnsResult(postcode),
    getPricePaidWithAddresses(postcode),
  ]);
  const pdRows =
    pdRes.outcome === 'ok'
      ? pdRes.value
      : pdRes.outcome === 'not_found'
        ? []
        : null;
  const fill: Fill = {
    status: 'PICK',
    uprn: '',
    type: '',
    floorArea: '',
    salePrice: '',
    saleDate: '',
    candidates: '',
    note: '',
  };
  if (!epcRows.length && !pdRows?.length && !sales.length) {
    return { ...fill, status: 'NO_DATA', note: 'no source answered' };
  }

  // This home's sales, newest first (the API already sorts by date desc).
  const mine = sales.filter((s) => sameHome(address, s.address));
  if (mine[0]) {
    fill.salePrice = String(mine[0].price);
    fill.saleDate = mine[0].date ?? '';
    fill.type = canonicalPropertyType(mine[0].propertyType) ?? '';
  }

  // Same lookups the matcher would make, reused rather than re-fetched.
  const r = await resolveUprn(
    { address, postcode },
    {
      epc: async () =>
        process.env.EPC_API_TOKEN
          ? epcRows.map((e) => ({ uprn: e.uprn, address: e.address }))
          : null,
      addresses: async () => pdRows,
    }
  );
  const isFlat = addressKey(address).unit !== null;
  if (r.uprn) {
    fill.uprn = r.uprn;
    fill.status =
      r.confidence === 'high' && !isFlat
        ? Math.random() < 0.1
          ? 'CHECK'
          : 'AUTO'
        : 'CONFIRM';

    // Floor area (and type, if no sale gave one) from this UPRN's newest
    // certificate — never a neighbour's.
    const certs = epcRows
      .filter((e) => e.uprn === r.uprn)
      .sort((a, b) =>
        String(b.registrationDate ?? '').localeCompare(
          String(a.registrationDate ?? '')
        )
      );
    if (certs[0]) {
      const cert = await getEpcCertificateByNumber(
        certs[0].certificateNumber,
        postcode
      );
      if (cert?.floorAreaSqm) fill.floorArea = String(cert.floorAreaSqm);
      if (!fill.type)
        fill.type = canonicalPropertyType(cert?.propertyType) ?? '';
    } else {
      fill.note = 'no EPC for this UPRN';
    }
  } else {
    fill.note = r.reason ?? '';
  }

  if (fill.status !== 'AUTO') {
    // What a person picks from: the postcode's homes, from PropertyData.
    const list = (pdRows ?? [])
      .filter((o) => o.uprn)
      .map((o) => `${o.uprn}=${o.address}`);
    fill.candidates = list.slice(0, 40).join(' | ');
  }
  return fill;
}

async function main() {
  if (!existsSync(inPath)) throw new Error(`${inPath} not found`);
  if (existsSync(outPath))
    throw new Error(`${outPath} exists — not overwriting.`);

  const [headerLine, ...lines] = readFileSync(inPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim());
  const header = parseLine(headerLine ?? '');
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`column ${name} missing from ${inPath}`);
    return i;
  };
  const c = {
    address: col('address'),
    postcode: col('postcode'),
    uprn: col('correct_uprn'),
    type: col('correct_type'),
    area: col('correct_floor_area_m2'),
    price: col('correct_last_sale_price_gbp'),
    date: col('correct_last_sale_date'),
    by: col('labelled_by'),
    notes: col('notes'),
  };

  const outLines = [[...header, 'status', 'candidates'].map(csv).join(',')];
  const counts: Record<string, number> = {};
  for (const [i, line] of lines.entries()) {
    const row = parseLine(line);
    // Never touch a row a person already labelled.
    if (row[c.by]?.trim()) {
      outLines.push([...row, 'DONE', ''].map(csv).join(','));
      counts.DONE = (counts.DONE ?? 0) + 1;
      continue;
    }
    const f = await prefill(row[c.address] ?? '', row[c.postcode] ?? '');
    row[c.uprn] = f.uprn;
    row[c.type] = f.type;
    row[c.area] = f.floorArea;
    row[c.price] = f.salePrice;
    row[c.date] = f.saleDate;
    row[c.by] = f.status === 'AUTO' ? 'auto' : '';
    row[c.notes] = f.note;
    outLines.push([...row, f.status, f.candidates].map(csv).join(','));
    counts[f.status] = (counts[f.status] ?? 0) + 1;
    process.stdout.write(`\r${i + 1}/${lines.length}`);
  }

  writeFileSync(outPath, `${outLines.join('\n')}\n`);
  console.log(`\nWrote ${outPath}`);
  console.log(counts);
  const human =
    (counts.CHECK ?? 0) + (counts.CONFIRM ?? 0) + (counts.PICK ?? 0);
  console.log(`Rows needing a person: ${human}.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

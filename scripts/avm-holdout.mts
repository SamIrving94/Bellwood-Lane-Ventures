/**
 * AVM hold-out test (avm-holdout.mts) — judge a method change on real sales
 * BEFORE it ships, instead of waiting months for the backtest.
 *
 * Values ~200 real recent sales (Land Registry, May–Jul 2026 by default) in
 * districts we appraise in, each AS OF JUST BEFORE IT SOLD: comps are
 * same-type, category A, non-new-build sales from the 12 months before,
 * within 0.5 mi, never the home itself and never a later sale. Sizes come
 * from the public EPC register (strict sameHome match). Every fetch is
 * cached in <cacheDir>, so reruns take seconds.
 *
 * It MODELS the radius method — it does not call production: no
 * PropertyData comps, no bedroom filter, no external AVM. Comp availability
 * uses today's registrations (no price leakage, slightly more comps than
 * the engine would have seen at the time).
 *
 * Variants (report: median abs error, median bias, within 10/20%):
 *   current      the pre-25-Oct blend: fixed 60/40 rings, size pillar 30%
 *                on comps sized via the 5-postcode cap
 *   B            near ring weight scaled by count (withdrawn: no gain)
 *   C            every comp sized, size pillar still 30%
 *   BC           B + C
 *   sizeLed      B + size pillar 70% when 4+ comps sized (pre-set weight)
 *   sizeLedFixed fixed rings + size 70% — what shipped on 25 Oct 2026
 *   size50/100   sensitivity of the 70% only
 * First reading (23 Oct 2026, 209 sales): current 15.6%, sizeLedFixed 12.3%.
 *
 *   pnpm tsx scripts/avm-holdout.mts <cacheDir>      (DRIFT=0 to test no comp drift)
 *
 * Read-only. Free public endpoints only; be gentle — 4 parallel EPC fetches.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as uprnMod from '../packages/property-data/src/uprn.ts';

const u: any = (uprnMod as any).sameHome ? uprnMod : (uprnMod as any).default;
const CACHE = process.argv[2]!;
mkdirSync(join(CACHE, 'epc'), { recursive: true });
const cached = async <T,>(file: string, fn: () => Promise<T>): Promise<T> => {
  const p = join(CACHE, file);
  if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
  const v = await fn();
  writeFileSync(p, JSON.stringify(v));
  return v;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Areas we appraise in (from leads + snapshots).
const DISTRICTS = ['SE13', 'SE12', 'SE22', 'SW6', 'SW12', 'SW17', 'SW18', 'W12', 'NW3', 'W8', 'M21', 'S11', 'LS6', 'SK8'];
const TARGET_FROM = '2026-05-01';
const TARGET_TO = '2026-07-31';
const PER_DISTRICT = 15;
// Monthly drift the engine adds to older comps (0.4%/mo). DRIFT=0 tests none.
const DRIFT = Number(process.env.DRIFT ?? 0.004);
const TYPES: Record<string, string> = { 'flat-maisonette': 'flat', terraced: 'terraced', 'semi-detached': 'semi-detached', detached: 'detached' };

// ── 1. Land Registry sales per district ─────────────────────────────────────
type Sale = { price: number; date: string; address: string; postcode: string; type: string };
async function districtSales(d: string): Promise<Sale[]> {
  const raw: any = await cached(`lr-${d}.json`, async () => {
    const q = `PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT ?amount ?date ?paon ?saon ?street ?postcode ?ptype ?newBuild ?cat
WHERE {
  ?txn lrppi:pricePaid ?amount ; lrppi:transactionDate ?date ;
       lrppi:transactionCategory ?cat ;
       lrppi:propertyType ?ptype ; lrppi:propertyAddress ?addr .
  ?addr lrcommon:postcode ?postcode .
  OPTIONAL { ?addr lrcommon:paon ?paon } OPTIONAL { ?addr lrcommon:saon ?saon } OPTIONAL { ?addr lrcommon:street ?street }
  OPTIONAL { ?txn lrppi:newBuild ?newBuild }
  FILTER(STRSTARTS(?postcode, "${d} "))
  FILTER(?date >= "2025-05-01"^^xsd:date)
} LIMIT 5000`;
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch('https://landregistry.data.gov.uk/landregistry/query', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' }, body: new URLSearchParams({ query: q }).toString(), signal: AbortSignal.timeout(180_000) });
        if (r.ok) return ((await r.json()) as any).results.bindings;
      } catch {}
      await sleep(5000 * (i + 1));
    }
    throw new Error(`SPARQL failed ${d}`);
  });
  const out: Sale[] = [];
  for (const b of raw) {
    // Category A (standard, open-market) only — filtered here, not in SPARQL,
    // because a fixed-category query times out on the public endpoint.
    if (!String(b.cat?.value).endsWith('standardPricePaidTransaction')) continue;
    const type = TYPES[b.ptype.value.split('/').pop()];
    if (!type || b.newBuild?.value === 'true') continue;
    const price = Number(b.amount.value);
    if (price < 50_000) continue;
    if (type !== 'flat' && b.saon) continue; // a sub-unit of a house is not the house
    out.push({ price, date: b.date.value.slice(0, 10), address: [b.saon?.value, b.paon?.value, b.street?.value].filter(Boolean).join(', '), postcode: b.postcode.value, type });
  }
  return out;
}

// ── 2. Geocode (postcodes.io bulk) ──────────────────────────────────────────
const geo = new Map<string, { lat: number; lng: number } | null>();
async function geocodeAll(pcs: string[]) {
  const todo = [...new Set(pcs)].filter((p) => !geo.has(p));
  for (let i = 0; i < todo.length; i += 100) {
    const chunk = todo.slice(i, i + 100);
    const res: any = await cached(`geo-${chunk[0]!.replace(/\s/g, '')}-${chunk.length}-${i}.json`, async () => {
      const r = await fetch('https://api.postcodes.io/postcodes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postcodes: chunk }) });
      return ((await r.json()) as any).result;
    });
    for (const x of res) geo.set(x.query, x.result ? { lat: x.result.latitude, lng: x.result.longitude } : null);
  }
}
const miles = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 3958.8, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// ── 3. EPC floor areas from the public register (strict sameHome) ──────────
const EPC = 'https://find-energy-certificate.service.gov.uk';
async function epcGet(path: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    try { const r = await fetch(EPC + path, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30_000) }); if (r.ok) return await r.text(); if (r.status === 404) return ''; } catch {}
    await sleep(2000 * (i + 1));
  }
  throw new Error('EPC fetch failed ' + path);
}
const field = (html: string, key: string) => { const i = html.indexOf('>' + key + '</dt>'); if (i < 0) return null; const j = html.indexOf('>', html.indexOf('<dd', i)) + 1; return html.slice(j, html.indexOf('</dd>', j)).trim() || null; };
async function epcRows(pc: string): Promise<{ path: string; address: string }[]> {
  return cached(`epc/search-${pc.replace(/\s/g, '')}.json`, async () => {
    const html = await epcGet(`/find-a-certificate/search-by-postcode?postcode=${encodeURIComponent(pc)}`);
    return [...html.matchAll(/href="(\/energy-certificate\/[0-9-]+)">\s*([^<]+?)\s*<\/a>/g)].map((m) => ({ path: m[1]!, address: m[2]!.trim() }));
  });
}
async function epcCert(path: string): Promise<{ area: number | null; assessed: string | null }> {
  return cached(`epc/cert-${path.split('/').pop()}.json`, async () => {
    const html = await epcGet(path);
    const a = Number((field(html, 'Total floor area') ?? '').replace(/[^\d.]/g, ''));
    return { area: a >= 20 && a <= 700 ? a : null, assessed: field(html, 'Date of assessment') };
  });
}
/** Floor area of this home: the certificate assessed closest to `onDate`. */
async function homeArea(address: string, pc: string, onDate: string): Promise<number | null> {
  const hits = (await epcRows(pc)).filter((r) => u.sameHome(address, r.address));
  if (!hits.length) return null;
  const certs = await Promise.all(hits.map((h) => epcCert(h.path)));
  const ok = certs.filter((c) => c.area);
  if (!ok.length) return null;
  ok.sort((a, b) => Math.abs(+new Date(a.assessed ?? 0) - +new Date(onDate)) - Math.abs(+new Date(b.assessed ?? 0) - +new Date(onDate)));
  return ok[0]!.area;
}
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]!); } }));
  return out;
}

// ── 4. Seeded sample ────────────────────────────────────────────────────────
let seed = 20261022;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

const med = (v: number[]) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
const monthsBetween = (from: string, to: string) => Math.max(0, Math.round((+new Date(to) - +new Date(from)) / (30 * 86_400_000)));

type Comp = { price: number; adjusted: number; dist: number; near: boolean; postcode: string; address: string; date: string; area?: number | null };
const results: any[] = [];
for (const d of DISTRICTS) {
  const sales = await districtSales(d);
  await geocodeAll(sales.map((s) => s.postcode));
  const pool0 = sales.filter((s) => s.date >= TARGET_FROM && s.date <= TARGET_TO && geo.get(s.postcode));
  const picked: Sale[] = [];
  const cand = [...pool0];
  while (picked.length < PER_DISTRICT && cand.length) picked.push(cand.splice(Math.floor(rand() * cand.length), 1)[0]!);
  console.log(`${d}: ${sales.length} sales, ${pool0.length} candidates, ${picked.length} picked`);
  for (const t of picked) {
    const tg = geo.get(t.postcode)!;
    const from = new Date(t.date); from.setUTCMonth(from.getUTCMonth() - 12);
    const fromIso = from.toISOString().slice(0, 10);
    const comps: Comp[] = sales
      .filter((s) => s.type === t.type && s.date < t.date && s.date >= fromIso && !u.sameHome(t.address, s.address))
      .map((s) => { const g = geo.get(s.postcode); if (!g) return null; const dist = miles(tg, g); if (dist > 0.5) return null; const m = monthsBetween(s.date, t.date); return { price: s.price, adjusted: Math.round(s.price * (1 + DRIFT * m)), dist, near: dist <= 0.25, postcode: s.postcode, address: s.address, date: s.date }; })
      .filter(Boolean) as Comp[];
    results.push({ district: d, target: t, comps });
  }
}

// ── 5. Sizes (subjects + every comp) ────────────────────────────────────────
const needSize = new Map<string, { address: string; postcode: string; date: string }>();
for (const r of results) {
  needSize.set(`${r.target.postcode}|${r.target.address}`, { address: r.target.address, postcode: r.target.postcode, date: r.target.date });
  for (const c of r.comps) needSize.set(`${c.postcode}|${c.address}`, { address: c.address, postcode: c.postcode, date: c.date });
}
console.log('homes to size', needSize.size);
const areas = new Map<string, number | null>();
let done = 0;
await pool([...needSize.entries()], 4, async ([k, v]) => {
  try { areas.set(k, await homeArea(v.address, v.postcode, v.date)); } catch { areas.set(k, null); }
  if (++done % 250 === 0) console.log('  sized', done);
});

// ── 6. Variants ─────────────────────────────────────────────────────────────
const SQFT = 10.7639;
function csa(comps: Comp[], scaledNear: boolean) {
  const n = comps.filter((c) => c.near), f = comps.filter((c) => !c.near);
  const nm = med(n.map((c) => c.adjusted)), fm = med(f.map((c) => c.adjusted));
  if (nm == null) return fm; if (fm == null) return nm;
  const w = scaledNear ? 0.6 * Math.min(n.length, 4) / 4 : 0.6;
  return nm * w + fm * (1 - w);
}
function sqftEstimate(sized: Comp[], subjectArea: number | null) {
  if (!subjectArea) return { est: null as number | null, n: 0 };
  const rows = sized.filter((c) => c.area).map((c) => ({ near: c.near, ppsf: c.adjusted / (c.area! * SQFT) })).filter((x) => x.ppsf >= 50 && x.ppsf <= 3000);
  if (rows.length < 2) return { est: null, n: rows.length };
  const nm = med(rows.filter((x) => x.near).map((x) => x.ppsf)), fm = med(rows.filter((x) => !x.near).map((x) => x.ppsf));
  const rate = nm != null && fm != null ? nm * 0.6 + fm * 0.4 : (nm ?? fm)!;
  return { est: rate * subjectArea * SQFT, n: rows.length };
}
/** Today's size pillar only sees comps in the subject postcode + the 5 nearest other comp postcodes. */
function capSized(comps: Comp[], subjectPc: string) {
  const keys: string[] = [];
  for (const c of [...comps].sort((a, b) => a.dist - b.dist)) { if (c.postcode === subjectPc || keys.includes(c.postcode)) continue; keys.push(c.postcode); if (keys.length >= 5) break; }
  return comps.map((c) => (c.postcode === subjectPc || keys.includes(c.postcode) ? c : { ...c, area: null }));
}
const rows: any[] = [];
for (const r of results) {
  const t = r.target as Sale;
  if (!r.comps.length) { rows.push({ district: r.district, type: t.type, price: t.price, noValuation: true }); continue; }
  const comps: Comp[] = r.comps.map((c: Comp) => ({ ...c, area: areas.get(`${c.postcode}|${c.address}`) ?? null }));
  const subj = areas.get(`${t.postcode}|${t.address}`) ?? null;
  const csaFixed = csa(comps, false)!, csaScaled = csa(comps, true)!;
  const capped = sqftEstimate(capSized(comps, t.postcode), subj), full = sqftEstimate(comps, subj);
  const blend = (c: number, s: { est: number | null }, w = 0.3) => (s.est != null ? c * (1 - w) + s.est * w : c);
  const est = {
    current: blend(csaFixed, capped),
    B: blend(csaScaled, capped),
    C: blend(csaFixed, full),
    BC: blend(csaScaled, full),
    sizeLed: full.est != null && full.n >= 4 ? blend(csaScaled, full, 0.7) : blend(csaScaled, full),
    // What shipped on 25 Oct 2026: fixed 60/40 rings, size 70% when 4+ sized.
    sizeLedFixed: full.est != null && full.n >= 4 ? blend(csaFixed, full, 0.7) : blend(csaFixed, full),
    // Sensitivity only — not the pre-set 70% weight.
    size50: full.est != null && full.n >= 4 ? blend(csaScaled, full, 0.5) : blend(csaScaled, full),
    size100: full.est != null && full.n >= 4 ? blend(csaScaled, full, 1) : blend(csaScaled, full),
  };
  rows.push({ district: r.district, address: t.address, postcode: t.postcode, date: t.date, type: t.type, price: t.price, subjectArea: subj, comps: comps.length, near: comps.filter((c) => c.near).length, sizedCapped: capped.n, sizedFull: full.n, est, err: Object.fromEntries(Object.entries(est).map(([k, v]) => [k, v / t.price - 1])) });
}
writeFileSync(join(CACHE, `holdout-rows-drift${DRIFT}.json`), JSON.stringify(rows, null, 2));

// ── 7. Report ───────────────────────────────────────────────────────────────
const valued = rows.filter((r) => !r.noValuation);
const report = (label: string, set: any[]) => {
  console.log(`\n${label} — n=${set.length}`);
  for (const k of ['current', 'B', 'C', 'BC', 'sizeLed', 'sizeLedFixed', 'size50', 'size100']) {
    const e = set.map((r) => r.err[k]);
    const abs = e.map(Math.abs);
    console.log(`  ${k.padEnd(12)} MdAPE ${(med(abs)! * 100).toFixed(1)}%  bias ${(med(e)! * 100).toFixed(1)}%  within10 ${Math.round((abs.filter((x) => x <= 0.1).length / set.length) * 100)}%  within20 ${Math.round((abs.filter((x) => x <= 0.2).length / set.length) * 100)}%`);
  }
};
console.log(`\ntargets ${rows.length}, valued ${valued.length}, no comps ${rows.length - valued.length}`);
report('ALL', valued);
report('subject size known', valued.filter((r) => r.subjectArea));
report('subject size unknown', valued.filter((r) => !r.subjectArea));
report('flats', valued.filter((r) => r.type === 'flat'));
report('houses', valued.filter((r) => r.type !== 'flat'));
report('London', valued.filter((r) => /^(SE|SW|W|NW)\d/.test(r.district)));
report('North', valued.filter((r) => !/^(SE|SW|W|NW)\d/.test(r.district)));

// Paired bootstrap: is sizeLed's lower median error real or sample noise?
const boot = (a: string, b: string, set: any[]) => {
  const diffs: number[] = [];
  for (let i = 0; i < 2000; i++) {
    const smp = Array.from({ length: set.length }, () => set[Math.floor(rand() * set.length)]);
    diffs.push(med(smp.map((r) => Math.abs(r.err[b])))! - med(smp.map((r) => Math.abs(r.err[a])))!);
  }
  diffs.sort((x, y) => x - y);
  const lo = diffs[Math.floor(0.025 * diffs.length)]!, hi = diffs[Math.floor(0.975 * diffs.length)]!;
  console.log(`  ${b} minus ${a}: MdAPE change ${(med(diffs)! * 100).toFixed(1)} pts (95% range ${(lo * 100).toFixed(1)} to ${(hi * 100).toFixed(1)}); better in ${Math.round((diffs.filter((d) => d < 0).length / diffs.length) * 100)}% of resamples`);
};
console.log(`
BOOTSTRAP (drift ${DRIFT})`);
boot('current', 'sizeLed', valued);
boot('current', 'C', valued);
boot('current', 'sizeLedFixed', valued);
boot('current', 'B', valued);
boot('current', 'sizeLed', valued.filter((r) => r.subjectArea));

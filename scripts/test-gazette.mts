// Inline gazette test - bypasses server-only import for CLI testing

const GAZETTE_LIST_URL = 'https://www.thegazette.co.uk/all-notices/notice/data.json';
const REQUEST_TIMEOUT_MS = 12_000;

async function timedFetch(url: string, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
  } finally { clearTimeout(timer); }
}

function extractNoticeId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/\/notice\/(\d+)/);
  return m?.[1] ?? null;
}

function arrayOf(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

function stringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function pickFirstPostcodeLabel(arr: unknown[]): string | null {
  for (const p of arr) {
    if (typeof p === 'string') return p;
    if (p && typeof p === 'object') {
      const label = (p as any).label;
      if (typeof label === 'string') return label;
    }
  }
  return null;
}

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

function extractAddressForPostcode(prose: string, postcode: string): string | null {
  const compact = postcode.replace(/\s/g, '').toUpperCase();
  const upper = prose.toUpperCase();
  const re = /([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})/g;
  let m: RegExpExecArray | null;
  let foundIdx = -1;
  while ((m = re.exec(upper)) !== null) {
    if (`${m[1]}${m[2]}` === compact) { foundIdx = m.index; break; }
  }
  if (foundIdx < 0) {
    const any = prose.match(UK_POSTCODE_RE);
    if (!any || any.index === undefined) return null;
    foundIdx = any.index;
  }
  const beforePostcode = prose.slice(0, foundIdx).trimEnd().replace(/,$/, '');
  const ofMatches = [...beforePostcode.matchAll(/\b(lately of|of)\s+/gi)];
  if (ofMatches.length === 0) return beforePostcode.slice(-80).trim();
  const last = ofMatches[ofMatches.length - 1];
  if (!last || last.index === undefined) return null;
  const start = last.index + last[0].length;
  return beforePostcode.slice(start).trim();
}

async function main() {
  console.log('Fetching list...');
  const listUrl = `${GAZETTE_LIST_URL}?noticetype=deceased-estates&results-page-size=8`;
  const listRes = await timedFetch(listUrl, REQUEST_TIMEOUT_MS);
  const listJson = await listRes.json() as any;
  const entries = listJson.entry ?? [];
  console.log(`List: ${entries.length} entries`);

  const ids = entries.map((e: any) => extractNoticeId(e.id)).filter(Boolean) as string[];
  console.log(`IDs: ${ids.length}`);

  let parsed = 0, skipped = 0;
  for (const id of ids.slice(0, 8)) {
    const detailUrl = `https://www.thegazette.co.uk/notice/${id}/data.json?view=linked-data`;
    const detailRes = await timedFetch(detailUrl, REQUEST_TIMEOUT_MS);
    const detail = await detailRes.json() as any;
    const topic = detail?.result?.primaryTopic;
    if (!topic) { skipped++; continue; }

    const types = [...arrayOf(topic.type), ...arrayOf(topic.isAbout?.type)].map((t: any) => String(t).toLowerCase());
    const isDeceased = types.some((t: string) => t.includes('deceased') || t.includes('estate-of'));
    if (!isDeceased) {
      console.log(`  ${id} SKIP — not deceased (${types[0] ?? 'no type'})`);
      skipped++; continue;
    }

    const postcode = pickFirstPostcodeLabel(arrayOf(topic.isAbout?.postcode));
    const person = topic.isAbout?.person;
    const deceasedName = stringOrNull(person?.name) ?? `${stringOrNull(person?.firstName) ?? ''} ${stringOrNull(person?.familyName) ?? ''}`.trim();
    const prose = stringOrNull(person?.hasPersonDetails);
    const address = prose && postcode ? extractAddressForPostcode(prose, postcode) : null;

    if (!postcode || !address) {
      console.log(`  ${id} SKIP — postcode:${!!postcode} address:${!!address} prose:${prose?.slice(0,80) ?? '(none)'}`);
      skipped++; continue;
    }

    console.log(`  ${id} ✓ ${deceasedName.padEnd(40)} | ${postcode.padEnd(10)} | ${address.slice(0, 60)}`);
    parsed++;
  }

  console.log(`\nResult: ${parsed} parsed, ${skipped} skipped from ${ids.length} fetched.`);
}
main().catch((e) => { console.error(e); process.exit(1); });

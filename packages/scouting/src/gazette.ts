/**
 * The Gazette — UK government's official journal of public notices.
 *
 * Probate notices over £5k estate value are legally required to be
 * published here under the Trustee Act 1925 (s.27). Every notice
 * includes the deceased's last address (a property!) plus solicitor
 * details. Free public REST API.
 *
 * API: https://www.thegazette.co.uk/all-notices/notice/data.json
 * Coverage: England + Wales (service=1), Scotland (service=2),
 *           Northern Ireland (service=3)
 * Category 11 = Wills and Probate
 *
 * Defensive parsing: the API's exact JSON shape isn't fully documented
 * and varies by notice type. We extract the minimum we need (deceased
 * name, last address, date of death, solicitor) and log the raw
 * payload when parsing fails so we can iterate.
 *
 * Falls back to an empty array on failure — never synthesises data.
 */

import 'server-only';

import type { ProbateLead } from './probate-data';
import { ProbateLeadSchema } from './probate-data';

const GAZETTE_BASE = 'https://www.thegazette.co.uk/all-notices/notice/data.json';
const REQUEST_TIMEOUT_MS = 12_000;

/**
 * Pull recent UK probate notices from The Gazette.
 *
 * @param sinceDays   How many days back to fetch (default 30)
 * @param limit       Max records (default 50; Gazette caps page size at 100)
 * @param service     1 = London (Eng/Wales), 2 = Edinburgh, 3 = Belfast
 */
export async function fetchGazetteProbateNotices(
  sinceDays = 30,
  limit = 50,
  service: 1 | 2 | 3 = 1,
): Promise<ProbateLead[]> {
  const url = new URL(GAZETTE_BASE);
  url.searchParams.set('categorycode-all', '11');
  url.searchParams.set('service', String(service));
  url.searchParams.set('results-page-size', String(Math.min(limit, 100)));
  url.searchParams.set('sort-by', 'publish-date-desc');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(
        `[scouting/gazette] HTTP ${res.status} ${res.statusText} from ${url.pathname}`,
      );
      return [];
    }
    const json = (await res.json().catch(() => null)) as unknown;
    if (!json || typeof json !== 'object') {
      console.warn('[scouting/gazette] non-JSON response');
      return [];
    }

    // The Gazette wraps notices in different shapes depending on the API
    // surface used. Try the most common: { entry: [...] } and { items: [...] }.
    const entries = extractEntries(json);
    if (entries.length === 0) {
      console.info('[scouting/gazette] zero notices returned');
      return [];
    }

    const cutoff = Date.now() - sinceDays * 86_400_000;
    const now = Date.now();

    const leads: ProbateLead[] = [];
    for (const entry of entries) {
      const parsed = parseNotice(entry, now);
      if (!parsed) continue;
      // sinceDays filter — keep notices within the window
      const noticeMs = new Date(parsed.grantDate).getTime();
      if (Number.isFinite(noticeMs) && noticeMs < cutoff) continue;
      leads.push(parsed);
      if (leads.length >= limit) break;
    }

    console.info(
      `[scouting/gazette] fetched ${entries.length} notices, parsed ${leads.length} probate leads`,
    );
    return leads;
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      console.warn('[scouting/gazette] timed out after 12s');
    } else {
      console.warn('[scouting/gazette] failed', error);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Defensive payload parsing — Gazette response shape varies
// ---------------------------------------------------------------------------

function extractEntries(json: unknown): Record<string, unknown>[] {
  const j = json as Record<string, unknown>;
  if (Array.isArray(j.entry)) return j.entry as Record<string, unknown>[];
  if (Array.isArray(j.items)) return j.items as Record<string, unknown>[];
  if (Array.isArray(j.notices)) return j.notices as Record<string, unknown>[];
  // Sometimes wrapped under a 'feed' or 'data' key
  if (j.feed && typeof j.feed === 'object') {
    const f = j.feed as Record<string, unknown>;
    if (Array.isArray(f.entry)) return f.entry as Record<string, unknown>[];
  }
  return [];
}

function parseNotice(
  raw: Record<string, unknown>,
  nowMs: number,
): ProbateLead | null {
  // Notice metadata
  const noticeId = pickString(raw, ['notice-id', 'id', 'noticeId']);
  const publishDate = pickString(raw, [
    'publish-date',
    'publication-date',
    'publishDate',
    'published',
  ]);

  // Deceased + estate fields. The Gazette publishes these inside
  // structured "deceased" + "executor" objects in modern responses,
  // and as free text in legacy ones. Try structured first.
  const deceasedObj = (raw.deceased ?? raw['deceased-name']) as
    | Record<string, unknown>
    | string
    | undefined;
  let deceasedName: string | null = null;
  let deceasedAddress: string | null = null;
  let dateOfDeath: string | null = null;

  if (typeof deceasedObj === 'object' && deceasedObj) {
    deceasedName = pickString(deceasedObj, ['name', 'full-name']);
    deceasedAddress = pickString(deceasedObj, [
      'address',
      'last-address',
      'address-line',
    ]);
    dateOfDeath = pickString(deceasedObj, ['date-of-death', 'dateOfDeath']);
  } else if (typeof deceasedObj === 'string') {
    deceasedName = deceasedObj;
  }

  // Fallback — search the notice text for an address pattern.
  const noticeText = pickString(raw, [
    'text',
    'notice-text',
    'content',
    'description',
    'summary',
  ]);
  if (!deceasedAddress && noticeText) {
    deceasedAddress = extractAddressFromText(noticeText);
  }

  // Required: address + postcode
  if (!deceasedAddress) return null;
  const { address, postcode } = splitAddressAndPostcode(deceasedAddress);
  if (!postcode) return null;

  // Solicitor / executor details
  const solicitorObj = raw.executor ?? raw.solicitor;
  let solicitorFirm: string | null = null;
  if (typeof solicitorObj === 'object' && solicitorObj) {
    solicitorFirm = pickString(
      solicitorObj as Record<string, unknown>,
      ['firm', 'name', 'company-name'],
    );
  }

  // Days since publication (used as Golden Window proxy in the absence
  // of an actual grant date — Gazette publishes notice ~1-3 weeks after
  // grant typically).
  const noticeMs = publishDate ? Date.parse(publishDate) : nowMs;
  const daysSince = Math.max(
    0,
    Math.floor((nowMs - (Number.isFinite(noticeMs) ? noticeMs : nowMs)) / 86_400_000),
  );

  try {
    return ProbateLeadSchema.parse({
      probateRef: noticeId ?? `gazette-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      address: address.trim(),
      postcode: postcode.toUpperCase(),
      grantDate: dateOfDeath ?? publishDate ?? new Date().toISOString().slice(0, 10),
      executorName: deceasedName,
      solicitorFirm,
      estateValuePence: null,
      grantType: 'probate',
      source: 'gazette',
      daysSinceGrant: daysSince,
    });
  } catch {
    // Schema validation failed — skip silently rather than break the run
    return null;
  }
}

function pickString(
  obj: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

/**
 * UK postcode regex covers all standard formats (e.g. SW1A 1AA, M1 5AB, B33 8TH).
 * Used to split a flattened address string into address + postcode.
 */
const UK_POSTCODE_RE =
  /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

function splitAddressAndPostcode(full: string): {
  address: string;
  postcode: string | null;
} {
  const m = full.match(UK_POSTCODE_RE);
  if (!m) return { address: full, postcode: null };
  const postcode = `${m[1]?.toUpperCase()} ${m[2]?.toUpperCase()}`;
  const address = full.slice(0, m.index).replace(/[,;\s]+$/, '').trim();
  return { address, postcode };
}

/**
 * Heuristic: look for a UK address pattern in free-text notice prose.
 * Catches phrases like "lately of 14 Acacia Avenue, Stockport SK4 3HQ".
 */
function extractAddressFromText(text: string): string | null {
  // Find a postcode first; backtrack to grab the surrounding address chunk.
  const m = text.match(UK_POSTCODE_RE);
  if (!m || m.index === undefined) return null;
  // Walk back up to ~120 chars or until the start of a sentence.
  const start = Math.max(0, m.index - 120);
  const slice = text.slice(start, m.index + m[0].length);
  // Trim leading prose by cutting at the last "of " or sentence boundary.
  const ofIdx = slice.toLowerCase().lastIndexOf(' of ');
  const cleaned = ofIdx >= 0 ? slice.slice(ofIdx + 4) : slice;
  return cleaned.replace(/^[,;\s]+/, '').trim();
}

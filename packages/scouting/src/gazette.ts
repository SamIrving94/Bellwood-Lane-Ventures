/**
 * The Gazette — UK government's official journal of public notices.
 *
 * Probate notices over £5k estate value are legally required to be
 * published here under the Trustee Act 1925 (s.27). Every notice
 * includes the deceased's last address (a property) plus solicitor
 * details. Free public REST API.
 *
 * API discovery (13 May 2026):
 *   List endpoint:    https://www.thegazette.co.uk/all-notices/notice/data.json
 *                     ?noticetype=deceased-estates&results-page-size=N
 *   Per-notice detail: https://www.thegazette.co.uk/notice/{id}/data.json
 *                     ?view=linked-data
 *
 * The list returns headers only — addresses live in the detail page.
 * Each detail's `result.primaryTopic.isAbout` contains:
 *   - `postcode[]`        structured array of postcode + lat/long
 *   - `person.hasPersonDetails`  prose like "X NAME, of [address], lately of [address]"
 *   - `type[]`            includes "deceased-estate" types for real probate
 *
 * Falls back to an empty array on failure. Never synthesises.
 */

import 'server-only';

import type { ProbateLead } from './probate-data';
import { ProbateLeadSchema } from './probate-data';

const GAZETTE_LIST_URL = 'https://www.thegazette.co.uk/all-notices/notice/data.json';
const REQUEST_TIMEOUT_MS = 12_000;
const PARALLEL_DETAIL_BATCH = 5;

/**
 * Pull recent UK probate notices from The Gazette.
 *
 * @param sinceDays  How many days back to keep notices for (default 30)
 * @param limit      Max records returned (default 50; list page-size cap is 100)
 */
export async function fetchGazetteProbateNotices(
  sinceDays = 30,
  limit = 50,
): Promise<ProbateLead[]> {
  // ---- 1. Fetch the list of recent deceased-estate notices ----
  const listUrl = new URL(GAZETTE_LIST_URL);
  listUrl.searchParams.set('noticetype', 'deceased-estates');
  listUrl.searchParams.set('results-page-size', String(Math.min(limit, 100)));

  let listJson: unknown;
  try {
    const res = await timedFetch(listUrl.toString(), REQUEST_TIMEOUT_MS);
    if (!res.ok) {
      console.warn(`[scouting/gazette] list HTTP ${res.status}`);
      return [];
    }
    listJson = await res.json().catch(() => null);
  } catch (err) {
    console.warn('[scouting/gazette] list fetch failed', err);
    return [];
  }
  if (!listJson || typeof listJson !== 'object') return [];

  const entries = (listJson as { entry?: unknown[] }).entry;
  if (!Array.isArray(entries) || entries.length === 0) {
    console.info('[scouting/gazette] zero list entries');
    return [];
  }

  // ---- 2. Fetch each notice's detail in batches ----
  const ids = entries
    .map((e) => extractNoticeId((e as Record<string, unknown>).id))
    .filter((id): id is string => !!id);

  const details: unknown[] = [];
  for (let i = 0; i < ids.length; i += PARALLEL_DETAIL_BATCH) {
    const slice = ids.slice(i, i + PARALLEL_DETAIL_BATCH);
    const batch = await Promise.all(
      slice.map((id) => fetchNoticeDetail(id).catch(() => null)),
    );
    for (const d of batch) {
      if (d) details.push(d);
    }
  }

  // ---- 3. Parse each detail into a ProbateLead ----
  const cutoffMs = Date.now() - sinceDays * 86_400_000;
  const leads: ProbateLead[] = [];
  for (const d of details) {
    const lead = parseNoticeDetail(d);
    if (!lead) continue;
    const pubMs = new Date(lead.grantDate).getTime();
    if (Number.isFinite(pubMs) && pubMs < cutoffMs) continue;
    leads.push(lead);
    if (leads.length >= limit) break;
  }

  console.info(
    `[scouting/gazette] list=${entries.length} details=${details.length} parsed=${leads.length}`,
  );
  return leads;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function timedFetch(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function extractNoticeId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/\/notice\/(\d+)/);
  return m?.[1] ?? null;
}

async function fetchNoticeDetail(id: string): Promise<unknown | null> {
  const url = `https://www.thegazette.co.uk/notice/${id}/data.json?view=linked-data`;
  const res = await timedFetch(url, REQUEST_TIMEOUT_MS);
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

/**
 * Parse The Gazette linked-data JSON for a single notice into a ProbateLead.
 *
 * Real shape:
 *   result.primaryTopic
 *     .type[]                  — must include a "deceased-estate" type to qualify
 *     .hasNoticeID
 *     .hasPublicationDate      — "Wednesday, 13-May-2026 19:20:09 UTC"
 *     .isAbout
 *       .type[]
 *       .postcode[]            — [{ label: "CV6 1NJ", lat, long, ... }, ...]
 *       .person
 *         .name                — full name (e.g. "O'HANLON David William")
 *         .familyName
 *         .firstName
 *         .hasPersonDetails    — prose: "NAME, of [addr], lately of [addr]..."
 *       .hasOfficialReceiver / .administrator / .solicitor — varies
 */
function parseNoticeDetail(json: unknown): ProbateLead | null {
  if (!json || typeof json !== 'object') return null;
  const result = (json as Record<string, unknown>).result as
    | Record<string, unknown>
    | undefined;
  if (!result) return null;
  const topic = result.primaryTopic as Record<string, unknown> | undefined;
  if (!topic) return null;

  // ---- 1. Must be a deceased-estate notice (filter out insolvency) ----
  const topLevelTypes = arrayOf(topic.type);
  const isAbout = topic.isAbout as Record<string, unknown> | undefined;
  const aboutTypes = arrayOf(isAbout?.type);
  const allTypes = [...topLevelTypes, ...aboutTypes].map((t) => String(t).toLowerCase());
  const isDeceasedEstate = allTypes.some((t) =>
    t.includes('deceased') || t.includes('estate-of'),
  );
  if (!isDeceasedEstate) return null;

  // ---- 2. Postcode (structured array preferred) ----
  const postcodeArr = arrayOf(isAbout?.postcode);
  const postcode = pickFirstPostcodeLabel(postcodeArr);
  if (!postcode) return null;

  // ---- 3. Deceased name ----
  const person = isAbout?.person as Record<string, unknown> | undefined;
  let deceasedName: string | null = null;
  if (person) {
    deceasedName = stringOrNull(person.name);
    if (!deceasedName) {
      const first = stringOrNull(person.firstName);
      const family = stringOrNull(person.familyName);
      if (first || family) deceasedName = [first, family].filter(Boolean).join(' ');
    }
  }

  // ---- 4. Address — extract from prose near the matching postcode ----
  const prose = person ? stringOrNull(person.hasPersonDetails) : null;
  const address = prose ? extractAddressForPostcode(prose, postcode) : null;
  if (!address) return null;

  // ---- 5. Publication date ----
  const pubDate = parsePubDate(stringOrNull(topic.hasPublicationDate));
  const grantDate = new Date(pubDate).toISOString().slice(0, 10);
  const daysSince = Math.max(0, Math.floor((Date.now() - pubDate) / 86_400_000));

  // ---- 6. Solicitor / administrator firm (best effort) ----
  const administrator = (isAbout?.administrator ?? isAbout?.hasOfficialReceiver) as
    | Record<string, unknown>
    | undefined;
  const solicitorFirm = administrator
    ? stringOrNull((administrator.adr as Record<string, unknown> | undefined)?.extendedAddress) ??
      stringOrNull(administrator.name)
    : null;

  const noticeId = stringOrNull(topic.hasNoticeID) ?? stringOrNull(topic.hasNoticeNumber);

  try {
    return ProbateLeadSchema.parse({
      probateRef: noticeId ? `gazette-${noticeId}` : `gazette-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      address: address.trim(),
      postcode: postcode.toUpperCase(),
      grantDate,
      executorName: deceasedName,
      solicitorFirm,
      estateValuePence: null,
      grantType: 'probate',
      source: 'gazette',
      daysSinceGrant: daysSince,
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

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
    if (typeof p === 'string') return p; // raw string fallback
    if (p && typeof p === 'object') {
      const label = (p as Record<string, unknown>).label;
      if (typeof label === 'string') return label;
    }
  }
  return null;
}

/**
 * "Wednesday, 13-May-2026 19:20:09 UTC" → epoch ms. Falls back to now.
 */
function parsePubDate(raw: string | null): number {
  if (!raw) return Date.now();
  const cleaned = raw.replace(/^[A-Za-z]+, /, '').replace(/-/g, ' ');
  const ms = Date.parse(cleaned);
  return Number.isFinite(ms) ? ms : Date.now();
}

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

/**
 * Pull the street address that precedes the given postcode in the prose.
 * Handles patterns like "DECEASED NAME, of 5 Hewitt Avenue, Counden,
 * Coventry, CV6 1NJ, lately of 38 Parkville Highway, Coventry, CV6 4HZ".
 *
 * Walks back from the postcode position until we hit ", of " / ", lately of "
 * or the start of the prose.
 */
function extractAddressForPostcode(prose: string, postcode: string): string | null {
  // Normalise postcode for searching (strip space).
  const compact = postcode.replace(/\s/g, '').toUpperCase();
  const propose = prose.toUpperCase();
  // Find every UK postcode in prose; pick the one matching ours.
  const re = /([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})/g;
  let match: RegExpExecArray | null;
  let foundIdx = -1;
  while ((match = re.exec(propose)) !== null) {
    if (`${match[1]}${match[2]}` === compact) {
      foundIdx = match.index;
      break;
    }
  }
  if (foundIdx < 0) {
    // Try a relaxed match — any UK postcode in the prose.
    const any = prose.match(UK_POSTCODE_RE);
    if (!any || any.index === undefined) return null;
    foundIdx = any.index;
  }

  const beforePostcode = prose.slice(0, foundIdx).trimEnd().replace(/,$/, '');
  // Backtrack: find the last "of " marker.
  const ofMatches = [...beforePostcode.matchAll(/\b(lately of|of)\s+/gi)];
  if (ofMatches.length === 0) {
    // No "of " — take up to 80 chars before the postcode as the address.
    return beforePostcode.slice(-80).trim();
  }
  const last = ofMatches[ofMatches.length - 1];
  if (!last || last.index === undefined) return null;
  const start = last.index + last[0].length;
  return beforePostcode.slice(start).trim();
}

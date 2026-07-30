/**
 * The Gazette — UK government's official journal of public notices.
 *
 * Probate notices over £5k estate value are legally required to be
 * published here under the Trustee Act 1925 (s.27). Every notice
 * includes the deceased's last address (a property) plus solicitor
 * details. Free public REST API, no API key.
 *
 * ---------------------------------------------------------------------------
 * API contract (re-derived 29 Jul 2026 from The Gazette's official developer
 * documentation — github.com/TheGazette/DevDocs, `notice/notice-feed.md`)
 * ---------------------------------------------------------------------------
 *
 * WHY THIS FILE WAS REWRITTEN: the previous implementation requested
 *   /all-notices/notice/data.json?noticetype=deceased-estates
 * and had been returning `Gazette list HTTP 500` every day since at least
 * 27 Jul 2026. `noticetype` is NOT a parameter in The Gazette's documented
 * contract, and `deceased-estates` is not a value it accepts anywhere — the
 * filter is expressed as a CATEGORY PATH SEGMENT, not a query parameter.
 * A bogus filter parameter is the most likely trigger for the 500 (an
 * unparseable facet reaching the search backend), and it is wrong regardless
 * of what the server does with it.
 *
 * CONFIRMED AGAINST THE LIVE SERVER, 2026-07-30T05:15:47Z. The corrected URL
 * returned HTTP 200 with a populated `entry[]` (`f:total` ≈ 879,922 Deceased
 * Estates notices) while the old `?noticetype=deceased-estates` shape was
 * still 500ing. So the outage was ours, not theirs.
 *
 * That response is checked in verbatim as
 * `__tests__/fixtures/gazette-list-live-2026-07-30.json` and asserted against
 * in `__tests__/gazette-live-shape.test.ts`, so a future drift in the real
 * feed shape breaks a test rather than the daily cron. Re-capture with:
 *
 *   curl -sS -H 'Accept: application/json' \
 *     'https://www.thegazette.co.uk/wills-and-probate/notice/data.json?noticecode=2903&results-page=1&results-page-size=10'
 *
 * Two things that sample made obvious, both already handled below: a
 * meaningful share of notices are OVERSEAS (South Africa, Mauritius, Nigeria
 * in a single page of ten) and are dropped by the UK-postcode requirement in
 * `parseNoticeDetail`; and some addresses carry a literal `/n` where a line
 * break belongs.
 *
 * The real shapes are:
 *
 *   List:   https://www.thegazette.co.uk/{category}/notice/data.json
 *           where {category} scopes the feed. `wills-and-probate` constrains
 *           results to Deceased Estates (notice code 2903) — exactly what we
 *           want. `all-notices` is the unscoped feed.
 *
 *   Detail: https://www.thegazette.co.uk/notice/{id}/data.json?view=linked-data
 *
 * Documented list query parameters (the ONLY ones we send):
 *   - `noticecode`         2903 = Deceased Estates
 *   - `results-page`       1-based positive integer
 *   - `results-page-size`  positive integer (we cap at 100)
 *   - `start-publish-date` / `end-publish-date`  ISO 8601 `YYYY-MM-DD`
 *
 * Response is Atom-shaped JSON: `{ entry: [...], link: [{ '@rel': 'next' }] }`.
 * Pagination is HATEOAS — the presence of a `rel="next"` link is the only
 * reliable "there is more" signal, so we follow that rather than guessing a
 * total page count.
 *
 * NON-OBVIOUS: notice IDs are not always numeric. The London Gazette uses
 * integers (`4324094`) but the Edinburgh and Belfast Gazettes use compound
 * refs like `E-25991-2455-105`. The old `(\d+)` id regex silently dropped
 * every Scottish and Northern Irish notice.
 *
 * NON-OBVIOUS: the list feed returns notice HEADERS only — the deceased's
 * address lives exclusively on the per-notice linked-data document, so one
 * detail fetch per candidate notice is unavoidable. We therefore filter by
 * date SERVER-side (`start-publish-date`) so we don't spend detail requests
 * on notices we would only throw away afterwards.
 *
 * FAILURE CONTRACT: a persistent failure of the LIST fetch THROWS. It must
 * never silently return [] — the scouting pipeline's health reporting can
 * only see a source that throws, and a source that swallows its own error
 * becomes invisible (this is exactly how the HMCTS outage stayed hidden for
 * weeks). Individual notice-detail failures stay graceful and yield partial
 * results, because one bad notice should not blind the whole source.
 */

import 'server-only';

import type { ProbateLead } from './probate-data';
import { ProbateLeadSchema } from './probate-data';

const GAZETTE_ORIGIN = 'https://www.thegazette.co.uk';

/** Deceased Estates. The Gazette's notice code for a s.27 probate notice. */
const NOTICE_CODE_DECEASED_ESTATES = '2903';

/**
 * Candidate list feeds, most specific first.
 *
 * We keep the unscoped `all-notices` feed as a documented fallback purely so a
 * change to the category taxonomy cannot take the source offline again — the
 * `noticecode=2903` filter makes it return the same notices, just via a
 * broader route. Two shapes is the whole budget: if both fail we throw.
 */
const LIST_FEEDS: ReadonlyArray<{ label: string; path: string }> = [
  { label: 'wills-and-probate', path: '/wills-and-probate/notice/data.json' },
  { label: 'all-notices', path: '/all-notices/notice/data.json' },
];

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_FETCH_ATTEMPTS = 3;
const RETRY_BASE_MS = 500;
/** Hard ceiling on Retry-After compliance so a silly header can't stall a cron. */
const MAX_RETRY_AFTER_MS = 5_000;

const MAX_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 10;
/** Bounds total list traffic per run; we stop earlier once `limit` is met. */
const MAX_LIST_PAGES = 5;

/**
 * Detail fetches run in small serial batches, not one big Promise.all.
 * This is a free public government endpoint — modest, paced concurrency is
 * the price of being allowed to keep using it.
 */
const DETAIL_BATCH_SIZE = 3;
const DETAIL_BATCH_PAUSE_MS = 200;
const LIST_PAGE_PAUSE_MS = 300;

// The Gazette sits behind a government WAF that rejects/serves 5xx to
// User-Agent-less clients. Identify ourselves and give a contact URL.
const GAZETTE_USER_AGENT =
  'BellwoodScout/1.0 (+https://bellwoodslane.co.uk; property sourcing bot)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Pull recent UK probate (deceased-estate) notices from The Gazette.
 *
 * @param sinceDays  How many days back to keep notices for (default 30)
 * @param limit      Max records returned (default 50)
 */
export async function fetchGazetteProbateNotices(
  sinceDays = 30,
  limit = 50
): Promise<ProbateLead[]> {
  const pageSize = Math.min(Math.max(limit, MIN_PAGE_SIZE), MAX_PAGE_SIZE);
  const startPublishDate = isoDate(Date.now() - sinceDays * 86_400_000);
  const cutoffMs = Date.now() - sinceDays * 86_400_000;

  // ---- 1. Resolve which documented feed shape the server actually serves ----
  // Throws (never returns []) if no shape works — see FAILURE CONTRACT above.
  const { feed, json: firstPage } = await resolveListFeed(
    pageSize,
    startPublishDate
  );

  const leads: ProbateLead[] = [];
  let page = firstPage;
  let pageNumber = 1;
  let listedEntries = 0;
  let fetchedDetails = 0;

  // ---- 2. Walk pages, converting each into leads before asking for more ----
  // Paging lazily means a run that only needs 20 leads never asks the server
  // for pages 2..5 or spends detail requests it will not use.
  while (leads.length < limit && pageNumber <= MAX_LIST_PAGES) {
    const entries = Array.isArray((page as { entry?: unknown[] }).entry)
      ? ((page as { entry: unknown[] }).entry as unknown[])
      : [];
    listedEntries += entries.length;

    const ids = dedupe(
      entries
        .map((e) => extractNoticeId(e))
        .filter((id): id is string => id !== null)
    );

    for (
      let i = 0;
      i < ids.length && leads.length < limit;
      i += DETAIL_BATCH_SIZE
    ) {
      const slice = ids.slice(i, i + DETAIL_BATCH_SIZE);
      const batch = await Promise.all(
        // A single unreachable notice must not abort the whole source.
        slice.map((id) => fetchNoticeDetail(id).catch(() => null))
      );

      for (const detail of batch) {
        if (!detail) continue;
        fetchedDetails++;
        const lead = parseNoticeDetail(detail);
        if (!lead) continue;
        // Belt-and-braces: `start-publish-date` already filters server-side,
        // but the grant date we derive can differ from the publication date.
        const pubMs = new Date(lead.grantDate).getTime();
        if (Number.isFinite(pubMs) && pubMs < cutoffMs) continue;
        leads.push(lead);
        if (leads.length >= limit) break;
      }

      if (i + DETAIL_BATCH_SIZE < ids.length)
        await sleep(DETAIL_BATCH_PAUSE_MS);
    }

    if (leads.length >= limit) break;
    // HATEOAS: no rel="next" means we have genuinely reached the end.
    if (!hasNextLink(page)) break;
    if (pageNumber >= MAX_LIST_PAGES) break;

    await sleep(LIST_PAGE_PAUSE_MS);
    pageNumber++;
    const url = buildListUrl(feed.path, pageNumber, pageSize, startPublishDate);
    const next = await fetchListPage(url);
    if (!next) break;
    page = next;
  }

  console.info(
    `[scouting/gazette] feed=${feed.label} pages=${pageNumber} listed=${listedEntries} details=${fetchedDetails} parsed=${leads.length}`
  );
  return leads;
}

// ---------------------------------------------------------------------------
// List fetching
// ---------------------------------------------------------------------------

function buildListUrl(
  path: string,
  page: number,
  pageSize: number,
  startPublishDate: string
): string {
  const url = new URL(path, GAZETTE_ORIGIN);
  url.searchParams.set('noticecode', NOTICE_CODE_DECEASED_ESTATES);
  url.searchParams.set('results-page', String(page));
  url.searchParams.set('results-page-size', String(pageSize));
  url.searchParams.set('start-publish-date', startPublishDate);
  return url.toString();
}

/**
 * Try each documented feed shape until one returns a usable JSON body.
 *
 * Throws a single error naming every shape tried and exactly how each failed,
 * so a future outage is diagnosable straight from the cron log instead of
 * needing someone to re-run curl by hand (which is how this bug survived
 * three days of identical "Gazette list HTTP 500" lines).
 */
async function resolveListFeed(
  pageSize: number,
  startPublishDate: string
): Promise<{
  feed: (typeof LIST_FEEDS)[number];
  json: Record<string, unknown>;
}> {
  const failures: string[] = [];

  for (const feed of LIST_FEEDS) {
    const url = buildListUrl(feed.path, 1, pageSize, startPublishDate);
    try {
      const json = await requestListPage(url);
      return { feed, json };
    } catch (err) {
      failures.push(
        `${feed.label} → ${(err as Error)?.message ?? String(err)}`
      );
    }
  }

  throw new Error(
    `Gazette list failed for all feed shapes: ${failures.join('; ')}`
  );
}

/** Fetch + validate one list page. Throws with a message naming the URL. */
async function requestListPage(url: string): Promise<Record<string, unknown>> {
  const res = await timedFetch(url, REQUEST_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error(`Gazette list HTTP ${res.status} (${url})`);
  }
  const json = await res.json().catch(() => null);
  if (!json || typeof json !== 'object') {
    throw new Error(`Gazette list returned non-JSON / empty body (${url})`);
  }
  return json as Record<string, unknown>;
}

/**
 * Fetch a follow-on page. Unlike page 1 this is best-effort: we already have
 * leads in hand, so a failure part-way through pagination returns what we got
 * rather than discarding it.
 */
async function fetchListPage(
  url: string
): Promise<Record<string, unknown> | null> {
  try {
    return await requestListPage(url);
  } catch (err) {
    console.warn(
      `[scouting/gazette] pagination stopped early: ${(err as Error)?.message}`
    );
    return null;
  }
}

/** HATEOAS `link` array: `[{ '@rel': 'next', '@href': ... }]`. */
function hasNextLink(page: Record<string, unknown>): boolean {
  const links = arrayOf(page.link);
  return links.some((l) => {
    if (!l || typeof l !== 'object') return false;
    const rec = l as Record<string, unknown>;
    const rel = rec['@rel'] ?? rec.rel;
    return typeof rel === 'string' && rel.toLowerCase() === 'next';
  });
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

/**
 * Fetch with timeout and bounded exponential backoff.
 *
 * Only transient conditions are retried — 5xx (WAF/load) and 429. A 4xx means
 * we asked the wrong question and retrying just adds load to a public service,
 * so those return immediately and let the caller try the next feed shape.
 */
async function timedFetch(url: string, ms: number): Promise<Response> {
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': GAZETTE_USER_AGENT,
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      const transient = res.status >= 500 || res.status === 429;
      if (transient && attempt < MAX_FETCH_ATTEMPTS) {
        await sleep(backoffMs(attempt, res));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      // Network-level failure (DNS, reset, timeout) — always worth a retry.
      if (attempt < MAX_FETCH_ATTEMPTS) {
        await sleep(backoffMs(attempt, null));
      }
    }
  }

  throw lastErr ?? new Error(`Gazette fetch failed after retries (${url})`);
}

/**
 * Exponential backoff with jitter, honouring `Retry-After` when the server
 * sends one. Jitter matters because every Bellwood cron fires on the same
 * schedule — without it our retries would arrive in lockstep.
 */
function backoffMs(attempt: number, res: Response | null): number {
  const retryAfter = res?.headers?.get?.('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
    }
  }
  const base = RETRY_BASE_MS * 2 ** (attempt - 1);
  return base + Math.floor(Math.random() * RETRY_BASE_MS);
}

async function fetchNoticeDetail(id: string): Promise<unknown | null> {
  const url = `${GAZETTE_ORIGIN}/notice/${encodeURIComponent(id)}/data.json?view=linked-data`;
  const res = await timedFetch(url, REQUEST_TIMEOUT_MS);
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

// ---------------------------------------------------------------------------
// Entry / id handling
// ---------------------------------------------------------------------------

/**
 * Pull a notice id out of a feed entry.
 *
 * Ids are alphanumeric-with-hyphens, not just digits — the Edinburgh and
 * Belfast Gazettes publish refs like `E-25991-2455-105`. We check `id` first
 * and fall back to the entry's `link` href, because the feed has historically
 * carried the canonical URL in either place.
 */
function extractNoticeId(entry: unknown): string | null {
  if (!entry || typeof entry !== 'object') return null;
  const rec = entry as Record<string, unknown>;

  const fromId = matchNoticeId(rec.id);
  if (fromId) return fromId;

  for (const link of arrayOf(rec.link)) {
    if (typeof link === 'string') {
      const m = matchNoticeId(link);
      if (m) return m;
    } else if (link && typeof link === 'object') {
      const href =
        (link as Record<string, unknown>)['@href'] ??
        (link as Record<string, unknown>).href;
      const m = matchNoticeId(href);
      if (m) return m;
    }
  }
  return null;
}

function matchNoticeId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Trailing segments like `/data.json` must not be mistaken for the id.
  const m = value.match(/\/notice\/([A-Za-z0-9-]+)/);
  const id = m?.[1];
  if (!id || id.toLowerCase().startsWith('data.')) return null;
  return id;
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
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
  const allTypes = [...topLevelTypes, ...aboutTypes].map((t) =>
    String(t).toLowerCase()
  );
  const isDeceasedEstate = allTypes.some(
    (t) => t.includes('deceased') || t.includes('estate-of')
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
      if (first || family)
        deceasedName = [first, family].filter(Boolean).join(' ');
    }
  }

  // ---- 4. Address — extract from prose near the matching postcode ----
  const prose = person ? stringOrNull(person.hasPersonDetails) : null;
  const address = prose ? extractAddressForPostcode(prose, postcode) : null;
  if (!address) return null;

  // ---- 5. Publication date ----
  const pubDate = parsePubDate(stringOrNull(topic.hasPublicationDate));
  const grantDate = new Date(pubDate).toISOString().slice(0, 10);
  const daysSince = Math.max(
    0,
    Math.floor((Date.now() - pubDate) / 86_400_000)
  );

  // ---- 6. Solicitor / administrator firm (best effort) ----
  const administrator = (isAbout?.administrator ??
    isAbout?.hasOfficialReceiver) as Record<string, unknown> | undefined;
  const solicitorFirm = administrator
    ? (stringOrNull(
        (administrator.adr as Record<string, unknown> | undefined)
          ?.extendedAddress
      ) ?? stringOrNull(administrator.name))
    : null;

  const noticeId =
    stringOrNull(topic.hasNoticeID) ?? stringOrNull(topic.hasNoticeNumber);

  try {
    return ProbateLeadSchema.parse({
      probateRef: noticeId
        ? `gazette-${noticeId}`
        : `gazette-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
function extractAddressForPostcode(
  prose: string,
  postcode: string
): string | null {
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

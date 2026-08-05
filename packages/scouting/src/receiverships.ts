/**
 * Receivership source — properties whose LENDER has taken control.
 *
 * When a property company defaults, the lender appoints a receiver
 * (administrative receiver / fixed-charge "LPA" receiver) or the company
 * enters administration. The office-holder MUST realise the security — they
 * don't refurb, and they don't wait for a better market. That makes this the
 * single most motivated vendor class there is, and it structurally favours a
 * chain-free cash buyer.
 *
 * Why now (deep-research findings, Aug 2026, sources in
 * docs/architecture/sourcing-channels.md): receivership appointments are
 * ~2x 2023 and ~3x 2022 levels; 65% of appointments are residential; and
 * insolvency stock reaching auction is up ~45% year-on-year. Crucially there
 * is a LAG between appointment and sale (Land Registry + court backlogs) —
 * the window where a direct approach beats waiting for the catalogue.
 *
 * ---------------------------------------------------------------------------
 * API contract — VERIFIED AGAINST THE LIVE SERVER, 2026-08-05
 * ---------------------------------------------------------------------------
 * A browser probe of {origin}/insolvency/notice/data.json (no noticecode
 * filter) returned HTTP 200 with `f:total` ≈ 3.3M notices. That response is
 * checked in as `__tests__/fixtures/gazette-insolvency-live-2026-08-05.json`
 * and asserted against in `__tests__/receiverships.test.ts`, so feed drift
 * breaks a test rather than the cron. Learnings baked in below:
 *
 *  - Do NOT filter by `noticecode` at fetch time. The corporate-insolvency
 *    code taxonomy differs from our first guess (live data shows e.g.
 *    2442 = Meetings of Creditors, 2443 = Appointment of Liquidators), and a
 *    wrong code value is exactly the request shape that 500s. The reliable
 *    discriminator is each entry's `category['@term']` — filter client-side
 *    on "Appointment of Receivers" / "Appointment of Administrators".
 *  - Entry `title` is the clean COMPANY NAME.
 *  - The company number lives in the `content` HTML string, in at least two
 *    shapes: "(Company Number 11416317 )" and "Company Number: 09184913".
 *  - Pagination is HATEOAS (`link[@rel=next]`), same as ./gazette.ts.
 *
 * Pipeline:
 *   1. Page the insolvency feed newest-first; keep receiver/administrator
 *      appointment notices inside the look-back window.
 *   2. Each notice names the COMPANY. The properties live in the company's
 *      registered CHARGES — so we look up the company at Companies House and
 *      mine the charge particulars for UK property addresses (same API +
 *      auth convention as ./companies-house-charges.ts).
 *   3. Emit one lead per property address found. High precision by design:
 *      a notice whose charges yield no address is dropped, not guessed.
 *
 * FAILURE CONTRACT (matches gazette.ts / companies-house-charges.ts): a
 * persistent failure of the Gazette LIST fetch THROWS so the pipeline's
 * source-health reporting can see it. Per-notice and per-company failures
 * degrade gracefully into partial results with the first error surfaced.
 */

import 'server-only';

import { extractPostcode } from './address-normalise';

const GAZETTE_ORIGIN = 'https://www.thegazette.co.uk';
const CH_BASE = 'https://api.company-information.service.gov.uk';
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Category terms that mean "a lender/office-holder now controls the assets".
 * Matched against entry.category['@term'] — the live feed's discriminator.
 * Liquidators are included: a liquidator must realise assets exactly like a
 * receiver, and "Appointment of Liquidators" is confirmed present in the
 * live feed (code 2443).
 */
const APPOINTMENT_TERM_REGEX =
  /appointment of (?:.*\b)?(receivers?|administrators?|liquidators?)\b/i;

/** Look-back window — a daily cron double-covers itself at 10 days. */
const DEFAULT_SINCE_DAYS = 10;
/** Cap on notices whose companies we poll at CH per run (1-2 calls each). */
const DEFAULT_MAX_NOTICES = 25;
/** Feed pages to walk per run (100 notices/page, newest first). */
const MAX_FEED_PAGES = 3;
/** UK postcode, used to mine charge particulars for property addresses. */
const POSTCODE_REGEX = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})\b/g;
/**
 * Company-number shapes seen in live notice content (2026-08-05 fixture):
 * "(Company Number 11416317 )" and "Company Number: 09184913".
 */
const COMPANY_NUMBER_REGEX =
  /\b(?:company\s+number|co\.?\s*no\.?)[:\s]*\(?\s*([A-Z]{0,2}\d{6,8})\b/i;
const BARE_NUMBER_REGEX = /\(\s*([A-Z]{0,2}\d{6,8})\s*\)/;

export interface ReceivershipNotice {
  id: string;
  /** Entry title — the company name, verbatim. */
  companyName: string;
  /** Title + content text, used for company-number extraction. */
  searchText: string;
  published: string | null;
  link: string | null;
  noticeCode: string | null;
  categoryTerm: string;
}

export interface ReceivershipRawLead {
  probateRef: string;
  address: string;
  postcode: string;
  grantDate: string;
  executorName: null;
  solicitorFirm: string | null;
  estateValuePence: number | null;
  grantType: 'unknown';
  source: 'gazette_receivership';
  daysSinceGrant: number;
  /** Scorer motivation class (see scorer-config leadTypeScores). */
  leadTypeHint: 'receivership';
  /** Receivership detail — flows through rawPayload to the UI. */
  receivershipSignal: {
    companyNumber: string | null;
    companyName: string;
    noticeCode: string | null;
    categoryTerm: string;
    noticeId: string;
    noticeUrl: string | null;
    publishedAt: string | null;
    /** The charge particulars line the address was mined from. */
    particulars: string | null;
    lender: string | null;
  };
}

export interface ReceivershipScoutResult {
  leads: ReceivershipRawLead[];
  noticesScanned: number;
  companiesPolled: number;
  /** First per-notice/per-company error, when partial. */
  error?: string;
}

export interface ReceivershipScoutOptions {
  sinceDays?: number;
  maxNotices?: number;
}

/**
 * Parse one page of the insolvency feed. Pure — exported so the checked-in
 * live fixture can assert against it.
 */
export function parseInsolvencyFeedPage(
  page: unknown,
  cutoff: Date
): {
  notices: ReceivershipNotice[];
  /** True when the page contained entries older than the cutoff — stop paging. */
  reachedCutoff: boolean;
  nextUrl: string | null;
} {
  const root = (page ?? {}) as Record<string, unknown>;
  const entries = Array.isArray(root.entry)
    ? (root.entry as Array<Record<string, unknown>>)
    : [];

  const notices: ReceivershipNotice[] = [];
  let reachedCutoff = false;

  for (const e of entries) {
    const published = typeof e.published === 'string' ? e.published : null;
    if (published && new Date(published) < cutoff) {
      reachedCutoff = true;
      continue;
    }

    const categoryTerm =
      typeof (e.category as Record<string, unknown> | undefined)?.['@term'] ===
      'string'
        ? String((e.category as Record<string, unknown>)['@term'])
        : '';
    if (!APPOINTMENT_TERM_REGEX.test(categoryTerm)) continue;

    const id = String(e.id ?? '').split('/').pop() ?? '';
    if (!id) continue;

    const title = String(e.title ?? '').trim();
    const content =
      typeof e.content === 'string'
        ? e.content
        : typeof (e.content as Record<string, unknown> | undefined)?.$t ===
            'string'
          ? String((e.content as Record<string, unknown>).$t)
          : '';

    notices.push({
      id,
      companyName: title,
      searchText: `${title} ${content}`.trim(),
      published,
      link: extractNoticeLink(e, id),
      noticeCode:
        typeof e['f:notice-code'] === 'string'
          ? (e['f:notice-code'] as string)
          : null,
      categoryTerm,
    });
  }

  return { notices, reachedCutoff, nextUrl: extractNextLink(root) };
}

export async function fetchReceivershipLeads(
  options: ReceivershipScoutOptions = {}
): Promise<ReceivershipScoutResult> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'receivership source: COMPANIES_HOUSE_API_KEY is not configured'
    );
  }

  const sinceDays = options.sinceDays ?? DEFAULT_SINCE_DAYS;
  const maxNotices = options.maxNotices ?? DEFAULT_MAX_NOTICES;
  const cutoff = new Date(Date.now() - sinceDays * 24 * 3600_000);

  // 1 — Page the insolvency feed newest-first. A total failure THROWS
  // (contract); a partial walk keeps what it got.
  const notices: ReceivershipNotice[] = [];
  let url: string | null =
    `${GAZETTE_ORIGIN}/insolvency/notice/data.json?results-page=1&results-page-size=100`;
  let pagesFetched = 0;
  let noticesScanned = 0;
  let firstError: string | undefined;

  while (url && pagesFetched < MAX_FEED_PAGES) {
    let pageJson: unknown;
    try {
      pageJson = await fetchJson(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (pagesFetched === 0) {
        throw new Error(
          `receivership source: Gazette insolvency feed unreachable — ${msg}`
        );
      }
      firstError = firstError ?? `page ${pagesFetched + 1}: ${msg}`;
      break;
    }
    pagesFetched++;

    const root = (pageJson ?? {}) as Record<string, unknown>;
    noticesScanned += Array.isArray(root.entry)
      ? (root.entry as unknown[]).length
      : 0;

    const parsed = parseInsolvencyFeedPage(pageJson, cutoff);
    notices.push(...parsed.notices);
    if (parsed.reachedCutoff) break;
    url = parsed.nextUrl;
  }

  // 2 — Per notice: company number from title+content, then charges at CH.
  const leads: ReceivershipRawLead[] = [];
  let companiesPolled = 0;
  const seenCompanies = new Set<string>();

  for (const notice of notices.slice(0, maxNotices)) {
    const companyNumber = extractCompanyNumber(notice.searchText);
    if (!companyNumber || seenCompanies.has(companyNumber)) continue;
    seenCompanies.add(companyNumber);

    try {
      companiesPolled++;
      const charges = (await fetchJson(
        `${CH_BASE}/company/${companyNumber}/charges`,
        apiKey
      )) as { items?: Array<Record<string, unknown>> };

      for (const charge of charges.items ?? []) {
        const particulars =
          typeof (charge.particulars as Record<string, unknown> | undefined)
            ?.description === 'string'
            ? ((charge.particulars as Record<string, unknown>)
                .description as string)
            : null;
        if (!particulars) continue;

        // Mine every UK postcode out of the particulars — each one is a
        // secured property the office-holder will have to sell.
        POSTCODE_REGEX.lastIndex = 0;
        let m: RegExpExecArray | null = POSTCODE_REGEX.exec(particulars);
        while (m) {
          const postcode = `${m[1]} ${m[2]}`.toUpperCase();
          // Address = the particulars text up to the postcode, last ~120
          // chars — charge particulars read "land at 12 Elm Road, London
          // SE13 5AB" so the tail before the postcode is the address.
          const before = particulars.slice(0, m.index).trim();
          const address =
            before.split(/[;.]/).pop()?.trim().slice(-120) ||
            notice.companyName;

          const lender = extractLender(charge);
          leads.push({
            probateRef: `rcv-${notice.id}-${postcode.replace(/\s+/g, '')}`,
            address: `${address}, ${postcode}`,
            postcode,
            grantDate:
              notice.published?.slice(0, 10) ??
              new Date().toISOString().slice(0, 10),
            executorName: null,
            solicitorFirm: null,
            estateValuePence: null,
            grantType: 'unknown',
            source: 'gazette_receivership',
            daysSinceGrant: notice.published
              ? Math.max(
                  0,
                  Math.floor(
                    (Date.now() - new Date(notice.published).getTime()) /
                      86_400_000
                  )
                )
              : 0,
            leadTypeHint: 'receivership',
            receivershipSignal: {
              companyNumber,
              companyName: notice.companyName,
              noticeCode: notice.noticeCode,
              categoryTerm: notice.categoryTerm,
              noticeId: notice.id,
              noticeUrl: notice.link,
              publishedAt: notice.published,
              particulars: particulars.slice(0, 500),
              lender,
            },
          });
          m = POSTCODE_REGEX.exec(particulars);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!firstError) firstError = `company ${companyNumber}: ${msg}`;
      console.warn(
        `[scouting/receivership] CH poll failed for ${companyNumber}`,
        err
      );
    }
  }

  return {
    leads: dedupeLeads(leads),
    noticesScanned,
    companiesPolled,
    ...(firstError ? { error: firstError.slice(0, 200) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a Companies House number from notice text. Pure — exported for the
 * fixture test, which asserts both live formats:
 * "(Company Number 11416317 )" and "Company Number: 09184913".
 */
export function extractCompanyNumber(text: string): string | null {
  const m = COMPANY_NUMBER_REGEX.exec(text) ?? BARE_NUMBER_REGEX.exec(text);
  return m ? m[1].padStart(8, '0') : null;
}

/** The plain notice URL out of an entry's link list ("/notice/{id}"). */
function extractNoticeLink(
  entry: Record<string, unknown>,
  id: string
): string | null {
  const link = entry.link;
  const list = Array.isArray(link) ? link : link ? [link] : [];
  for (const l of list) {
    if (l && typeof l === 'object') {
      const rec = l as Record<string, unknown>;
      const href = rec['@href'];
      // The bare notice link carries no @rel and no @type in the live feed.
      if (typeof href === 'string' && !rec['@rel'] && !rec['@type']) {
        return href;
      }
    }
  }
  return `${GAZETTE_ORIGIN}/notice/${id}`;
}

/** rel="next" pagination link on the page root (HATEOAS, like gazette.ts). */
function extractNextLink(root: Record<string, unknown>): string | null {
  const link = root.link;
  const list = Array.isArray(link) ? link : link ? [link] : [];
  for (const l of list) {
    if (l && typeof l === 'object') {
      const rec = l as Record<string, unknown>;
      if (rec['@rel'] === 'next' && typeof rec['@href'] === 'string') {
        return rec['@href'] as string;
      }
    }
  }
  return null;
}

function extractLender(charge: Record<string, unknown>): string | null {
  const persons = charge.persons_entitled;
  if (Array.isArray(persons) && persons[0] && typeof persons[0] === 'object') {
    const name = (persons[0] as Record<string, unknown>).name;
    if (typeof name === 'string') return name;
  }
  return null;
}

function dedupeLeads(leads: ReceivershipRawLead[]): ReceivershipRawLead[] {
  const seen = new Set<string>();
  return leads.filter((l) => {
    const key = `${extractPostcode(l.address) ?? l.postcode}|${l.address.toLowerCase().slice(0, 40)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchJson(url: string, basicAuthUser?: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (basicAuthUser) {
      headers.authorization = `Basic ${Buffer.from(`${basicAuthUser}:`).toString('base64')}`;
    }
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

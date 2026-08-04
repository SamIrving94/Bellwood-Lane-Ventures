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
 * Pipeline:
 *   1. The Gazette corporate-insolvency feed — appointment notices.
 *      Same documented list contract as ./gazette.ts (category path segment
 *      + noticecode param): {origin}/insolvency/notice/data.json.
 *      Notice codes (The Gazette insolvency taxonomy — re-derive against
 *      github.com/TheGazette/DevDocs if the feed drifts):
 *        2452 — Appointment of Administrators
 *        2453 — Appointment of Receivers
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

/** Gazette notice codes for lender-control events. */
const NOTICE_CODES = ['2453', '2452'] as const; // receivers first, then administrators

/** Look-back window — a weekly cron double-covers itself at 10 days. */
const DEFAULT_SINCE_DAYS = 10;
/** Cap on notices whose companies we poll at CH per run (2 calls each). */
const DEFAULT_MAX_NOTICES = 25;
/** UK postcode, used to mine charge particulars for property addresses. */
const POSTCODE_REGEX = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})\b/g;
/**
 * Companies are named "... LTD (Company Number 01234567)" in notices; some
 * notices carry the bare number in parentheses instead. Both patterns are
 * tried, labelled first — could not be live-verified from the dev sandbox
 * (Gazette 403s our egress), so verify in prod via /cron/scout-debug and
 * tune here if the feed shape differs.
 */
const COMPANY_NUMBER_REGEX = /\b(?:company\s+number|co\.?\s*no\.?)[:\s]*([A-Z]{0,2}\d{6,8})\b/i;
const BARE_NUMBER_REGEX = /\(([A-Z]{0,2}\d{6,8})\)/;

export interface ReceivershipRawLead {
  probateRef: string;
  address: string;
  postcode: string;
  grantDate: string;
  executorName: null;
  solicitorFirm: string | null;
  estimateNote?: string;
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
    noticeCode: string;
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

  // 1 — Gazette insolvency list. A total failure here THROWS (contract).
  const notices: Array<{
    id: string;
    title: string;
    published: string | null;
    link: string | null;
    noticeCode: string;
  }> = [];
  let listOk = false;
  let firstListError: string | null = null;
  for (const code of NOTICE_CODES) {
    try {
      const url = `${GAZETTE_ORIGIN}/insolvency/notice/data.json?noticecode=${code}&results-page=1&results-page-size=50`;
      const res = await fetchJson(url);
      const entries = Array.isArray((res as Record<string, unknown>).entry)
        ? ((res as Record<string, unknown>).entry as Array<
            Record<string, unknown>
          >)
        : [];
      for (const e of entries) {
        const id = String(e.id ?? '').split('/').pop() ?? '';
        if (!id) continue;
        const published =
          typeof e.published === 'string' ? e.published : null;
        if (published && new Date(published) < cutoff) continue;
        // Search title AND content for the company number — the feed's
        // summary text sometimes carries it when the title doesn't.
        const content =
          typeof e.content === 'string'
            ? e.content
            : typeof (e.content as Record<string, unknown> | undefined)?.[
                  '$t'
                ] === 'string'
              ? String((e.content as Record<string, unknown>).$t)
              : '';
        notices.push({
          id,
          title: `${String(e.title ?? '')} ${content}`.trim(),
          published,
          link: extractLink(e),
          noticeCode: code,
        });
      }
      listOk = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!firstListError) firstListError = `noticecode ${code}: ${msg}`;
      console.warn(`[scouting/receivership] list fetch failed (${code})`, err);
    }
  }
  if (!listOk) {
    throw new Error(
      `receivership source: Gazette insolvency feed unreachable — ${firstListError ?? 'unknown error'}`
    );
  }

  // 2 — Per notice: company number from the title, then charges at CH.
  const leads: ReceivershipRawLead[] = [];
  let companiesPolled = 0;
  let firstError: string | undefined = firstListError ?? undefined;
  const seenCompanies = new Set<string>();

  for (const notice of notices.slice(0, maxNotices)) {
    const numMatch =
      COMPANY_NUMBER_REGEX.exec(notice.title) ??
      BARE_NUMBER_REGEX.exec(notice.title);
    const companyNumber = numMatch ? numMatch[1].padStart(8, '0') : null;
    const companyName = notice.title
      .replace(/\(company number[^)]*\)/i, '')
      .trim();
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
        // secured property the receiver will have to sell.
        POSTCODE_REGEX.lastIndex = 0;
        let m: RegExpExecArray | null = POSTCODE_REGEX.exec(particulars);
        while (m) {
          const postcode = `${m[1]} ${m[2]}`.toUpperCase();
          // Address = the particulars text up to the postcode, last ~120
          // chars — charge particulars read "land at 12 Elm Road, London
          // SE13 5AB" so the tail before the postcode is the address.
          const before = particulars.slice(0, m.index).trim();
          const address =
            before.split(/[;.]/).pop()?.trim().slice(-120) || companyName;

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
              companyName,
              noticeCode: notice.noticeCode,
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
    noticesScanned: notices.length,
    companiesPolled,
    ...(firstError ? { error: firstError.slice(0, 200) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractLink(entry: Record<string, unknown>): string | null {
  const link = entry.link;
  const list = Array.isArray(link) ? link : link ? [link] : [];
  for (const l of list) {
    if (l && typeof l === 'object') {
      const href = (l as Record<string, unknown>)['@href'];
      if (typeof href === 'string') return href;
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

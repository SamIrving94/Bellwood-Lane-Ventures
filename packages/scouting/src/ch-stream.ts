/**
 * Companies House Streaming API — event-driven charge/insolvency detection.
 *
 * Why this exists: the daily REST poll (companies-house-charges.ts /
 * receiverships.ts) bounds detection of the single most motivated vendor
 * class — lender-controlled property — at ~24h. The CH Streaming API
 * (https://stream.companieshouse.gov.uk) pushes the same underlying deltas
 * as a firehose, so a frequent short drain gets detection lag down to
 * minutes without any new data source or vendor.
 *
 * Scoped in Aug 2026 against the productised alternative (Stratum CH Watch):
 * rejected — per-company watch only (no SIC/region criteria, useless for
 * discovery), daily-poll freshness, £249/mo. The raw stream is free and is
 * the only option that supports discovery semantics.
 *
 * Serverless constraint: Vercel functions cannot hold a persistent
 * connection, so this module implements the stream-as-poll hybrid the API
 * explicitly supports — every event carries a `timepoint` and the server
 * buffers a backlog, so a cron can connect with `?timepoint=<last seen>`,
 * drain until caught up (or budget), persist the new timepoint, disconnect.
 * CH documents backlog retention loosely, so the cron must run frequently
 * (every 30 min); a 416 response means the timepoint aged out and we restart
 * from the live tail — reported loudly, never hidden.
 *
 * Pure parsing/filtering lives here (testable, no network in tests); the
 * cron route owns DB writes and orchestration.
 */

import 'server-only';

import { outwardCode } from './track';

const STREAM_BASE = 'https://stream.companieshouse.gov.uk';
const REST_BASE = 'https://api.company-information.service.gov.uk';
const REST_TIMEOUT_MS = 10_000;

/**
 * Property-holding SIC codes — MUST stay in lockstep with the REST poll in
 * companies-house-charges.ts (68100 own real estate, 68209 other letting,
 * 68320 management). A company outside these codes is noise for us even if
 * its charge particulars happen to mention a postcode.
 */
export const PROPERTY_SIC_CODES = new Set(['68100', '68209', '68320']);

/** Same postcode-mining shape as receiverships.ts — charge particulars read
 *  "land at 12 Elm Road, London SE13 5AB", so the tail before each postcode
 *  is the address. */
const POSTCODE_REGEX = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})\b/g;

export type ChStreamName = 'charges' | 'insolvency-cases';

/** One parsed event off either stream. */
export interface ChStreamEvent {
  resourceKind: string;
  resourceUri: string;
  resourceId: string;
  companyNumber: string | null;
  timepoint: number;
  publishedAt: string | null;
  /** 'changed' | 'deleted' — we only act on 'changed'. */
  eventType: string;
  data: Record<string, unknown>;
}

export interface StreamDrainResult {
  events: ChStreamEvent[];
  /** Highest timepoint seen — persist this for the next run. */
  latestTimepoint: number | null;
  /** Raw NDJSON lines read (heartbeats excluded). */
  linesRead: number;
  /** True when the stored timepoint had aged out (HTTP 416) and the drain
   *  restarted from the live tail — a coverage gap worth surfacing. */
  restartedFromLiveTail: boolean;
  /** True when the drain stopped because the read went quiet (caught up)
   *  rather than because the time budget expired. */
  caughtUp: boolean;
  error?: string;
}

/**
 * Parse one NDJSON line from a stream response. Pure. Returns null for
 * heartbeats (blank lines) and unparseable rows — a malformed line must
 * never kill a drain that is otherwise working.
 */
export function parseStreamLine(line: string): ChStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const root = parsed as Record<string, unknown>;
  const event = (root.event ?? {}) as Record<string, unknown>;
  const timepoint =
    typeof event.timepoint === 'number' ? event.timepoint : null;
  const resourceUri =
    typeof root.resource_uri === 'string' ? root.resource_uri : null;
  if (timepoint === null || !resourceUri) return null;

  return {
    resourceKind:
      typeof root.resource_kind === 'string' ? root.resource_kind : '',
    resourceUri,
    resourceId: typeof root.resource_id === 'string' ? root.resource_id : '',
    companyNumber: companyNumberFromResourceUri(resourceUri),
    timepoint,
    publishedAt:
      typeof event.published_at === 'string' ? event.published_at : null,
    eventType: typeof event.type === 'string' ? event.type : 'changed',
    data:
      root.data && typeof root.data === 'object'
        ? (root.data as Record<string, unknown>)
        : {},
  };
}

/**
 * Company number out of a stream resource_uri
 * ("/company/12345678/charges/xyz", "/company/12345678/insolvency"). Pure.
 * Returns null rather than guessing on an unrecognised shape — the SW3 rule.
 */
export function companyNumberFromResourceUri(uri: string): string | null {
  const m = /^\/company\/([A-Z0-9]{6,8})(?:\/|$)/i.exec(uri);
  return m ? m[1].toUpperCase().padStart(8, '0') : null;
}

/** True when a company-profile SIC list intersects the property codes. */
export function isPropertyCompany(sicCodes: readonly string[]): boolean {
  return sicCodes.some((c) => PROPERTY_SIC_CODES.has(c));
}

export interface MinedProperty {
  postcode: string;
  address: string;
}

/**
 * Mine UK property addresses out of charge particulars. Pure — one entry per
 * postcode found, address recovered from the text immediately before it
 * (mirrors receiverships.ts). An empty result means the charge secures
 * something we can't locate; the caller drops it rather than guessing.
 */
export function minePropertiesFromParticulars(
  particulars: string,
  fallbackName: string
): MinedProperty[] {
  const found: MinedProperty[] = [];
  POSTCODE_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null = POSTCODE_REGEX.exec(particulars);
  while (m) {
    const postcode = `${m[1]} ${m[2]}`.toUpperCase();
    const before = particulars.slice(0, m.index).trim();
    const address =
      before.split(/[;.]/).pop()?.trim().slice(-120) || fallbackName;
    found.push({ postcode, address: `${address}, ${postcode}` });
    m = POSTCODE_REGEX.exec(particulars);
  }
  return found;
}

/**
 * Keep only properties inside the founder's scanned districts. An unreadable
 * postcode is DROPPED here (unlike prime classification, where unreadable
 * never demotes): stream events are nationwide firehose noise, and a lead we
 * cannot even place in a district has no path to a viewing.
 */
export function filterToDistricts(
  properties: readonly MinedProperty[],
  districts: ReadonlySet<string>
): MinedProperty[] {
  if (districts.size === 0) return [];
  return properties.filter((p) => {
    const district = outwardCode(p.postcode);
    return district !== null && districts.has(district);
  });
}

/**
 * Map an insolvency-cases event to the scorer's motivation class. An
 * appointed office-holder (receiver / administrator / liquidator) MUST
 * realise assets — that's the receivership signal; other case types still
 * mean a distressed corporate seller.
 */
export function leadTypeForInsolvencyCase(
  caseType: string | null
): 'receivership' | 'distressed_sale' {
  if (!caseType) return 'distressed_sale';
  return /receiver|administrat|liquidat/i.test(caseType)
    ? 'receivership'
    : 'distressed_sale';
}

/**
 * Drain one stream from a stored timepoint until caught up or out of budget.
 *
 * Never throws for stream-level problems — a partial drain with an `error`
 * is more useful to the cron than an exception that loses the events already
 * read. Throws only on a missing key (misconfiguration should be loud).
 */
export async function drainCompaniesHouseStream(options: {
  stream: ChStreamName;
  streamKey: string;
  /** Timepoint from the previous run; null = first run, start at live tail. */
  sinceTimepoint: number | null;
  /** Hard wall-clock budget for the read. */
  budgetMs?: number;
  /** No bytes for this long = caught up with the live tail; stop. */
  quietMs?: number;
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
}): Promise<StreamDrainResult> {
  const {
    stream,
    streamKey,
    sinceTimepoint,
    budgetMs = 60_000,
    quietMs = 5_000,
    fetchImpl = fetch,
  } = options;
  if (!streamKey) {
    throw new Error('ch-stream: streaming key is not configured');
  }

  const result: StreamDrainResult = {
    events: [],
    latestTimepoint: sinceTimepoint,
    linesRead: 0,
    restartedFromLiveTail: false,
    caughtUp: false,
  };

  const connect = async (timepoint: number | null): Promise<Response> => {
    const qs = timepoint !== null ? `?timepoint=${timepoint}` : '';
    return await fetchImpl(`${STREAM_BASE}/${stream}${qs}`, {
      headers: {
        authorization: `Basic ${Buffer.from(`${streamKey}:`).toString('base64')}`,
      },
    });
  };

  let res: Response;
  try {
    res = await connect(sinceTimepoint);
    // 416 = our timepoint has aged out of the server's backlog. Restart from
    // the live tail and SAY SO — the gap between the old timepoint and now is
    // unobserved coverage the daily REST poll still backstops.
    if (res.status === 416 && sinceTimepoint !== null) {
      result.restartedFromLiveTail = true;
      res = await connect(null);
    }
    if (!res.ok || !res.body) {
      result.error = `stream ${stream}: HTTP ${res.status}`;
      return result;
    }
  } catch (err) {
    result.error = `stream ${stream}: ${err instanceof Error ? err.message : String(err)}`;
    return result;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const deadline = Date.now() + budgetMs;
  let buffer = '';

  try {
    while (Date.now() < deadline) {
      // Race the next chunk against the quiet window: a stream with nothing
      // buffered just stays open sending heartbeats, and "no data for a few
      // seconds" is the working definition of caught-up for a drain.
      const chunk = await Promise.race([
        reader.read(),
        new Promise<'quiet'>((resolve) =>
          setTimeout(() => resolve('quiet'), quietMs)
        ),
      ]);
      if (chunk === 'quiet') {
        result.caughtUp = true;
        break;
      }
      if (chunk.done) {
        result.caughtUp = true;
        break;
      }

      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split('\n');
      // Last element is a (possibly empty) partial line — keep it buffered.
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue; // heartbeat
        result.linesRead++;
        const event = parseStreamLine(line);
        if (!event) continue;
        result.events.push(event);
        if (
          result.latestTimepoint === null ||
          event.timepoint > result.latestTimepoint
        ) {
          result.latestTimepoint = event.timepoint;
        }
      }
    }
  } catch (err) {
    result.error = `stream ${stream} read: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return result;
}

// ---------------------------------------------------------------------------
// REST lookups the cron needs around stream events (profile for the SIC
// check, charges for insolvency events). Same auth convention as
// companies-house-charges.ts; cached per-run by the caller.
// ---------------------------------------------------------------------------

export interface ChCompanyProfile {
  companyNumber: string;
  companyName: string;
  sicCodes: string[];
}

export async function fetchCompanyProfile(
  companyNumber: string,
  apiKey: string
): Promise<ChCompanyProfile | null> {
  const raw = await chRestGet(`/company/${companyNumber}`, apiKey);
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  return {
    companyNumber,
    companyName:
      typeof rec.company_name === 'string' ? rec.company_name : companyNumber,
    sicCodes: Array.isArray(rec.sic_codes)
      ? rec.sic_codes.filter((c): c is string => typeof c === 'string')
      : [],
  };
}

export interface ChChargeItem {
  chargeRef: string;
  particulars: string | null;
  lender: string | null;
  createdOn: string | null;
  status: string | null;
}

export async function fetchCompanyCharges(
  companyNumber: string,
  apiKey: string
): Promise<ChChargeItem[]> {
  const raw = await chRestGet(`/company/${companyNumber}/charges`, apiKey);
  const items = (raw as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    return [parseChargeItem(item as Record<string, unknown>)];
  });
}

/** Parse one REST/stream charge object into the fields we act on. Pure. */
export function parseChargeItem(item: Record<string, unknown>): ChChargeItem {
  const particulars = item.particulars;
  const persons = item.persons_entitled;
  const firstPerson =
    Array.isArray(persons) && persons[0] && typeof persons[0] === 'object'
      ? (persons[0] as Record<string, unknown>)
      : null;
  return {
    chargeRef:
      typeof item.charge_code === 'string'
        ? item.charge_code
        : typeof item.etag === 'string'
          ? item.etag
          : '',
    particulars:
      particulars && typeof particulars === 'object'
        ? typeof (particulars as Record<string, unknown>).description ===
          'string'
          ? ((particulars as Record<string, unknown>).description as string)
          : null
        : null,
    lender:
      firstPerson && typeof firstPerson.name === 'string'
        ? firstPerson.name
        : null,
    createdOn: typeof item.created_on === 'string' ? item.created_on : null,
    status: typeof item.status === 'string' ? item.status : null,
  };
}

async function chRestGet(path: string, apiKey: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REST_TIMEOUT_MS);
  try {
    const res = await fetch(`${REST_BASE}${path}`, {
      headers: {
        accept: 'application/json',
        authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
      },
      signal: controller.signal,
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`CH REST ${path}: HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Research signals for the weekly guide.
 *
 * Two sources, both read-only, both optional:
 *
 *   RSS / Atom  — UK property trade press and gov.uk HM Land Registry news.
 *                 No key. Feed list is a Setting (`guides.feeds`) with the
 *                 defaults below.
 *   Reddit      — r/HousingUK, r/LegalAdviceUK, r/UKPersonalFinance searched
 *                 for our terms. Reddit blocks anonymous JSON (403, verified
 *                 17 Sep 2026), so this needs a script app: REDDIT_CLIENT_ID +
 *                 REDDIT_CLIENT_SECRET (client-credentials grant). Without
 *                 them the source is skipped and the brief says so.
 *
 * X is deliberately absent: no free search API, and the audience is not
 * there. See docs/marketing/PLAN.md § Guides.
 *
 * Every fetch is wrapped: a dead feed is a "no signal" line in the brief,
 * never a failed cron. Shapes are validated with zod on the way in; nothing
 * is inferred from a marketing page (LEARNINGS.md, "never infer an external
 * API's response shape").
 */

import { z } from 'zod';

export type Signal = {
  /** 'rss' | 'reddit' */
  kind: 'rss' | 'reddit';
  /** Feed title or subreddit, for the brief and the sources list. */
  source: string;
  title: string;
  url: string;
  /** ISO date if the source gave one. */
  publishedAt?: string;
  /** Short plain-text excerpt (≤ 400 chars). */
  excerpt?: string;
  /** Reddit only: upvotes + comments, a rough "people care" signal. */
  engagement?: number;
};

export type SourceReport = {
  source: string;
  ok: boolean;
  count: number;
  note?: string;
};

export const DEFAULT_FEEDS: readonly { name: string; url: string }[] = [
  {
    name: 'Property Industry Eye',
    url: 'https://propertyindustryeye.com/feed/',
  },
  { name: 'The Negotiator', url: 'https://thenegotiator.co.uk/feed/' },
  {
    name: 'HM Land Registry news',
    url: 'https://www.gov.uk/search/news-and-communications.atom?organisations%5B%5D=hm-land-registry',
  },
];

export const REDDIT_SUBS = [
  'HousingUK',
  'LegalAdviceUK',
  'UKPersonalFinance',
] as const;

/** Search terms per sub. Kept short: Reddit search is OR-ish and noisy. */
export const REDDIT_TERMS = [
  'probate house',
  'inherited house sell',
  'buyer pulled out',
  'chain collapsed',
  'cash buyer offer',
  'short lease sell',
  'repossession sell house',
] as const;

const USER_AGENT = 'KeptGuideResearch/1.0 (+https://wearekept.co.uk)';
const FETCH_TIMEOUT_MS = 12_000;
const MAX_ITEMS_PER_FEED = 15;
const MAX_ITEMS_PER_SUB = 12;
const EXCERPT_CHARS = 400;

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { 'user-agent': USER_AGENT, ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

// ── RSS / Atom ──────────────────────────────────────────────────────────

const decodeEntities = (s: string): string =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8216;|&lsquo;/g, '‘')
    .replace(/&#8220;|&ldquo;/g, '“')
    .replace(/&#8221;|&rdquo;/g, '”')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8230;|&hellip;/g, '…')
    .replace(/&nbsp;/g, ' ');

const stripTags = (s: string): string =>
  decodeEntities(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function tag(block: string, name: string): string | undefined {
  const m = block.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')
  );
  return m ? decodeEntities(m[1]).trim() : undefined;
}

/** Atom `<link href="…"/>` (self-closing) or RSS `<link>…</link>`. */
function linkOf(block: string): string | undefined {
  const atom = block.match(/<link[^>]*\shref="([^"]+)"[^>]*\/?>/i);
  if (atom) return decodeEntities(atom[1]);
  return tag(block, 'link');
}

function toIso(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Parse RSS 2.0 (`<item>`) or Atom (`<entry>`) into signals. Regex on
 * purpose: the feeds are small, the fields are four, and a parser
 * dependency for this is weight we do not need.
 */
export function parseFeed(xml: string, sourceName: string): Signal[] {
  const blocks =
    xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ??
    xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) ??
    [];
  const out: Signal[] = [];
  for (const block of blocks.slice(0, MAX_ITEMS_PER_FEED)) {
    const title = tag(block, 'title');
    const url = linkOf(block);
    if (!title || !url || !/^https?:\/\//i.test(url)) continue;
    const body =
      tag(block, 'description') ??
      tag(block, 'summary') ??
      tag(block, 'content') ??
      '';
    out.push({
      kind: 'rss',
      source: sourceName,
      title: stripTags(title),
      url,
      publishedAt: toIso(
        tag(block, 'pubDate') ??
          tag(block, 'published') ??
          tag(block, 'updated')
      ),
      excerpt: stripTags(body).slice(0, EXCERPT_CHARS) || undefined,
    });
  }
  return out;
}

export async function fetchFeeds(
  feeds: readonly { name: string; url: string }[],
  sinceMs: number
): Promise<{ signals: Signal[]; reports: SourceReport[] }> {
  const signals: Signal[] = [];
  const reports: SourceReport[] = [];
  for (const feed of feeds) {
    try {
      const res = await fetchWithTimeout(feed.url, {
        headers: {
          accept: 'application/rss+xml, application/atom+xml, text/xml, */*',
        },
      });
      if (!res.ok) {
        reports.push({
          source: feed.name,
          ok: false,
          count: 0,
          note: `HTTP ${res.status}`,
        });
        continue;
      }
      const parsed = parseFeed(await res.text(), feed.name).filter(
        (s) => !s.publishedAt || new Date(s.publishedAt).getTime() >= sinceMs
      );
      signals.push(...parsed);
      reports.push({ source: feed.name, ok: true, count: parsed.length });
    } catch (err) {
      reports.push({
        source: feed.name,
        ok: false,
        count: 0,
        note: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { signals, reports };
}

// ── Reddit ──────────────────────────────────────────────────────────────

const RedditListing = z.object({
  data: z.object({
    children: z.array(
      z.object({
        data: z.object({
          title: z.string(),
          permalink: z.string(),
          selftext: z.string().optional(),
          ups: z.number().optional(),
          num_comments: z.number().optional(),
          created_utc: z.number().optional(),
          subreddit: z.string().optional(),
          over_18: z.boolean().optional(),
        }),
      })
    ),
  }),
});

export type RedditCredentials = {
  clientId: string;
  clientSecret: string;
  userAgent?: string;
};

async function redditToken(creds: RedditCredentials): Promise<string> {
  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString(
    'base64'
  );
  const res = await fetchWithTimeout(
    'https://www.reddit.com/api/v1/access_token',
    {
      method: 'POST',
      headers: {
        authorization: `Basic ${basic}`,
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': creds.userAgent ?? USER_AGENT,
      },
      body: 'grant_type=client_credentials',
    }
  );
  if (!res.ok) throw new Error(`reddit token HTTP ${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('reddit token missing');
  return json.access_token;
}

/** Turn one search listing into signals. Exported for the test. */
export function parseRedditListing(json: unknown, sub: string): Signal[] {
  const parsed = RedditListing.safeParse(json);
  if (!parsed.success) return [];
  return parsed.data.data.children
    .map((c) => c.data)
    .filter((p) => !p.over_18)
    .map((p) => ({
      kind: 'reddit' as const,
      source: `r/${p.subreddit ?? sub}`,
      title: p.title.trim(),
      url: `https://www.reddit.com${p.permalink}`,
      publishedAt: p.created_utc
        ? new Date(p.created_utc * 1000).toISOString()
        : undefined,
      excerpt:
        (p.selftext ?? '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, EXCERPT_CHARS) || undefined,
      engagement: (p.ups ?? 0) + (p.num_comments ?? 0),
    }));
}

export async function fetchReddit(
  creds: RedditCredentials | null
): Promise<{ signals: Signal[]; reports: SourceReport[] }> {
  if (!creds) {
    return {
      signals: [],
      reports: [
        {
          source: 'Reddit',
          ok: false,
          count: 0,
          note: 'skipped: REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set',
        },
      ],
    };
  }
  let token: string;
  try {
    token = await redditToken(creds);
  } catch (err) {
    return {
      signals: [],
      reports: [
        {
          source: 'Reddit',
          ok: false,
          count: 0,
          note: err instanceof Error ? err.message : String(err),
        },
      ],
    };
  }

  const signals: Signal[] = [];
  const reports: SourceReport[] = [];
  const ua = creds.userAgent ?? USER_AGENT;
  for (const sub of REDDIT_SUBS) {
    const seen = new Set<string>();
    const subSignals: Signal[] = [];
    let failed: string | undefined;
    for (const term of REDDIT_TERMS) {
      const q = new URLSearchParams({
        q: term,
        restrict_sr: '1',
        sort: 'new',
        t: 'week',
        limit: '10',
      });
      try {
        const res = await fetchWithTimeout(
          `https://oauth.reddit.com/r/${sub}/search?${q.toString()}`,
          { headers: { authorization: `Bearer ${token}`, 'user-agent': ua } }
        );
        if (!res.ok) {
          failed = `HTTP ${res.status}`;
          break;
        }
        for (const s of parseRedditListing(await res.json(), sub)) {
          if (seen.has(s.url)) continue;
          seen.add(s.url);
          subSignals.push(s);
        }
      } catch (err) {
        failed = err instanceof Error ? err.message : String(err);
        break;
      }
    }
    subSignals.sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0));
    const kept = subSignals.slice(0, MAX_ITEMS_PER_SUB);
    signals.push(...kept);
    reports.push({
      source: `r/${sub}`,
      ok: !failed,
      count: kept.length,
      note: failed,
    });
  }
  return { signals, reports };
}

/** Dedupe by URL, newest first, capped so the prompt stays small. */
export function consolidate(signals: Signal[], cap = 40): Signal[] {
  const seen = new Set<string>();
  const out: Signal[] = [];
  for (const s of signals) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    out.push(s);
  }
  out.sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });
  return out.slice(0, cap);
}

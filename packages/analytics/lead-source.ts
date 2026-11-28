import { type IsPrivatePath, redactUrl } from './posthog/redact';

/**
 * Where an enquiry came from: read once from the first page of a visit, sent
 * with the form, saved beside the QuoteRequest. Pure (no browser, no database),
 * so the public site, the quote route and the dashboard share one definition
 * and it can be unit-tested from any workspace with a vitest config.
 *
 * Why it exists (Nov 2026): the Google and Meta ads went live and the
 * dashboard could not say which platform, let alone which advert, produced an
 * enquiry. The platforms' own counts cover only visitors who accept
 * advertising cookies, so the record on the lead is the complete one.
 *
 * It works with nothing changed in the ad accounts: Google adds `gclid` and
 * `gad_campaignid` to every ad click on its own, Meta adds `fbclid`. That
 * gives the platform, and Google's campaign id. Naming the advert needs UTM
 * tags on the ad's link (docs/marketing/TRACKING-EVENTS.md).
 *
 * Never kept: the click id's value (it identifies one person's click to the
 * ad platform; we keep only which kind was there), the rest of the query
 * string, or a private URL (a deal token, an offer id).
 */

/** Ad click markers the platforms append themselves, in the order we trust them. */
export const CLICK_ID_PARAMS = [
  'gclid',
  'gbraid',
  'wbraid',
  'msclkid',
  'ttclid',
  'fbclid',
] as const;

export type ClickIdKind = (typeof CLICK_ID_PARAMS)[number];

export type LeadSource = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  /** Which ad click marker the landing URL carried. Never its value. */
  clickIdKind?: ClickIdKind;
  /** Google's `gad_campaignid`: a campaign number, not a person. */
  adCampaignId?: string;
  /** First page of the visit, path only. Private pages are cut to a stub. */
  landingPath?: string;
  /** The outside site that sent them, host only. */
  referrerHost?: string;
  /**
   * The first page we saw was reached from another page of our own site: a
   * full page load mid-visit wiped what we had read. The real origin is gone,
   * so this is recorded as "not known" rather than passed off as direct.
   */
  internal?: true;
};

export const LEAD_CHANNELS = [
  'google_ads',
  'meta_ads',
  'meta',
  'microsoft_ads',
  'tiktok_ads',
  'paid_other',
  'organic_search',
  'ai_assistant',
  'social',
  'email',
  'tagged_link',
  'referral',
  'direct',
  'unknown',
] as const;

export type LeadChannel = (typeof LEAD_CHANNELS)[number];

/**
 * Dashboard names. `meta` is deliberately not called an advert: Meta puts
 * `fbclid` on every link clicked in Facebook or Instagram, paid or not, so
 * without UTM tags an ad click and a click on a post look the same.
 */
export const LEAD_CHANNEL_LABELS: Record<LeadChannel, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta ads',
  meta: 'Facebook / Instagram',
  microsoft_ads: 'Microsoft Ads',
  tiktok_ads: 'TikTok ads',
  paid_other: 'Other paid',
  organic_search: 'Search (unpaid)',
  ai_assistant: 'AI assistant',
  social: 'Other social',
  email: 'Email',
  tagged_link: 'Tagged link',
  referral: 'Another website',
  direct: 'Direct',
  unknown: 'Not known',
};

export const isLeadChannel = (v: unknown): v is LeadChannel =>
  typeof v === 'string' && (LEAD_CHANNELS as readonly string[]).includes(v);

/** Label for a stored channel; null when the enquiry has none recorded. */
export const leadChannelLabel = (channel?: string | null): string | null =>
  isLeadChannel(channel) ? LEAD_CHANNEL_LABELS[channel] : null;

const MAX_TAG = 120;
const MAX_PATH = 200;
const WHITESPACE = /\s+/g;
const CAMPAIGN_ID = /^\d{1,20}$/;
const HOST = /^[a-z0-9.-]{1,120}$/;
const LEADING_WWW = /^www\./;
const QUERY_OR_HASH = /[?#]/;

const clean = (value: unknown, max = MAX_TAG): string | undefined => {
  if (typeof value !== 'string') {
    return;
  }
  const v = value.replace(WHITESPACE, ' ').trim().slice(0, max);
  return v || undefined;
};

const bareHost = (host: string) => host.toLowerCase().replace(LEADING_WWW, '');

const parse = (value: string): URL | null => {
  try {
    return new URL(value, 'http://placeholder.invalid');
  } catch {
    return null;
  }
};

/**
 * Read the source off the first page of a visit. `url` is that page's full
 * address, `referrer` is `document.referrer` there.
 */
export const readLeadSource = ({
  url,
  referrer,
  isPrivatePath,
}: {
  url: string;
  referrer?: string;
  isPrivatePath?: IsPrivatePath;
}): LeadSource => {
  const out: LeadSource = {};
  const page = parse(url);
  if (page) {
    const q = page.searchParams;
    out.utmSource = clean(q.get('utm_source'));
    out.utmMedium = clean(q.get('utm_medium'));
    out.utmCampaign = clean(q.get('utm_campaign'));
    out.utmContent = clean(q.get('utm_content'));
    out.utmTerm = clean(q.get('utm_term'));
    out.clickIdKind = CLICK_ID_PARAMS.find((p) => q.get(p));
    const campaignId = q.get('gad_campaignid') ?? '';
    out.adCampaignId = CAMPAIGN_ID.test(campaignId) ? campaignId : undefined;
    out.landingPath = clean(
      isPrivatePath ? redactUrl(page.pathname, isPrivatePath) : page.pathname,
      MAX_PATH
    );
  }

  const from = referrer ? parse(referrer) : null;
  if (from?.hostname) {
    const host = bareHost(from.hostname);
    if (page && host === bareHost(page.hostname)) {
      out.internal = true;
    } else if (HOST.test(host)) {
      out.referrerHost = host;
    }
  }

  // Drop the keys that came back empty, so "nothing known" is `{}`.
  return Object.fromEntries(
    Object.entries(out).filter(([, v]) => v !== undefined)
  ) as LeadSource;
};

/**
 * Clean whatever the browser posted. It never rejects: a long tag is cut, a
 * wrong-shaped field is dropped, and anything that is not an object comes
 * back undefined. A bad source must never cost us the enquiry it rode in on.
 */
export const sanitizeLeadSource = (raw: unknown): LeadSource | undefined => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return;
  }
  const r = raw as Record<string, unknown>;
  const path = clean(r.landingPath, MAX_PATH);
  const host = clean(r.referrerHost)?.toLowerCase();
  const campaignId = clean(r.adCampaignId);
  const out: LeadSource = {
    utmSource: clean(r.utmSource),
    utmMedium: clean(r.utmMedium),
    utmCampaign: clean(r.utmCampaign),
    utmContent: clean(r.utmContent),
    utmTerm: clean(r.utmTerm),
    clickIdKind: CLICK_ID_PARAMS.find((p) => p === r.clickIdKind),
    adCampaignId:
      campaignId && CAMPAIGN_ID.test(campaignId) ? campaignId : undefined,
    // A path only: no query string or fragment gets through, whatever was sent.
    landingPath: path?.startsWith('/')
      ? path.split(QUERY_OR_HASH)[0]
      : undefined,
    referrerHost: host && HOST.test(host) ? host : undefined,
    internal: r.internal === true ? true : undefined,
  };
  return Object.fromEntries(
    Object.entries(out).filter(([, v]) => v !== undefined)
  ) as LeadSource;
};

const PAID_MEDIUM =
  /^(cpc|ppc|cpm|cpv|paid|paid[-_ ]?(social|search|media)|display|retargeting|remarketing|ads?)$/i;
const UNPAID_SEARCH_MEDIUM = /organic|search/i;
const SOCIAL_MEDIUM = /social/i;
const EMAIL = /e-?mail|newsletter/i;
const AI_NAME = /chatgpt|openai|perplexity|claude|copilot|gemini/i;

type Platform = 'google' | 'meta' | 'microsoft' | 'tiktok';

const PLATFORM_NAMES: [Platform, RegExp][] = [
  ['google', /google|adwords|youtube/i],
  ['meta', /facebook|instagram|meta|^fb$|^ig$/i],
  ['microsoft', /bing|microsoft/i],
  ['tiktok', /tiktok/i],
];

const platformOf = (name?: string): Platform | undefined =>
  name ? PLATFORM_NAMES.find(([, re]) => re.test(name))?.[0] : undefined;

const PAID_CHANNEL: Record<Platform, LeadChannel> = {
  google: 'google_ads',
  meta: 'meta_ads',
  microsoft: 'microsoft_ads',
  tiktok: 'tiktok_ads',
};

/**
 * Click markers that only an advert produces. `fbclid` is left out on
 * purpose: Meta adds it to clicks on ordinary posts as well.
 */
const PAID_CLICK: Partial<Record<ClickIdKind, LeadChannel>> = {
  gclid: 'google_ads',
  gbraid: 'google_ads',
  wbraid: 'google_ads',
  msclkid: 'microsoft_ads',
  ttclid: 'tiktok_ads',
};

const AI_HOSTS =
  /(^|\.)(chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|copilot\.microsoft\.com|gemini\.google\.com)$/;
const MAIL_HOSTS =
  /(^|\.)(mail\.google\.com|outlook\.live\.com|outlook\.office\.com|mail\.yahoo\.com)$|^com\.google\.android\.gm$/;
const META_HOSTS =
  /(^|\.)(facebook\.com|instagram\.com|fb\.com|fb\.me|messenger\.com)$/;
const SEARCH_HOSTS =
  /(^|\.)(google\.[a-z.]{2,6}|bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org|brave\.com|startpage\.com)$|^com\.google\.android\.googlequicksearchbox$/;
const SOCIAL_HOSTS =
  /(^|\.)(t\.co|x\.com|twitter\.com|linkedin\.com|lnkd\.in|tiktok\.com|youtube\.com|reddit\.com|pinterest\.[a-z.]{2,6}|nextdoor\.[a-z.]{2,6}|whatsapp\.com)$/;

const fromTags = (s: LeadSource): LeadChannel => {
  const medium = s.utmMedium ?? '';
  const named = `${s.utmSource ?? ''} ${medium}`;
  if (EMAIL.test(named)) {
    return 'email';
  }
  if (AI_NAME.test(named)) {
    return 'ai_assistant';
  }
  const platform = platformOf(s.utmSource);
  if (platform === 'meta') {
    return 'meta';
  }
  if (platform && UNPAID_SEARCH_MEDIUM.test(medium)) {
    return 'organic_search';
  }
  return SOCIAL_MEDIUM.test(medium) ? 'social' : 'tagged_link';
};

const fromReferrer = (host: string): LeadChannel => {
  // Order matters: Gemini and Gmail both sit on google.com.
  if (AI_HOSTS.test(host)) {
    return 'ai_assistant';
  }
  if (MAIL_HOSTS.test(host)) {
    return 'email';
  }
  if (META_HOSTS.test(host)) {
    return 'meta';
  }
  if (SEARCH_HOSTS.test(host)) {
    return 'organic_search';
  }
  return SOCIAL_HOSTS.test(host) ? 'social' : 'referral';
};

/**
 * One channel per enquiry. Strongest evidence first: a platform's own click
 * marker, then a paid UTM tag, then any other tag, then the site that sent
 * them. Nothing at all is `direct`; an origin we lost is `unknown`.
 */
export const classifyLeadSource = (s: LeadSource): LeadChannel => {
  const click = s.clickIdKind;
  const paidClick = click ? PAID_CLICK[click] : undefined;
  if (paidClick) {
    return paidClick;
  }
  if (s.utmMedium && PAID_MEDIUM.test(s.utmMedium)) {
    // Meta's own placement names ("an", "msg") say nothing of Meta, but a
    // paid tag riding with Meta's click marker can only be a Meta advert.
    const platform =
      platformOf(s.utmSource) ?? (click === 'fbclid' ? 'meta' : undefined);
    return platform ? PAID_CHANNEL[platform] : 'paid_other';
  }
  if (click === 'fbclid') {
    return 'meta';
  }
  if (s.utmSource || s.utmMedium) {
    return fromTags(s);
  }
  if (s.referrerHost) {
    return fromReferrer(s.referrerHost);
  }
  return s.internal ? 'unknown' : 'direct';
};

/** The QuoteRequestSource columns this module fills. */
export type LeadSourceColumns = {
  channel: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  clickIdKind?: string;
  adCampaignId?: string;
  landingPath?: string;
  referrerHost?: string;
};

/**
 * The QuoteRequestSource row for a source. When the browser posted none (an
 * old tab, or a caller that is not our site) no row is written at all, which
 * the dashboard shows as "not recorded", distinct from a visit we did see.
 */
export const leadSourceColumns = (source: LeadSource): LeadSourceColumns => ({
  channel: classifyLeadSource(source),
  utmSource: source.utmSource,
  utmMedium: source.utmMedium,
  utmCampaign: source.utmCampaign,
  utmContent: source.utmContent,
  utmTerm: source.utmTerm,
  clickIdKind: source.clickIdKind,
  adCampaignId: source.adCampaignId,
  landingPath: source.landingPath,
  referrerHost: source.referrerHost,
});

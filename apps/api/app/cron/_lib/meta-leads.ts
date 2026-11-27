/**
 * Meta (Facebook / Instagram) instant-form leads → the Quotes list.
 *
 * An instant form is filled in INSIDE Meta, so the lead never touches our
 * site. Until this existed those leads sat in Meta's Leads Centre and were
 * copied over by hand (27 Nov 2026: three leads, none in the dashboard).
 *
 * Two doors, one ingest:
 *   - /webhooks/meta-leads  Meta tells us the moment a form is sent.
 *   - /cron/meta-leads-sync a half-hourly sweep of every form, so a missed
 *     or failed webhook is caught rather than lost silently.
 *
 * Both call `ingestMetaLead`, which is idempotent on the Meta lead id.
 *
 * What it deliberately does NOT do:
 *   - It sends nothing to the seller. A person makes first contact.
 *   - It does not price. Today's form asks for no address, and the AVM
 *     never values without one. The lead is saved as `draft` for a person.
 *   - It does not guess. A property type we cannot map, a condition word,
 *     a timescale: all kept verbatim in the notes, never turned into a
 *     number the seller did not give.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { database } from '@repo/database';

export const META_LEAD_SOURCE = 'meta_instant_form';

/** Shown where an address would be. The form may not ask for one. */
export const NO_ADDRESS = 'Address not given yet';

/** The public promise: a person responds within 24 hours. */
const RESPONSE_HOURS = 24;

const GRAPH_HOST = 'https://graph.facebook.com';
const DEFAULT_GRAPH_VERSION = 'v23.0';

const LEAD_FIELDS =
  'id,created_time,field_data,ad_name,adset_name,campaign_name,form_id,platform,is_organic';

export type MetaLeadField = { name: string; values: string[] };

export type MetaLead = {
  id: string;
  created_time?: string;
  field_data?: MetaLeadField[];
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
  form_id?: string;
  platform?: string;
  is_organic?: boolean;
};

export type MetaLeadConfig = {
  pageAccessToken: string;
  graphVersion?: string;
};

// ── Webhook plumbing ────────────────────────────────────────────────────────

/**
 * Check Meta's `X-Hub-Signature-256` header: HMAC-SHA256 of the raw body,
 * keyed with the app secret. Without this anyone who finds the URL could
 * post a made-up lead id.
 */
export function verifyMetaSignature(
  rawBody: string,
  header: string | null,
  appSecret: string
): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const given = Buffer.from(header.slice('sha256='.length), 'hex');
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Pull the lead ids out of a Page webhook payload. Ignores everything else. */
export function extractLeadgenIds(payload: unknown): string[] {
  const ids = new Set<string>();
  const entries = (payload as { entry?: unknown })?.entry;
  if (!Array.isArray(entries)) return [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const c = change as { field?: unknown; value?: { leadgen_id?: unknown } };
      if (c.field !== 'leadgen') continue;
      const id = c.value?.leadgen_id;
      // Graph ids are digits only. Anything else never reaches a URL.
      if (
        (typeof id === 'string' || typeof id === 'number') &&
        /^\d+$/.test(String(id))
      ) {
        ids.add(String(id));
      }
    }
  }
  return [...ids];
}

// ── Reading the form answers ────────────────────────────────────────────────

const normaliseKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const PROPERTY_TYPES: [RegExp, string][] = [
  // Order matters: "semi-detached" also contains "detached".
  [/semi/, 'semi_detached'],
  [/terrace/, 'terraced_house'],
  [/detached/, 'detached'],
  [/flat|apartment|maisonette/, 'flat'],
];

/** Map the seller's words to our property types, or null. Never a guess. */
export function mapPropertyType(answer: string | undefined): string | null {
  if (!answer) return null;
  const a = answer.toLowerCase();
  for (const [pattern, type] of PROPERTY_TYPES) {
    if (pattern.test(a)) return type;
  }
  return null;
}

/** Keys that are contact details or Meta bookkeeping, not answers. */
const NOT_AN_ANSWER = new Set([
  'full_name',
  'first_name',
  'last_name',
  'email',
  'work_email',
  'phone_number',
  'work_phone_number',
  'street_address',
  'city',
  'post_code',
  'postcode',
  'zip_code',
  'inbox_url',
]);

export type ParsedMetaLead = {
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  address: string;
  postcode: string;
  propertyType: string | null;
  /** Every other question, as asked and as answered. */
  answers: { question: string; answer: string }[];
};

/**
 * Turn Meta's `field_data` into the columns we store. Works on question
 * NAMES, not a fixed form, so the ad manager can reword or add questions
 * without a code change. Unknown questions fall through to `answers`.
 */
export function parseMetaLead(lead: MetaLead): ParsedMetaLead {
  const byKey = new Map<string, string>();
  const answers: { question: string; answer: string }[] = [];

  for (const field of lead.field_data ?? []) {
    const value = (field.values ?? []).join(', ').trim();
    if (!value) continue;
    const key = normaliseKey(field.name);
    byKey.set(key, value);
    if (!NOT_AN_ANSWER.has(key)) {
      answers.push({ question: field.name.replace(/_/g, ' '), answer: value });
    }
  }

  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = byKey.get(k);
      if (v) return v;
    }
    return undefined;
  };

  const name =
    get('full_name') ??
    [get('first_name'), get('last_name')].filter(Boolean).join(' ');

  const street = get('street_address');
  const city = get('city');
  const address = street
    ? [street, city].filter(Boolean).join(', ')
    : NO_ADDRESS;

  const typeKey = [...byKey.keys()].find(
    (k) => k.includes('property') && /kind|type/.test(k)
  );

  return {
    contactName: name || 'Name not given',
    contactEmail: get('email', 'work_email') ?? '',
    contactPhone: get('phone_number', 'work_phone_number') ?? null,
    address,
    postcode: (get('post_code', 'postcode', 'zip_code') ?? '').toUpperCase(),
    propertyType: mapPropertyType(typeKey ? byKey.get(typeKey) : undefined),
    answers,
  };
}

/** The notes block a founder reads on the quote page. */
export function buildNotes(lead: MetaLead, parsed: ParsedMetaLead): string {
  const where = lead.platform === 'ig' ? 'Instagram' : 'Facebook';
  const lines = [
    `Source: Meta instant form (${lead.platform ? where : 'Facebook or Instagram'})`,
  ];
  if (lead.campaign_name) lines.push(`Campaign: ${lead.campaign_name}`);
  if (lead.adset_name) lines.push(`Ad set: ${lead.adset_name}`);
  if (lead.ad_name) lines.push(`Ad: ${lead.ad_name}`);
  if (lead.is_organic) lines.push('Organic (not from a paid ad)');
  if (parsed.answers.length > 0) {
    lines.push('', 'Their answers:');
    for (const a of parsed.answers) lines.push(`- ${a.question}: ${a.answer}`);
  }
  if (parsed.address === NO_ADDRESS) {
    lines.push(
      '',
      'The form did not ask for an address. Ask on the first call.'
    );
  }
  lines.push('', `Meta lead id: ${lead.id}`);
  return lines.join('\n');
}

// ── Graph API ───────────────────────────────────────────────────────────────

function graphGet<T>(
  path: string,
  params: Record<string, string>,
  config: MetaLeadConfig
): Promise<T> {
  return graphRequest<T>(
    'GET',
    path,
    params,
    config.pageAccessToken,
    config.graphVersion
  );
}

async function graphRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  params: Record<string, string>,
  token: string,
  graphVersion?: string
): Promise<T> {
  const version = graphVersion || DEFAULT_GRAPH_VERSION;
  const url = new URL(`${GRAPH_HOST}/${version}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  // Token in the header, never the query string: URLs end up in logs.
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string; code?: number };
    } | null;
    throw new Error(
      `Meta Graph ${res.status} on ${path.split('/').pop()}: ${body?.error?.message ?? 'no detail'} (code ${body?.error?.code ?? '?'})`
    );
  }
  return (await res.json()) as T;
}

export function fetchMetaLead(
  leadgenId: string,
  config: MetaLeadConfig
): Promise<MetaLead> {
  return graphGet<MetaLead>(leadgenId, { fields: LEAD_FIELDS }, config);
}

type Paged<T> = { data?: T[]; paging?: { cursors?: { after?: string } } };

/** Every lead on every form of the Page created since `since`. */
export async function listRecentMetaLeads(
  pageId: string,
  since: Date,
  config: MetaLeadConfig
): Promise<MetaLead[]> {
  const forms = await graphGet<Paged<{ id: string }>>(
    `${pageId}/leadgen_forms`,
    { fields: 'id', limit: '100' },
    config
  );
  const filtering = JSON.stringify([
    {
      field: 'time_created',
      operator: 'GREATER_THAN',
      value: Math.floor(since.getTime() / 1000),
    },
  ]);

  const leads: MetaLead[] = [];
  for (const form of forms.data ?? []) {
    let after: string | undefined;
    // Bounded: 5 pages of 100 per form per sweep is far above real volume.
    for (let page = 0; page < 5; page++) {
      const res = await graphGet<Paged<MetaLead>>(
        `${form.id}/leads`,
        {
          fields: LEAD_FIELDS,
          filtering,
          limit: '100',
          ...(after ? { after } : {}),
        },
        config
      );
      leads.push(...(res.data ?? []));
      after = res.paging?.cursors?.after;
      if (!after || (res.data ?? []).length === 0) break;
    }
  }
  return leads;
}

// ── Self-setup ──────────────────────────────────────────────────────────────

const pageTokenCache = new Map<string, string>();

/**
 * Accept either token Meta hands out and return a PAGE token.
 *
 * Setup gives the founder a system-user token. Swapping it for the Page's
 * own token was a Graph Explorer step in the old guide; this does it here
 * instead (GET /{page}?fields=access_token). If the swap returns nothing
 * (it is already a Page token, or lacks the right) the given token is used
 * as-is, and any real problem shows up on the next Graph call.
 */
export async function resolvePageToken(
  token: string,
  pageId: string,
  graphVersion?: string
): Promise<string> {
  const key = `${pageId}:${token}`;
  const cached = pageTokenCache.get(key);
  if (cached) {
    return cached;
  }
  let pageToken = token;
  try {
    const res = await graphRequest<{ access_token?: string }>(
      'GET',
      pageId,
      { fields: 'access_token' },
      token,
      graphVersion
    );
    if (res.access_token) {
      pageToken = res.access_token;
    }
  } catch {
    // Fall back to the given token.
  }
  pageTokenCache.set(key, pageToken);
  return pageToken;
}

/**
 * The Kept Facebook Page ("Kept. Properties"). Not a secret: it is in the
 * Page's public transparency panel. Read from the Meta Ads connection on
 * 27 Nov 2026. META_PAGE_ID overrides it.
 */
export const KEPT_PAGE_ID = '1435461352980315';

/**
 * The webhook verify token, derived from the app secret so nobody has to
 * invent one and paste it in two places. Meta only uses it for the GET
 * handshake; the real protection on every lead is the signature check.
 * META_WEBHOOK_VERIFY_TOKEN overrides it.
 */
export function deriveVerifyToken(appSecret: string): string {
  return createHmac('sha256', appSecret)
    .update('kept-meta-leads-webhook-verify')
    .digest('hex');
}

export type MetaSetupConfig = {
  appId: string;
  appSecret: string;
  pageId: string;
  pageAccessToken: string;
  callbackUrl: string;
  verifyToken: string;
  graphVersion?: string;
};

export type MetaSetupResult = {
  /** The app's webhook points at us and listens for `leadgen`. */
  appWebhook: 'already' | 'set';
  /** The Page sends its lead events to the app. */
  pageSubscription: 'already' | 'set';
};

/**
 * Do the two webhook steps a person would otherwise click through:
 *   1. point the app's Page webhook at /webhooks/meta-leads, field leadgen;
 *   2. subscribe the Kept Page to the app for leadgen.
 * Both are checked first and only written when missing, so the sync cron
 * can call this every run and repair them if Meta ever drops one.
 *
 * Production only (the caller checks): a preview deploy must never point
 * Meta's webhook at itself.
 */
export async function ensureMetaSubscriptions(
  config: MetaSetupConfig
): Promise<MetaSetupResult> {
  const appToken = `${config.appId}|${config.appSecret}`;

  type AppSub = {
    object?: string;
    callback_url?: string;
    active?: boolean;
    fields?: { name?: string }[];
  };
  const appSubs = await graphRequest<{ data?: AppSub[] }>(
    'GET',
    `${config.appId}/subscriptions`,
    {},
    appToken,
    config.graphVersion
  );
  const appReady = (appSubs.data ?? []).some(
    (s) =>
      s.object === 'page' &&
      s.active !== false &&
      s.callback_url === config.callbackUrl &&
      (s.fields ?? []).some((f) => f.name === 'leadgen')
  );
  if (!appReady) {
    // Meta calls our GET handshake before accepting this.
    await graphRequest(
      'POST',
      `${config.appId}/subscriptions`,
      {
        object: 'page',
        callback_url: config.callbackUrl,
        fields: 'leadgen',
        verify_token: config.verifyToken,
      },
      appToken,
      config.graphVersion
    );
  }

  const pageSubs = await graphRequest<{
    data?: { id?: string; subscribed_fields?: string[] }[];
  }>(
    'GET',
    `${config.pageId}/subscribed_apps`,
    {},
    config.pageAccessToken,
    config.graphVersion
  );
  const pageReady = (pageSubs.data ?? []).some(
    (a) =>
      a.id === config.appId && (a.subscribed_fields ?? []).includes('leadgen')
  );
  if (!pageReady) {
    await graphRequest(
      'POST',
      `${config.pageId}/subscribed_apps`,
      { subscribed_fields: 'leadgen' },
      config.pageAccessToken,
      config.graphVersion
    );
  }

  return {
    appWebhook: appReady ? 'already' : 'set',
    pageSubscription: pageReady ? 'already' : 'set',
  };
}

// ── Saving ──────────────────────────────────────────────────────────────────

const isUniqueViolation = (err: unknown) =>
  (err as { code?: string })?.code === 'P2002';

export type IngestResult = 'created' | 'duplicate';

/**
 * Save one Meta lead as a draft QuoteRequest plus a founder action.
 *
 * Idempotent: the founder action's unique `dedupKey` is claimed FIRST, so
 * a webhook retry, or the webhook and the sweep racing, cannot make two
 * rows. If the save then fails the claim is released so a retry can work.
 */
export async function ingestMetaLead(lead: MetaLead): Promise<IngestResult> {
  const dedupKey = `meta_lead:${lead.id}`;
  const parsed = parseMetaLead(lead);

  let action: { id: string };
  try {
    action = await database.founderAction.create({
      data: {
        type: 'general',
        priority: 'high',
        status: 'pending',
        agent: 'liaison',
        dedupKey,
        title: `New Meta lead: ${parsed.contactName}`,
        expiresAt: new Date(Date.now() + RESPONSE_HOURS * 3600_000),
      },
      select: { id: true },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return 'duplicate';
    throw err;
  }

  // Keep Meta's own timestamp so a swept-up lead sorts where it belongs.
  const sentAt = lead.created_time ? new Date(lead.created_time) : null;
  const createdAt = sentAt && !Number.isNaN(sentAt.getTime()) ? sentAt : null;

  try {
    const quote = await database.quoteRequest.create({
      data: {
        source: META_LEAD_SOURCE,
        role: 'seller',
        contactName: parsed.contactName,
        contactEmail: parsed.contactEmail,
        contactPhone: parsed.contactPhone,
        address: parsed.address,
        postcode: parsed.postcode,
        propertyType: parsed.propertyType,
        notes: buildNotes(lead, parsed),
        // draft = "a person follows up by hand". No AVM, no email.
        status: 'draft',
        ...(createdAt ? { createdAt } : {}),
      },
      select: { id: true },
    });

    const answerLines = parsed.answers.map((a) => `${a.question}: ${a.answer}`);
    await database.founderAction.update({
      where: { id: action.id },
      data: {
        description: [
          'Filled in an instant form on Facebook or Instagram. Nothing has been sent to them. Call or email within 24 hours.',
          '',
          parsed.contactPhone ? `Phone: ${parsed.contactPhone}` : null,
          parsed.contactEmail ? `Email: ${parsed.contactEmail}` : null,
          ...answerLines,
          lead.ad_name ? `Ad: ${lead.ad_name}` : null,
          parsed.address === NO_ADDRESS
            ? 'No address yet. Ask for it on the call.'
            : `Address: ${parsed.address} ${parsed.postcode}`.trim(),
        ]
          .filter((l) => l !== null)
          .join('\n'),
        metadata: {
          quoteRequestId: quote.id,
          metaLeadId: lead.id,
          link: `/quotes/${quote.id}`,
        },
      },
    });
  } catch (err) {
    await database.founderAction
      .delete({ where: { id: action.id } })
      .catch(() => undefined);
    throw err;
  }

  return 'created';
}

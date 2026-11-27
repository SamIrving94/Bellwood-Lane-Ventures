/**
 * Meta instant-form leads: the parts that decide what gets stored.
 *
 * The rails under test:
 *   - an unsigned or wrongly signed webhook post is refused;
 *   - only digit-only `leadgen` ids ever reach a Graph URL;
 *   - answers are stored as given, never turned into a guess.
 */

import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@repo/database', () => ({ database: {} }));

import {
  NO_ADDRESS,
  buildNotes,
  deriveVerifyToken,
  ensureMetaSubscriptions,
  extractLeadgenIds,
  mapPropertyType,
  parseMetaLead,
  resolvePageToken,
  verifyMetaSignature,
} from '../app/cron/_lib/meta-leads';

const SECRET = 'test-app-secret';
const sign = (body: string, secret = SECRET) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

describe('verifyMetaSignature', () => {
  const body = '{"object":"page"}';

  test('accepts a correctly signed body', () => {
    expect(verifyMetaSignature(body, sign(body), SECRET)).toBe(true);
  });

  test('refuses a missing, malformed or wrong signature', () => {
    expect(verifyMetaSignature(body, null, SECRET)).toBe(false);
    expect(verifyMetaSignature(body, 'sha256=', SECRET)).toBe(false);
    expect(verifyMetaSignature(body, 'sha1=abc', SECRET)).toBe(false);
    expect(verifyMetaSignature(body, sign(body, 'other'), SECRET)).toBe(false);
  });

  test('refuses a valid signature over a different body', () => {
    expect(verifyMetaSignature(`${body} `, sign(body), SECRET)).toBe(false);
  });
});

describe('extractLeadgenIds', () => {
  const change = (value: unknown, field = 'leadgen') => ({ field, value });

  test('reads leadgen ids and drops repeats', () => {
    const payload = {
      object: 'page',
      entry: [
        {
          changes: [change({ leadgen_id: '111' }), change({ leadgen_id: 222 })],
        },
        { changes: [change({ leadgen_id: '111' })] },
      ],
    };
    expect(extractLeadgenIds(payload)).toEqual(['111', '222']);
  });

  test('ignores other fields and ids that are not plain digits', () => {
    const payload = {
      entry: [
        {
          changes: [
            change({ leadgen_id: '333' }, 'feed'),
            change({ leadgen_id: '../me' }),
            change({ leadgen_id: '12?fields=x' }),
            change({}),
          ],
        },
      ],
    };
    expect(extractLeadgenIds(payload)).toEqual([]);
  });

  test('survives junk', () => {
    expect(extractLeadgenIds(null)).toEqual([]);
    expect(extractLeadgenIds({ entry: 'no' })).toEqual([]);
    expect(extractLeadgenIds({ entry: [{ changes: null }] })).toEqual([]);
  });
});

describe('mapPropertyType', () => {
  test('maps the form wording to our types', () => {
    expect(mapPropertyType('Semi-Detached')).toBe('semi_detached');
    expect(mapPropertyType('Detached')).toBe('detached');
    expect(mapPropertyType('Terraced')).toBe('terraced_house');
    expect(mapPropertyType('Flat / Apartment')).toBe('flat');
  });

  test('returns null rather than guess', () => {
    expect(mapPropertyType('Bungalow')).toBeNull();
    expect(mapPropertyType('')).toBeNull();
    expect(mapPropertyType(undefined)).toBeNull();
  });
});

describe('parseMetaLead', () => {
  // The live form on 27 Nov 2026: no address question.
  const lead = {
    id: '999',
    platform: 'ig',
    campaign_name: 'Leads',
    adset_name: 'Instant Form',
    ad_name: 'AD2 - We Buy Inherited',
    field_data: [
      { name: 'full_name', values: ['Test Seller'] },
      { name: 'email', values: ['seller@example.com'] },
      { name: 'phone_number', values: ['+447000000000'] },
      { name: 'what_kind_of_property?', values: ['Semi-Detached'] },
      { name: 'what_condition_is_the_property_in?', values: ['Average'] },
      {
        name: 'how_quickly_are_you_looking_to_sell?',
        values: ['As soon as possible'],
      },
      { name: 'inbox_url', values: ['https://example.com/inbox'] },
    ],
  };

  test('reads the contact details and property type', () => {
    const parsed = parseMetaLead(lead);
    expect(parsed.contactName).toBe('Test Seller');
    expect(parsed.contactEmail).toBe('seller@example.com');
    expect(parsed.contactPhone).toBe('+447000000000');
    expect(parsed.propertyType).toBe('semi_detached');
  });

  test('says so when the form gave no address', () => {
    const parsed = parseMetaLead(lead);
    expect(parsed.address).toBe(NO_ADDRESS);
    expect(parsed.postcode).toBe('');
  });

  test('keeps condition and timescale as the seller wrote them', () => {
    const { answers } = parseMetaLead(lead);
    expect(answers.map((a) => a.answer)).toEqual([
      'Semi-Detached',
      'Average',
      'As soon as possible',
    ]);
  });

  test('uses the address and postcode once the form asks for them', () => {
    const parsed = parseMetaLead({
      id: '1',
      field_data: [
        { name: 'first_name', values: ['Test'] },
        { name: 'last_name', values: ['Seller'] },
        { name: 'street_address', values: ['1 Example Road'] },
        { name: 'city', values: ['London'] },
        { name: 'post_code', values: ['sw16 1aa'] },
      ],
    });
    expect(parsed.contactName).toBe('Test Seller');
    expect(parsed.address).toBe('1 Example Road, London');
    expect(parsed.postcode).toBe('SW16 1AA');
  });

  test('an empty lead still parses', () => {
    const parsed = parseMetaLead({ id: '2' });
    expect(parsed.contactName).toBe('Name not given');
    expect(parsed.contactEmail).toBe('');
    expect(parsed.contactPhone).toBeNull();
    expect(parsed.propertyType).toBeNull();
  });

  test('notes carry the ad, the answers and the Meta id', () => {
    const notes = buildNotes(lead, parseMetaLead(lead));
    expect(notes).toContain('Meta instant form (Instagram)');
    expect(notes).toContain('Ad: AD2 - We Buy Inherited');
    expect(notes).toContain('what condition is the property in?: Average');
    expect(notes).toContain('did not ask for an address');
    expect(notes).toContain('Meta lead id: 999');
    expect(notes).not.toContain('inbox');
  });
});

describe('deriveVerifyToken', () => {
  test('is stable for a secret and differs between secrets', () => {
    expect(deriveVerifyToken('a')).toBe(deriveVerifyToken('a'));
    expect(deriveVerifyToken('a')).not.toBe(deriveVerifyToken('b'));
    expect(deriveVerifyToken('a')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('ensureMetaSubscriptions', () => {
  const config = {
    appId: '42',
    appSecret: 'shh',
    pageId: '7',
    pageAccessToken: 'page-token',
    callbackUrl: 'https://api.example.com/webhooks/meta-leads',
    verifyToken: 'vt',
  };

  type Call = { method: string; url: URL; auth: string | null };

  /** Fake Graph: answers GETs from `state`, records every call. */
  function fakeGraph(state: { app: unknown[]; page: unknown[] }) {
    const calls: Call[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL, init?: RequestInit) => {
        const url = new URL(input);
        const method = init?.method ?? 'GET';
        const auth = new Headers(init?.headers).get('authorization');
        calls.push({ method, url, auth });
        let data: unknown[] = [];
        if (method === 'GET' && url.pathname.endsWith('/42/subscriptions')) {
          data = state.app;
        }
        if (method === 'GET' && url.pathname.endsWith('/7/subscribed_apps')) {
          data = state.page;
        }
        const body = method === 'GET' ? { data } : { success: true };
        return new Response(JSON.stringify(body), { status: 200 });
      })
    );
    return calls;
  }

  afterEach(() => vi.unstubAllGlobals());

  test('sets up both when nothing is there', async () => {
    const calls = fakeGraph({ app: [], page: [] });
    const result = await ensureMetaSubscriptions(config);
    expect(result).toEqual({ appWebhook: 'set', pageSubscription: 'set' });

    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts).toHaveLength(2);
    const app = posts.find((c) => c.url.pathname.endsWith('/42/subscriptions'));
    expect(app?.url.searchParams.get('object')).toBe('page');
    expect(app?.url.searchParams.get('fields')).toBe('leadgen');
    expect(app?.url.searchParams.get('callback_url')).toBe(config.callbackUrl);
    expect(app?.url.searchParams.get('verify_token')).toBe('vt');
    expect(app?.auth).toBe('Bearer 42|shh');
    const page = posts.find((c) =>
      c.url.pathname.endsWith('/7/subscribed_apps')
    );
    expect(page?.url.searchParams.get('subscribed_fields')).toBe('leadgen');
    expect(page?.auth).toBe('Bearer page-token');
  });

  test('changes nothing when both are already right', async () => {
    const calls = fakeGraph({
      app: [
        {
          object: 'page',
          active: true,
          callback_url: config.callbackUrl,
          fields: [{ name: 'leadgen' }],
        },
      ],
      page: [{ id: '42', subscribed_fields: ['leadgen'] }],
    });
    const result = await ensureMetaSubscriptions(config);
    expect(result).toEqual({
      appWebhook: 'already',
      pageSubscription: 'already',
    });
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  test('repoints a webhook aimed at the wrong URL', async () => {
    const calls = fakeGraph({
      app: [
        {
          object: 'page',
          active: true,
          callback_url: 'https://old.example.com/hook',
          fields: [{ name: 'leadgen' }],
        },
      ],
      page: [{ id: '42', subscribed_fields: ['leadgen'] }],
    });
    const result = await ensureMetaSubscriptions(config);
    expect(result.appWebhook).toBe('set');
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  });

  test('never puts a token in the URL', async () => {
    const calls = fakeGraph({ app: [], page: [] });
    await ensureMetaSubscriptions(config);
    for (const c of calls) {
      expect(c.url.searchParams.has('access_token')).toBe(false);
      expect(c.url.toString()).not.toContain('shh');
      expect(c.url.toString()).not.toContain('page-token');
    }
  });

  test('a Graph error stops it with the reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: { message: 'Invalid OAuth', code: 190 } }),
            { status: 400 }
          )
      )
    );
    await expect(ensureMetaSubscriptions(config)).rejects.toThrow(
      'Invalid OAuth'
    );
  });
});

describe('resolvePageToken', () => {
  afterEach(() => vi.unstubAllGlobals());

  test('swaps a system-user token for the Page token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ access_token: 'page-tok' }), {
            status: 200,
          })
      )
    );
    expect(await resolvePageToken('system-tok-1', '7')).toBe('page-tok');
  });

  test('keeps the given token when the swap fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 400 }))
    );
    expect(await resolvePageToken('given-tok-2', '7')).toBe('given-tok-2');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/database', async () => ({
  database: (await import('./fake-db')).fakeDatabase,
}));

vi.mock('@repo/property-data', () => ({
  getEpcData: vi.fn(async () => ({
    source: 'live',
    epcRating: 'F',
    epcScore: 30,
    propertyType: 'House',
    floorAreaSqm: 100,
    constructionAgeBand: '1930-1949',
    heatingType: 'Gas',
    inspectionDate: '2018-01-01',
  })),
  getPricePaidWithAddresses: vi.fn(async () => []),
}));

import { GET, POST } from '@/app/mcp/route';
import { resetStore, store } from './fake-db';
import { type Json, rpc } from './mcp-client';

const call = (
  name: string,
  args: Record<string, unknown>,
  headers: Record<string, string> = {}
) => rpc(POST, 'tools/call', { name, arguments: args }, headers);

const FROM_CHATGPT = { 'user-agent': 'openai-mcp/1.0.0' };
const FROM_CLAUDE = { 'user-agent': 'Claude-User/1.0' };
const NOT_A_RECOMMENDATION = /not a recommendation/;
const WITHIN_24_HOURS = /within 24 hours, Monday to Friday/;
const FORM_LINK =
  /The form is here instead: https:\/\/[^ ]+\/chain-break\?utm_source=claude/;

const NULL_WORD = /\bnull\b/;
const CONTACT_DETAILS = /Jo Seller|example\.com|Oak Road|07700/;
const NEXT_DATED_STEP = /Next dated step: .+ on \d{4}-\d{2}-\d{2}\./;

describe('public plugin', () => {
  it('lists six tools with explicit hints: five read-only, one that sends details', async () => {
    const { body } = await rpc(POST, 'tools/list');
    const tools = body.result.tools as Json[];
    expect(tools.map((t) => t.name)).toEqual([
      'plan_my_sale',
      'compare_sale_routes',
      'plan_inherited_home',
      'estimate_renovation_cost',
      'get_property_facts',
      'ask_kept_to_call',
    ]);
    for (const t of tools) {
      expect(typeof t.title).toBe('string');
      expect(t.annotations.destructiveHint).toBe(false);
      expect(typeof t.annotations.openWorldHint).toBe('boolean');
      if (t.name === 'ask_kept_to_call') {
        expect(t.annotations.readOnlyHint).toBe(false);
        expect(t._meta?.ui).toBeUndefined();
      } else {
        expect(t.annotations.readOnlyHint).toBe(true);
        expect(t._meta.ui.resourceUri).toBe('ui://kept/card-v1.html');
        expect(t._meta['openai/outputTemplate']).toBe('ui://kept/card-v1.html');
      }
    }
  });

  it("introduces itself with Kept's name, website and icon", async () => {
    const { body } = await rpc(POST, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    });
    expect(body.result.serverInfo).toMatchObject({
      name: 'kept',
      title: 'Kept',
      websiteUrl: 'https://wearekept.co.uk',
    });
    expect(body.result.serverInfo.icons[0].src).toBe(
      'https://wearekept.co.uk/apple-icon.png'
    );
  });

  it('serves the OpenAI domain check only when a token is set', async () => {
    const { GET: challenge } = await import(
      '@/app/.well-known/openai-apps-challenge/route'
    );
    Reflect.deleteProperty(process.env, 'OPENAI_APPS_CHALLENGE');
    expect(challenge().status).toBe(404);
    process.env.OPENAI_APPS_CHALLENGE = 'tok_123';
    const res = challenge();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('tok_123');
    Reflect.deleteProperty(process.env, 'OPENAI_APPS_CHALLENGE');
  });

  it('serves the card as an MCP Apps resource with an empty CSP', async () => {
    const { body } = await rpc(POST, 'resources/read', {
      uri: 'ui://kept/card-v1.html',
    });
    const c = body.result.contents[0];
    expect(c.mimeType).toBe('text/html;profile=mcp-app');
    expect(c.text).toContain('ui/initialize');
    expect(c._meta.ui.csp).toEqual({ connectDomains: [], resourceDomains: [] });
  });

  it('compares sale routes on the user figures, with no cash figure invented', async () => {
    const { body } = await call('compare_sale_routes', {
      expectedPricePounds: 250000,
    });
    const s = body.result.structuredContent;
    expect(s.kind).toBe('sale_routes');
    expect(s.routes[2].pricePence).toBeNull();
    expect(s.nextStep.url).toContain('utm_source=mcp');
    expect(body.result.content[0].text).toMatch(NOT_A_RECOMMENDATION);
  });

  it('tags every link with the assistant it came from, and sends it to the situation page', async () => {
    const chatgpt = await call(
      'compare_sale_routes',
      { expectedPricePounds: 250000, situation: 'relocation' },
      FROM_CHATGPT
    );
    const next = chatgpt.body.result.structuredContent.nextStep;
    expect(next.url).toContain('/relocation?utm_source=chatgpt');
    expect(next.url).toContain('utm_campaign=compare_sale_routes');
    expect(next.context).toContain(
      'a good high-street agent will very likely net you more'
    );
    const claude = await call(
      'estimate_renovation_cost',
      { floorAreaSqm: 80 },
      FROM_CLAUDE
    );
    expect(claude.body.result.structuredContent.nextStep.url).toContain(
      '/problem-property?utm_source=claude'
    );
  });

  it('plans a sale for any Kept situation: which ways make the date', async () => {
    const inSixWeeks = new Date(Date.now() + 42 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const { body } = await call(
      'plan_my_sale',
      { situation: 'chain_break', mustCompleteBy: inSixWeeks },
      FROM_CLAUDE
    );
    const s = body.result.structuredContent;
    expect(s.kind).toBe('sale_plan');
    expect(s.timing.map((t: Json) => [t.route, t.meetsDeadline])).toEqual([
      ['estate_agent', false],
      ['auction', false],
      ['cash_buyer', true],
    ]);
    expect(s.checklist.length).toBeGreaterThanOrEqual(5);
    expect(s.nextStep.url).toContain('/chain-break?utm_source=claude');
    expect(s.freeHelp).toBeNull();
  });

  it('gives no handoff, only free debt advice, when the debt is bigger than the home', async () => {
    const { body } = await call('plan_my_sale', {
      situation: 'other',
      expectedPricePounds: 150000,
      mortgageOwedPounds: 170000,
    });
    const s = body.result.structuredContent;
    expect(s.debtExceedsValue).toBe(true);
    expect(s.nextStep).toBeNull();
    expect(s.freeHelp.url).toBe('https://www.stepchange.org');
  });

  it('builds an inherited-home plan', async () => {
    const { body } = await call('plan_inherited_home', {
      dateOfDeath: '2026-06-10',
      homeIsEmpty: true,
    });
    expect(body.result.structuredContent.kind).toBe('inherited_home_plan');
    expect(body.result.structuredContent.nextStep.url).toContain('/probate');
  });

  it('summarises the next dated step, never the undated registration step', async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const { body } = await call('plan_inherited_home', {
      dateOfDeath: threeDaysAgo,
      homeIsEmpty: true,
    });
    const first = body.result.structuredContent.milestones[0];
    expect(first.title).toBe('Register the death');
    expect(first.date).toBeNull();
    const summary = body.result.content[0].text as string;
    expect(summary).not.toMatch(NULL_WORD);
    expect(summary).toMatch(NEXT_DATED_STEP);
  });

  it('answers 413 for a body over the limit, declared or not (GHSA-46jr-4wx8-v453)', async () => {
    const big = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: { pad: 'x'.repeat(70 * 1024) },
    });
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    };
    const declared = await POST(
      new Request('https://plugin.test/mcp', {
        method: 'POST',
        headers,
        body: big,
      })
    );
    expect(declared.status).toBe(413);

    // Chunked: no content-length, so the bytes themselves are counted.
    const bytes = new TextEncoder().encode(big);
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < bytes.length; i += 8192) {
          c.enqueue(bytes.slice(i, i + 8192));
        }
        c.close();
      },
    });
    const chunked = await POST(
      new Request('https://plugin.test/mcp', {
        method: 'POST',
        headers,
        body: stream,
        duplex: 'half',
      } as RequestInit)
    );
    expect(chunked.status).toBe(413);
  });

  it('rejects tool arguments with too many elements (maxToolInputElements)', async () => {
    // An unknown key: the tool schema alone would drop it and succeed, so
    // only the element limit can turn this call away.
    const padded = await call('compare_sale_routes', {
      expectedPricePounds: 250_000,
      padding: Array.from({ length: 500 }, (_, i) => i),
    });
    const rejected =
      padded.body.error !== undefined || padded.body.result?.isError === true;
    expect(rejected).toBe(true);

    const normal = await call('compare_sale_routes', {
      expectedPricePounds: 250_000,
    });
    expect(normal.body.result.isError).toBeFalsy();
  });

  it('returns a clear error for an impossible date instead of throwing', async () => {
    const { body } = await call('plan_inherited_home', {
      dateOfDeath: '2026-02-30',
      homeIsEmpty: true,
    });
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toMatch(/not a real date/);
  });

  it('reads the EPC floor area for a renovation estimate', async () => {
    const { body } = await call('estimate_renovation_cost', {
      addressLine: '14 Elm Road',
      postcode: 'M14 5AB',
    });
    const s = body.result.structuredContent;
    expect(s.floorAreaSqm).toBe(100);
    expect(s.epc.rating).toBe('F');
  });

  it('returns public facts with the Land Registry attribution and no value', async () => {
    const { body } = await call('get_property_facts', {
      addressLine: '14 Elm Road',
      postcode: 'M14 5AB',
    });
    const s = body.result.structuredContent;
    expect(s.kind).toBe('property_facts');
    expect(body.result.content[0].text).toMatch(/Crown copyright/);
    expect(body.result.content[0].text).toMatch(/not a valuation of this home/);
  });

  it('rejects a bad postcode at the schema', async () => {
    const { body } = await call('get_property_facts', {
      addressLine: '14 Elm Road',
      postcode: 'NOT A POSTCODE',
    });
    expect(body.error ?? body.result?.isError).toBeTruthy();
  });

  it('exports GET for the transport', () => {
    expect(typeof GET).toBe('function');
  });

  describe('usage logging', () => {
    afterEach(() => vi.restoreAllMocks());

    it('logs the tool name and outcome, never the inputs', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      await call('get_property_facts', {
        addressLine: '99 Secret Lane',
        postcode: 'M14 5AB',
      });
      const lines = log.mock.calls.map((c) => String(c[0]));
      const usage = lines.find((l) => l.includes('kept_plugin_tool'));
      expect(usage).toBeTruthy();
      expect(JSON.parse(usage as string)).toMatchObject({
        surface: 'public',
        tool: 'get_property_facts',
        host: 'other',
        outcome: 'ok',
      });
      expect(lines.join('\n')).not.toMatch(/Secret Lane|M14 5AB/);
    });

    it('records which assistant called, from the user-agent only', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      await call(
        'estimate_renovation_cost',
        { floorAreaSqm: 80 },
        FROM_CHATGPT
      );
      const usage = log.mock.calls
        .map((c) => String(c[0]))
        .find((l) => l.includes('kept_plugin_tool'));
      expect(JSON.parse(usage as string).host).toBe('chatgpt');
    });

    it('marks a tool error as tool_error', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      await call('plan_inherited_home', {
        dateOfDeath: '2026-02-30',
        homeIsEmpty: true,
      });
      const usage = log.mock.calls
        .map((c) => String(c[0]))
        .find((l) => l.includes('kept_plugin_tool'));
      expect(JSON.parse(usage as string).outcome).toBe('tool_error');
    });
  });
  describe('ask_kept_to_call', () => {
    const details = {
      name: 'Jo Seller',
      email: 'Jo.Seller@Example.com',
      phone: '07700 900123',
      addressLine: '12 Oak Road',
      postcode: 'm20 2ab',
      situation: 'chain_break',
      timing: 'asap',
      consent: true,
    };

    beforeEach(() => {
      resetStore();
      process.env.DATABASE_URL = 'postgres://test';
    });
    afterEach(() => {
      Reflect.deleteProperty(process.env, 'DATABASE_URL');
      vi.restoreAllMocks();
    });

    it('saves a draft enquiry, tags its assistant, and raises an Action Centre card', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const { body } = await call('ask_kept_to_call', details, FROM_CLAUDE);
      expect(body.result.isError).toBeFalsy();
      expect(body.result.content[0].text).toMatch(WITHIN_24_HOURS);
      expect(store.quotes).toHaveLength(1);
      expect(store.quotes[0]).toMatchObject({
        source: 'plugin_public',
        role: 'seller',
        status: 'draft',
        contactEmail: 'jo.seller@example.com',
        postcode: 'M20 2AB',
        sellerSituation: 'chain_break',
        urgencyDays: 14,
      });
      expect(store.sources[0]).toMatchObject({
        channel: 'ai_assistant',
        utmSource: 'claude',
        utmCampaign: 'ask_kept_to_call',
      });
      expect(store.actions[0].title).toBe(
        'Seller asked via Claude to be contacted: M20 2AB'
      );
      expect(store.actions[0].priority).toBe('high');
      // The usage log never carries the details.
      expect(log.mock.calls.map((c) => String(c[0])).join('\n')).not.toMatch(
        CONTACT_DETAILS
      );
    });

    it('records the same request twice in a day only once', async () => {
      await call('ask_kept_to_call', details, FROM_CLAUDE);
      const again = await call('ask_kept_to_call', details, FROM_CLAUDE);
      expect(again.body.result.structuredContent.duplicate).toBe(true);
      expect(store.quotes).toHaveLength(1);
      expect(store.actions).toHaveLength(1);
    });

    it('refuses without consent, at the schema', async () => {
      const { body } = await call('ask_kept_to_call', {
        ...details,
        consent: false,
      });
      const rejected =
        body.error !== undefined || body.result?.isError === true;
      expect(rejected).toBe(true);
      expect(store.quotes).toHaveLength(0);
    });

    const earlier = (count: number, minutesAgo: number) => {
      for (let i = 0; i < count; i++) {
        store.quotes.push({
          id: `old${minutesAgo}_${i}`,
          source: 'plugin_public',
          contactEmail: `x${minutesAgo}_${i}@example.com`,
          postcode: 'M1 1AA',
          createdAt: new Date(Date.now() - minutesAgo * 60_000),
        });
      }
    };

    it('stops taking details after the hourly ceiling and points to the form', async () => {
      earlier(10, 5);
      const { body } = await call('ask_kept_to_call', details, FROM_CLAUDE);
      expect(body.result.isError).toBe(true);
      expect(body.result.content[0].text).toMatch(FORM_LINK);
      expect(store.actions).toHaveLength(0);
    });

    it('stops taking details after the daily ceiling, however spread out', async () => {
      earlier(9, 5);
      earlier(21, 180);
      const { body } = await call('ask_kept_to_call', details, FROM_CLAUDE);
      expect(body.result.isError).toBe(true);
      expect(body.result.content[0].text).toMatch(FORM_LINK);
      expect(store.actions).toHaveLength(0);
    });

    it('still takes details under both ceilings', async () => {
      earlier(9, 5);
      earlier(20, 180);
      const { body } = await call('ask_kept_to_call', details, FROM_CLAUDE);
      expect(body.result.isError).toBeFalsy();
      expect(store.actions).toHaveLength(1);
    });

    it('points to the form when the plugin has no database', async () => {
      Reflect.deleteProperty(process.env, 'DATABASE_URL');
      const { body } = await call('ask_kept_to_call', details, FROM_CLAUDE);
      expect(body.result.isError).toBe(true);
      expect(body.result.content[0].text).toMatch(FORM_LINK);
    });
  });
});

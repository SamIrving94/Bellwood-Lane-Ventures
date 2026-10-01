import { afterEach, describe, expect, it, vi } from 'vitest';

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
import { type Json, rpc } from './mcp-client';

const call = (name: string, args: Record<string, unknown>) =>
  rpc(POST, 'tools/call', { name, arguments: args });

describe('public plugin', () => {
  it('lists exactly the four tools, all read-only with explicit hints', async () => {
    const { body } = await rpc(POST, 'tools/list');
    const tools = body.result.tools as Json[];
    expect(tools.map((t) => t.name).sort()).toEqual([
      'compare_sale_routes',
      'estimate_renovation_cost',
      'get_property_facts',
      'plan_inherited_home',
    ]);
    for (const t of tools) {
      expect(t.annotations.readOnlyHint).toBe(true);
      expect(t.annotations.destructiveHint).toBe(false);
      expect(typeof t.annotations.openWorldHint).toBe('boolean');
      expect(t._meta.ui.resourceUri).toBe('ui://kept/card-v1.html');
      expect(t._meta['openai/outputTemplate']).toBe('ui://kept/card-v1.html');
    }
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
    expect(s.nextStep.url).toContain('utm_source=chatgpt');
    expect(body.result.content[0].text).toMatch(/do not recommend a route/);
  });

  it('builds an inherited-home plan', async () => {
    const { body } = await call('plan_inherited_home', {
      dateOfDeath: '2026-06-10',
      homeIsEmpty: true,
    });
    expect(body.result.structuredContent.kind).toBe('inherited_home_plan');
    expect(body.result.structuredContent.nextStep.url).toContain('/probate');
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
    expect(body.result.content[0].text).toMatch(/Not a valuation/);
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
        outcome: 'ok',
      });
      expect(lines.join('\n')).not.toMatch(/Secret Lane|M14 5AB/);
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
});

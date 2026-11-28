import { callSource, clientSource, keptHandoff, siteLink } from '@/lib/links';
import { describe, expect, it } from 'vitest';

describe('clientSource', () => {
  it('folds ChatGPT clients to chatgpt', () => {
    expect(clientSource('openai-mcp')).toBe('chatgpt');
    expect(clientSource('ChatGPT')).toBe('chatgpt');
  });
  it('folds Claude clients to claude', () => {
    expect(clientSource('claude-ai')).toBe('claude');
    expect(clientSource('Anthropic/ClaudeAI')).toBe('claude');
  });
  it('keeps other assistants as a short slug', () => {
    expect(clientSource('Meta Muse')).toBe('meta-muse');
    expect(clientSource('Instinct/1.2')).toBe('instinct-1-2');
  });
  it('falls back to agent when the name is missing or unusable', () => {
    expect(clientSource(undefined)).toBe('agent');
    expect(clientSource('***')).toBe('agent');
  });
  it('caps length so a hostile name cannot flood analytics', () => {
    expect(clientSource('a'.repeat(200)).length).toBeLessThanOrEqual(30);
  });
});

describe('siteLink', () => {
  it('tags the source it is given', () => {
    expect(siteLink('/sell', 'x', 'meta-muse')).toContain(
      'utm_source=meta-muse'
    );
  });
});

const withUserAgent = (ua: string) => ({
  http: {
    req: new Request('https://x.test/mcp', { headers: { 'user-agent': ua } }),
  },
});

describe('callSource', () => {
  it('prefers the MCP client name', () => {
    expect(callSource('Meta Muse', withUserAgent('Claude-User/1.0'))).toBe(
      'meta-muse'
    );
  });
  it('falls back to the User-Agent when the request carries no client name', () => {
    expect(callSource(undefined, withUserAgent('openai-mcp/1.0.0'))).toBe(
      'chatgpt'
    );
    expect(callSource(undefined, withUserAgent('Claude-User/1.0'))).toBe(
      'claude'
    );
  });
  it('never turns a library User-Agent into a source', () => {
    expect(callSource(undefined, withUserAgent('node-fetch/3.0'))).toBe(
      'agent'
    );
    expect(callSource(undefined, undefined)).toBe('agent');
  });
});

describe('keptHandoff', () => {
  it('goes to the situation page with its honest line', () => {
    const step = keptHandoff('plan_my_sale', 'claude', 'separation');
    expect(step.url).toContain('/separation?utm_source=claude');
    expect(step.context).toContain('a good local agent is the better route');
  });
  it('goes to /sell with the general line when there is no situation', () => {
    const step = keptHandoff('get_property_facts', 'agent');
    expect(step.url).toContain('/sell?utm_source=agent');
    expect(step.context).toContain('an estate agent will usually get you more');
  });
});

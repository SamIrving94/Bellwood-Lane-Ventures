import { clientSource, siteLink } from '@/lib/links';
import { describe, expect, it } from 'vitest';

describe('clientSource', () => {
  it('folds ChatGPT clients to chatgpt', () => {
    expect(clientSource('openai-mcp')).toBe('chatgpt');
    expect(clientSource('ChatGPT')).toBe('chatgpt');
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

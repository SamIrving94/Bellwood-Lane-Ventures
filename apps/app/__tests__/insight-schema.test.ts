import { describe, expect, it } from 'vitest';
import { normaliseInsights } from '../lib/feedback/insight-schema';

const META = { extractedAt: '2026-07-23T09:00:00.000Z', model: 'test-model' };

describe('normaliseInsights', () => {
  it('passes through a well-formed payload', () => {
    const result = normaliseInsights(
      {
        sentiment: 'mixed',
        likes: [{ theme: 'garden', quote: 'lovely big lawn' }],
        dislikes: [{ theme: 'kitchen', quote: 'needs gutting' }],
        dealbreakers: ['never buy next to a railway line'],
        summary: 'Likes the garden, kitchen needs work.',
      },
      META
    );
    expect(result).not.toBeNull();
    expect(result?.likes).toEqual([
      { theme: 'garden', quote: 'lovely big lawn' },
    ]);
    expect(result?.dislikes[0]?.theme).toBe('kitchen');
    expect(result?.dealbreakers).toHaveLength(1);
    expect(result?.extractedAt).toBe(META.extractedAt);
    expect(result?.model).toBe(META.model);
  });

  it('drops unknown themes instead of storing junk', () => {
    const result = normaliseInsights(
      {
        sentiment: 'positive',
        likes: [
          { theme: 'vibes', quote: 'great vibes' },
          { theme: 'location', quote: 'nice area' },
        ],
        dislikes: [],
        dealbreakers: [],
        summary: '',
      },
      META
    );
    expect(result?.likes).toEqual([{ theme: 'location', quote: 'nice area' }]);
  });

  it('returns null when no usable signal survives', () => {
    const result = normaliseInsights(
      {
        sentiment: 'neutral',
        likes: [{ theme: 'nonsense', quote: 'x' }],
        dislikes: [],
        dealbreakers: [],
        summary: 'Nothing specific.',
      },
      META
    );
    expect(result).toBeNull();
  });

  it('returns null for non-object payloads', () => {
    expect(normaliseInsights(null, META)).toBeNull();
    expect(normaliseInsights('text', META)).toBeNull();
    expect(normaliseInsights(undefined, META)).toBeNull();
  });

  it('defaults bad sentiment to neutral and clamps long strings', () => {
    const result = normaliseInsights(
      {
        sentiment: 'ecstatic',
        likes: [{ theme: 'price', quote: 'a'.repeat(500) }],
        dislikes: [],
        dealbreakers: ['b'.repeat(500)],
        summary: 'c'.repeat(500),
      },
      META
    );
    expect(result?.sentiment).toBe('neutral');
    expect(result?.likes[0]?.quote).toHaveLength(160);
    expect(result?.dealbreakers[0]).toHaveLength(200);
    expect(result?.summary).toHaveLength(300);
  });

  it('tolerates missing arrays', () => {
    const result = normaliseInsights(
      { sentiment: 'negative', dealbreakers: ['no flats above shops'] },
      META
    );
    expect(result?.likes).toEqual([]);
    expect(result?.dislikes).toEqual([]);
    expect(result?.dealbreakers).toEqual(['no flats above shops']);
  });
});

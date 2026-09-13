import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/ai/claude', () => ({
  CLAUDE_SONNET: 'claude-sonnet-4-5',
  callClaudeWithMeta: vi.fn(),
  hasLlmProvider: vi.fn(),
}));

import { callClaudeWithMeta, hasLlmProvider } from '@repo/ai/claude';
import { screenAuctionLot, screenPropertyCondition } from '../lot-screener';

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function imageResponse(type = 'image/jpeg') {
  return new Response(JPEG_BYTES, {
    status: 200,
    headers: { 'content-type': type },
  });
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  vi.mocked(callClaudeWithMeta).mockReset();
  vi.mocked(hasLlmProvider).mockReturnValue(true);
  globalThis.fetch = vi.fn(async () => imageResponse()) as never;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('screenPropertyCondition', () => {
  it('sends the fetched photos as inline images through the routable client', async () => {
    vi.mocked(callClaudeWithMeta).mockResolvedValue({
      text: JSON.stringify({
        conditionScore: 3,
        condition: 'distressed',
        flags: ['boarded_windows', 'boarded_windows', 'roof_damage'],
        rationale: 'Boarded ground floor, missing slates.',
        confidence: 0.7,
      }),
      model: 'z-ai/glm-5.2',
      provider: 'openrouter:z-ai/glm-5.2',
      viaFallback: false,
    });

    const result = await screenPropertyCondition({
      ref: 'lot-1',
      address: '1 Test Street',
      photoUrls: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
    });

    const call = vi.mocked(callClaudeWithMeta).mock.calls[0][0];
    expect(call.feature).toBe('property_vision');
    expect(call.images).toHaveLength(2);
    expect(call.images?.[0]).toEqual({
      data: Buffer.from(JPEG_BYTES).toString('base64'),
      mediaType: 'image/jpeg',
    });
    expect(call.user).toContain('Photos provided: 2 of 2');

    expect(result).toMatchObject({
      conditionScore: 3,
      condition: 'distressed',
      flags: ['boarded_windows', 'roof_damage'],
      photoCount: 2,
      confidence: 0.7,
      modelUsed: 'z-ai/glm-5.2',
    });
  });

  it('returns null with no photos, and without fetching when no provider is keyed', async () => {
    await expect(
      screenPropertyCondition({ ref: 'x', address: 'y', photoUrls: [] })
    ).resolves.toBeNull();

    vi.mocked(hasLlmProvider).mockReturnValue(false);
    await expect(
      screenPropertyCondition({
        ref: 'x',
        address: 'y',
        photoUrls: ['https://cdn.example/a.jpg'],
      })
    ).resolves.toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(callClaudeWithMeta).not.toHaveBeenCalled();
  });

  it('returns null when every photo fails to fetch, without calling the model', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('nope', { status: 404 })
    ) as never;
    await expect(
      screenPropertyCondition({
        ref: 'x',
        address: 'y',
        photoUrls: ['https://cdn.example/a.jpg'],
      })
    ).resolves.toBeNull();
    expect(callClaudeWithMeta).not.toHaveBeenCalled();
  });

  it('returns null on empty text or a reply that fails the schema', async () => {
    vi.mocked(callClaudeWithMeta).mockResolvedValue({
      text: null,
      model: 'm',
      provider: null,
      viaFallback: false,
    });
    await expect(
      screenAuctionLot({
        lotRef: 'x',
        address: 'y',
        photoUrls: ['https://cdn.example/a.jpg'],
      })
    ).resolves.toBeNull();

    vi.mocked(callClaudeWithMeta).mockResolvedValue({
      text: '{"conditionScore": 99}',
      model: 'm',
      provider: null,
      viaFallback: false,
    });
    await expect(
      screenAuctionLot({
        lotRef: 'x',
        address: 'y',
        photoUrls: ['https://cdn.example/a.jpg'],
      })
    ).resolves.toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/ai/claude', () => ({
  CLAUDE_SONNET: 'claude-sonnet-4-5',
  callClaudeForObject: vi.fn(),
}));
vi.mock('@repo/ai/keys', () => ({ keys: vi.fn() }));

import { callClaudeForObject } from '@repo/ai/claude';
import { keys } from '@repo/ai/keys';
import {
  PHOTO_SCREEN_FEATURE,
  screenAuctionLot,
  screenPropertyCondition,
} from '../lot-screener';

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function imageResponse(type = 'image/jpeg') {
  return new Response(JPEG_BYTES, {
    status: 200,
    headers: { 'content-type': type },
  });
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  vi.mocked(callClaudeForObject).mockReset();
  vi.mocked(keys).mockReturnValue({ ANTHROPIC_API_KEY: 'k' } as never);
  globalThis.fetch = vi.fn(async () => imageResponse()) as never;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('screenPropertyCondition', () => {
  it('sends the fetched photos as inline images through the routable client', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue({
      conditionScore: 3,
      condition: 'distressed',
      flags: ['boarded_windows', 'boarded_windows', 'roof_damage'],
      rationale: 'Boarded ground floor, missing slates.',
      confidence: 0.7,
    } as never);

    const result = await screenPropertyCondition({
      ref: 'lot-1',
      address: '1 Test Street',
      photoUrls: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
    });

    const call = vi.mocked(callClaudeForObject).mock.calls[0][0];
    expect(call.feature).toBe(PHOTO_SCREEN_FEATURE);
    expect(call.feature).toBe('property_photo_screen');
    expect(call.model).toBe('claude-sonnet-4-5');
    expect(call.images).toHaveLength(2);
    expect(call.images?.[0]).toEqual({
      base64: Buffer.from(JPEG_BYTES).toString('base64'),
      mediaType: 'image/jpeg',
    });
    expect(call.user).toContain('Photos provided: 2 of 2');

    expect(result).toMatchObject({
      conditionScore: 3,
      condition: 'distressed',
      flags: ['boarded_windows', 'roof_damage'],
      photoCount: 2,
      confidence: 0.7,
    });
  });

  it('returns null with no photos, and without fetching when no key is set', async () => {
    await expect(
      screenPropertyCondition({ ref: 'x', address: 'y', photoUrls: [] })
    ).resolves.toBeNull();

    vi.mocked(keys).mockReturnValue({} as never);
    await expect(
      screenPropertyCondition({
        ref: 'x',
        address: 'y',
        photoUrls: ['https://cdn.example/a.jpg'],
      })
    ).resolves.toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(callClaudeForObject).not.toHaveBeenCalled();
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
    expect(callClaudeForObject).not.toHaveBeenCalled();
  });

  it('returns null when the client returns null', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue(null);
    await expect(
      screenAuctionLot({
        lotRef: 'x',
        address: 'y',
        photoUrls: ['https://cdn.example/a.jpg'],
      })
    ).resolves.toBeNull();
  });
});

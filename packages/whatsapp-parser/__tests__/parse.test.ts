import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/ai/claude', () => ({
  CLAUDE_SONNET: 'claude-sonnet-4-5',
  callClaudeForObject: vi.fn(),
}));
vi.mock('@repo/ai/keys', () => ({ keys: vi.fn() }));

import { callClaudeForObject } from '@repo/ai/claude';
import { keys } from '@repo/ai/keys';
import { WHATSAPP_PARSE_FEATURE, parseWhatsAppMessage } from '../index';

const MESSAGE =
  'Probate sale, 3 bed semi in Stockport SK4 4AP, asking 250k, vendor wants quick completion. Call Dave 07700 900123';

beforeEach(() => {
  vi.mocked(callClaudeForObject).mockReset();
  vi.mocked(keys).mockReturnValue({ ANTHROPIC_API_KEY: 'k' } as never);
});

describe('parseWhatsAppMessage', () => {
  it('routes through the shared client with the intake feature tag', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue({
      propertyAddress: 'Stockport',
      postcode: 'SK4 4AP',
      askingPricePence: 25_000_000,
      sellerSituation: 'probate',
      confidence: 0.8,
    } as never);

    const parsed = await parseWhatsAppMessage(MESSAGE);

    const call = vi.mocked(callClaudeForObject).mock.calls[0][0];
    expect(call.feature).toBe(WHATSAPP_PARSE_FEATURE);
    expect(call.feature).toBe('whatsapp_intake_parse');
    expect(call.user).toContain(MESSAGE);
    expect(parsed.sellerSituation).toBe('probate');
    expect(parsed.confidence).toBe(0.8);
  });

  it('clamps confidence into [0, 1]', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue({
      confidence: 7,
    } as never);
    expect((await parseWhatsAppMessage(MESSAGE)).confidence).toBe(1);
    vi.mocked(callClaudeForObject).mockResolvedValue({} as never);
    expect((await parseWhatsAppMessage(MESSAGE)).confidence).toBe(0);
  });

  it('falls back to manual review when the call fails', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue(null);
    await expect(parseWhatsAppMessage(MESSAGE)).resolves.toEqual({
      confidence: 0,
      rawNotes: MESSAGE,
    });
  });

  it('accepts an OpenRouter-only key, and skips the call with no key at all', async () => {
    vi.mocked(keys).mockReturnValue({ OPENROUTER_API_KEY: 'or' } as never);
    vi.mocked(callClaudeForObject).mockResolvedValue({
      confidence: 0.5,
    } as never);
    expect((await parseWhatsAppMessage(MESSAGE)).confidence).toBe(0.5);

    vi.mocked(keys).mockReturnValue({} as never);
    vi.mocked(callClaudeForObject).mockClear();
    await expect(parseWhatsAppMessage(MESSAGE)).resolves.toEqual({
      confidence: 0,
      rawNotes: MESSAGE,
    });
    expect(callClaudeForObject).not.toHaveBeenCalled();
  });
});

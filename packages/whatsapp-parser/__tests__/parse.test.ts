import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/ai/claude', () => ({
  CLAUDE_SONNET: 'claude-sonnet-4-5',
  callClaudeForJson: vi.fn(),
  hasLlmProvider: vi.fn(),
}));

import { callClaudeForJson, hasLlmProvider } from '@repo/ai/claude';
import { parseWhatsAppMessage } from '../index';

const MESSAGE =
  'Probate sale, 3 bed semi in Stockport SK4 4AP, asking 250k, vendor wants quick completion. Call Dave 07700 900123';

beforeEach(() => {
  vi.mocked(callClaudeForJson).mockReset();
  vi.mocked(hasLlmProvider).mockReturnValue(true);
});

describe('parseWhatsAppMessage', () => {
  it('routes through the shared client with the intake feature tag', async () => {
    vi.mocked(callClaudeForJson).mockResolvedValue({
      propertyAddress: 'Stockport',
      postcode: 'SK4 4AP',
      askingPricePence: 25_000_000,
      sellerSituation: 'probate',
      confidence: 0.8,
    });

    const parsed = await parseWhatsAppMessage(MESSAGE);

    const call = vi.mocked(callClaudeForJson).mock.calls[0][0];
    expect(call.feature).toBe('whatsapp_parse');
    expect(call.user).toContain(MESSAGE);
    expect(parsed.sellerSituation).toBe('probate');
    expect(parsed.confidence).toBe(0.8);
  });

  it('clamps confidence into [0, 1] and strips unknown keys', async () => {
    vi.mocked(callClaudeForJson).mockResolvedValue({
      confidence: 7,
      injected: 'field',
    });
    const parsed = await parseWhatsAppMessage(MESSAGE);
    expect(parsed.confidence).toBe(1);
    expect('injected' in parsed).toBe(false);
    vi.mocked(callClaudeForJson).mockResolvedValue({});
    expect((await parseWhatsAppMessage(MESSAGE)).confidence).toBe(0);
  });

  it('falls back to manual review when the call fails', async () => {
    vi.mocked(callClaudeForJson).mockResolvedValue(null);
    await expect(parseWhatsAppMessage(MESSAGE)).resolves.toEqual({
      confidence: 0,
      rawNotes: MESSAGE,
    });
  });

  it('skips the call when no provider is keyed', async () => {
    vi.mocked(hasLlmProvider).mockReturnValue(false);
    await expect(parseWhatsAppMessage(MESSAGE)).resolves.toEqual({
      confidence: 0,
      rawNotes: MESSAGE,
    });
    expect(callClaudeForJson).not.toHaveBeenCalled();
  });
});

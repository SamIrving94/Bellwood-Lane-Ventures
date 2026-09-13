import { beforeEach, describe, expect, it, vi } from 'vitest';

// The deep appraisal must go through the shared, routable client — that is
// what puts it on Settings → AI models. Mock the client and the data layer;
// these tests are about the wiring and the prompt, not the model.
vi.mock('@repo/ai/claude', () => ({
  CLAUDE_SONNET: 'claude-sonnet-4-5',
  callClaudeForObject: vi.fn(),
  hasLlmProvider: vi.fn(),
}));

vi.mock('@repo/property-data', () => ({
  getPricePaid: vi.fn().mockResolvedValue(null),
  getHousepriceIndex: vi.fn().mockResolvedValue(null),
  getEpcData: vi.fn().mockResolvedValue(null),
  getPropertyDataValuation: vi.fn().mockResolvedValue(null),
  realTransactions: (rows: unknown[]) => rows,
}));

import { callClaudeForObject, hasLlmProvider } from '@repo/ai/claude';
import { getPricePaid } from '@repo/property-data';
import {
  DEEP_APPRAISAL_FEATURE,
  formatAvmCrossCheck,
  runDeepAppraisal,
} from '../deep-appraisal';

const baseInput = { address: '12 Test Street', postcode: 'ST4 1AA' };

beforeEach(() => {
  vi.mocked(callClaudeForObject).mockReset();
  vi.mocked(hasLlmProvider).mockReturnValue(true);
  vi.mocked(getPricePaid).mockClear();
});

describe('runDeepAppraisal routing', () => {
  it('calls the shared client tagged as deep_appraisal', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue({ ok: true } as never);

    const result = await runDeepAppraisal(baseInput);

    expect(result).toEqual({ ok: true });
    expect(callClaudeForObject).toHaveBeenCalledTimes(1);
    const call = vi.mocked(callClaudeForObject).mock.calls[0][0];
    expect(call.feature).toBe(DEEP_APPRAISAL_FEATURE);
    expect(call.feature).toBe('deep_appraisal');
    expect(call.model).toBe('claude-sonnet-4-5');
    // A 4k-token structured object cannot finish inside the client's 8s
    // default; a short budget would make every appraisal "fail" and fall
    // back for no reason.
    expect(call.attemptTimeoutMs).toBeGreaterThanOrEqual(60_000);
  });

  it('returns null from the client without throwing', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue(null);
    await expect(runDeepAppraisal(baseInput)).resolves.toBeNull();
  });

  it('bails before fetching data when no LLM provider is keyed', async () => {
    vi.mocked(hasLlmProvider).mockReturnValue(false);
    await expect(runDeepAppraisal(baseInput)).resolves.toBeNull();
    // Data gathering spends PropertyData credits — must not run.
    expect(getPricePaid).not.toHaveBeenCalled();
    expect(callClaudeForObject).not.toHaveBeenCalled();
  });
});

describe('AVM cross-check in the prompt', () => {
  it('hands the in-house AVM figure to the model', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue({ ok: true } as never);

    await runDeepAppraisal({
      ...baseInput,
      avmCrossCheck: {
        pointEstimatePence: 185_000_00,
        lowPence: 170_000_00,
        highPence: 200_000_00,
        finalOfferPence: 148_000_00,
        confidenceLevel: 'moderate',
        comparableCount: 7,
        riskScore: 42,
        conditionVisual: 'dated',
        conditionFlags: ['old kitchen', 'single glazing'],
      },
    });

    const { user, system } = vi.mocked(callClaudeForObject).mock.calls[0][0];
    expect(user).toContain('=== IN-HOUSE AVM');
    expect(user).toContain('Point estimate: £185,000');
    expect(user).toContain('Range: £170,000 – £200,000');
    expect(user).toContain('Policy offer derived from it: £148,000');
    expect(user).toContain(
      'Photo-read condition: dated (old kitchen, single glazing)'
    );
    // The system prompt must tell the model not to anchor on the AVM.
    expect(system).toContain('Do NOT anchor on the AVM');
  });

  it('asks for no_avm when the AVM has not run', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue({ ok: true } as never);
    await runDeepAppraisal(baseInput);
    const { user } = vi.mocked(callClaudeForObject).mock.calls[0][0];
    expect(user).toContain('No in-house AVM has run');
    expect(user).toContain('"no_avm"');
  });

  it('treats a zero/invalid AVM as absent', () => {
    expect(formatAvmCrossCheck({ pointEstimatePence: 0 })).toContain(
      'No in-house AVM'
    );
    expect(formatAvmCrossCheck(undefined)).toContain('No in-house AVM');
  });
});

import { describe, expect, it } from 'vitest';
import {
  callWithFallback,
  defaultAttemptTimeoutMs,
  isRecoverableProviderError,
} from '../fallback';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('defaultAttemptTimeoutMs', () => {
  it('gives long outputs minutes, not seconds', () => {
    expect(defaultAttemptTimeoutMs(800)).toBe(50_000);
    expect(defaultAttemptTimeoutMs(4000)).toBe(130_000);
  });

  it('never drops below 45s or above 180s', () => {
    expect(defaultAttemptTimeoutMs(100)).toBe(45_000);
    expect(defaultAttemptTimeoutMs(50_000)).toBe(180_000);
  });
});

describe('callWithFallback', () => {
  it('moves on when an answer arrives empty', async () => {
    const r = await callWithFallback<string | null>({
      primary: { provider: 'a', call: async () => null },
      fallbacks: [{ provider: 'b', call: async () => 'hello' }],
      validate: (v) => (v ? null : 'empty_response'),
    });
    expect(r).toEqual({
      ok: true,
      value: 'hello',
      viaFallback: true,
      provider: 'b',
    });
  });

  it('reports the validation reason when every model returns junk', async () => {
    const r = await callWithFallback<string>({
      primary: { provider: 'a', call: async () => 'not json' },
      fallbacks: [{ provider: 'b', call: async () => 'still not json' }],
      validate: () => 'unparseable_json',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect((r.error as Error).message).toBe('unparseable_json');
      expect(r.provider).toBe('b');
    }
  });

  it('stops the chain when the overall deadline is spent', async () => {
    let fallbackCalled = false;
    const started = Date.now();
    const r = await callWithFallback<string>({
      primary: { provider: 'slow', call: () => sleep(10_000).then(() => 'x') },
      fallbacks: [
        {
          provider: 'never',
          call: async () => {
            fallbackCalled = true;
            return 'y';
          },
        },
      ],
      attemptTimeoutMs: 60_000,
      totalBudgetMs: 200,
    });
    expect(r.ok).toBe(false);
    expect(fallbackCalled).toBe(false);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('isRecoverableProviderError', () => {
  it('retries a structured-output schema miss on the next model', () => {
    const e = new Error('No object generated: response did not match schema.');
    e.name = 'AI_NoObjectGeneratedError';
    expect(isRecoverableProviderError(e)).toBe(true);
  });
});

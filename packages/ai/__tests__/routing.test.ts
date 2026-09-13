import { describe, expect, it } from 'vitest';
import { isBillingError, isRecoverableProviderError } from '../fallback';
import {
  DEFAULT_FALLBACK_CHAINS,
  planProviders,
  toOpenRouterId,
} from '../routing';

const BOTH = { ANTHROPIC_API_KEY: 'sk-ant', OPENROUTER_API_KEY: 'sk-or' };

describe('toOpenRouterId', () => {
  it('maps our Claude tiers to the dotted OpenRouter ids', () => {
    expect(toOpenRouterId('claude-haiku-4-5')).toBe(
      'anthropic/claude-haiku-4.5'
    );
    expect(toOpenRouterId('claude-sonnet-4-5')).toBe(
      'anthropic/claude-sonnet-4.5'
    );
    expect(toOpenRouterId('claude-opus-4-7')).toBe('anthropic/claude-opus-4.7');
  });

  it('maps the Claude 5 generation without inventing a dot', () => {
    expect(toOpenRouterId('claude-sonnet-5')).toBe('anthropic/claude-sonnet-5');
    expect(toOpenRouterId('claude-opus-5')).toBe('anthropic/claude-opus-5');
  });

  it('passes slash ids through untouched and dots unknown Claude versions', () => {
    expect(toOpenRouterId('z-ai/glm-5.2')).toBe('z-ai/glm-5.2');
    expect(toOpenRouterId('claude-sonnet-5-0')).toBe(
      'anthropic/claude-sonnet-5.0'
    );
  });
});

describe('planProviders', () => {
  it('goes through OpenRouter first when both keys are set, Anthropic direct next', () => {
    const plan = planProviders('claude-sonnet-4-5', BOTH);
    expect(plan?.primary.label).toBe('openrouter:anthropic/claude-sonnet-4.5');
    expect(plan?.fallbacks.map((f) => f.label)).toEqual([
      'anthropic:claude-sonnet-4-5',
      'openrouter:z-ai/glm-5.2',
      'openrouter:moonshotai/kimi-k2.6',
    ]);
  });

  it('uses the fast chain for Haiku-class work', () => {
    const plan = planProviders('claude-haiku-4-5', BOTH);
    expect(plan?.primary.model).toBe('anthropic/claude-haiku-4.5');
    expect(plan?.fallbacks.map((f) => f.model)).toEqual([
      'claude-haiku-4-5',
      ...DEFAULT_FALLBACK_CHAINS.fast.slice(1),
    ]);
  });

  it('LLM_PRIMARY_PROVIDER=anthropic goes direct first, OpenRouter behind it', () => {
    const plan = planProviders('claude-sonnet-4-5', {
      ...BOTH,
      LLM_PRIMARY_PROVIDER: 'anthropic',
    });
    expect(plan?.primary.label).toBe('anthropic:claude-sonnet-4-5');
    expect(plan?.fallbacks[0]?.label).toBe(
      'openrouter:anthropic/claude-sonnet-4.5'
    );
  });

  it('Anthropic key only: direct, no fallbacks', () => {
    const plan = planProviders('claude-sonnet-4-5', { ANTHROPIC_API_KEY: 'x' });
    expect(plan?.primary.kind).toBe('anthropic');
    expect(plan?.fallbacks).toEqual([]);
  });

  it('OpenRouter key only still serves a bare Claude id', () => {
    const plan = planProviders('claude-haiku-4-5', { OPENROUTER_API_KEY: 'x' });
    expect(plan?.primary.label).toBe('openrouter:anthropic/claude-haiku-4.5');
    expect(plan?.fallbacks.every((f) => f.kind === 'openrouter')).toBe(true);
  });

  it('a slash id needs the OpenRouter key and falls back to Sonnet direct', () => {
    expect(
      planProviders('qwen/qwen3-235b-a22b-2507', { ANTHROPIC_API_KEY: 'x' })
    ).toBeNull();
    const plan = planProviders('qwen/qwen3-235b-a22b-2507', BOTH);
    expect(plan?.primary.label).toBe('openrouter:qwen/qwen3-235b-a22b-2507');
    expect(plan?.fallbacks[0]?.label).toBe('anthropic:claude-sonnet-4-5');
  });

  it('LLM_FALLBACK_CHAIN overrides the built-in chain', () => {
    const plan = planProviders('claude-sonnet-4-5', {
      ...BOTH,
      LLM_FALLBACK_CHAIN:
        'deepseek/deepseek-v4-flash, meta-llama/llama-4-maverick',
    });
    expect(plan?.fallbacks.map((f) => f.model)).toEqual([
      'claude-sonnet-4-5',
      'deepseek/deepseek-v4-flash',
      'meta-llama/llama-4-maverick',
    ]);
  });

  it('never lists the same provider+model twice', () => {
    const plan = planProviders('claude-sonnet-4-5', {
      ...BOTH,
      LLM_FALLBACK_CHAIN:
        'anthropic/claude-sonnet-4.5,z-ai/glm-5.2,z-ai/glm-5.2',
    });
    const labels = [
      plan?.primary.label,
      ...(plan?.fallbacks.map((f) => f.label) ?? []),
    ];
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('returns null with no keys at all', () => {
    expect(planProviders('claude-sonnet-4-5', {})).toBeNull();
  });
});

describe('billing errors are recoverable', () => {
  it('recognises the Anthropic empty-balance 400 that took the crons down', () => {
    const err = Object.assign(
      new Error(
        'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'
      ),
      { status: 400 }
    );
    expect(isBillingError(err)).toBe(true);
    expect(isRecoverableProviderError(err)).toBe(true);
  });

  it('recognises the AI SDK shape (statusCode + responseBody) and 402', () => {
    const sdk = Object.assign(new Error('Bad Request'), {
      statusCode: 400,
      responseBody:
        '{"error":{"type":"invalid_request_error","message":"Your credit balance is too low"}}',
    });
    expect(isRecoverableProviderError(sdk)).toBe(true);
    expect(
      isRecoverableProviderError(
        Object.assign(new Error('x'), { statusCode: 402 })
      )
    ).toBe(true);
  });

  it('still treats a plain validation 400 as fatal', () => {
    const err = Object.assign(new Error('max_tokens must be > 0'), {
      status: 400,
    });
    expect(isRecoverableProviderError(err)).toBe(false);
  });
});

/**
 * @repo/ai/claude — shared LLM client + helpers, on the Vercel AI SDK.
 *
 * Public surface (kept stable across migrations):
 *
 *   callClaude({ system, user, maxTokens, temperature, model?, feature?,
 *                cacheSystemPrompt?, attemptTimeoutMs? })
 *     → Promise<string | null>
 *
 *   callClaudeForJson<T>({ system, user, ... })
 *     → Promise<T | null>   (tolerant JSON extraction, no schema)
 *
 *   extractJson<T>(text) → T | null   (pure, no API call)
 *
 *   CLAUDE_SONNET / CLAUDE_HAIKU / CLAUDE_OPUS — model selector constants
 *
 *   setLlmLogger(logger) — apps install once at boot to capture per-call
 *                          metrics into Prisma. @repo/ai stays decoupled
 *                          from @repo/database.
 *
 * Production hardening:
 *   1. OpenRouter fallback. On recoverable Anthropic errors (429 / 5xx /
 *      timeout / network) we retry once through OpenRouter routing
 *      anthropic/claude-sonnet-4-5 → openai/gpt-5 → google/gemini-2.5-pro.
 *      When the fallback path succeeds the logger sees
 *      `feature: '<original>_via_fallback'`. OpenRouter is opt-in: missing
 *      OPENROUTER_API_KEY just skips fallback (caller still gets null).
 *
 *   2. Anthropic prompt caching. Long static system prompts (the SEO blog
 *      draft, the offer narrative, the comp rationale, the outreach
 *      drafts) pass `cacheSystemPrompt: true`. When `system.length > 1024`
 *      we mark it with `cacheControl: { type: 'ephemeral' }` so repeat
 *      calls inside Anthropic's ~5-minute cache window pay ~90% less on
 *      the system token portion.
 *
 * Iron rules:
 *   - Graceful: missing key / failed provider / parse failure → null. NEVER throw.
 *   - Server-only: never bundled to the client.
 *   - Stateless: a single import; no module-level retry loops or queues.
 */

import 'server-only';

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, type CoreMessage } from 'ai';
import { callWithFallback, isRecoverableProviderError } from './fallback';
import { keys } from './keys';

const env = keys();

// ───────────────────────────────────────────────────────────────────────────
// Model selectors. Tiering is intentional:
//   - Haiku 4.5  → cheap classification, summarisation (briefings, triage)
//   - Sonnet 4.5 → default for drafting, narrative, rationale
//   - Opus 4.7   → hard reasoning (contested AVMs, legal edge cases)
//
// Verify model IDs against console.anthropic.com before scaling spend.
// ───────────────────────────────────────────────────────────────────────────

export const CLAUDE_HAIKU = 'claude-haiku-4-5';
export const CLAUDE_SONNET = 'claude-sonnet-4-5';
export const CLAUDE_OPUS = 'claude-opus-4-7';

/** Back-compat alias — pre-migration code imports CLAUDE_MODEL. */
export const CLAUDE_MODEL = CLAUDE_SONNET;

export type ClaudeModelId =
  | typeof CLAUDE_HAIKU
  | typeof CLAUDE_SONNET
  | typeof CLAUDE_OPUS
  | (string & {});

/**
 * Map an Anthropic model id to the OpenRouter routing chain. We try the
 * Anthropic variant via OpenRouter first (different network path / capacity
 * pool — often clears 429s), then GPT-5, then Gemini 2.5 Pro.
 */
function openRouterChainFor(_model: ClaudeModelId): string[] {
  return [
    'anthropic/claude-sonnet-4-5',
    'openai/gpt-5',
    'google/gemini-2.5-pro',
  ];
}

// ───────────────────────────────────────────────────────────────────────────
// Per-call metric capture
// ───────────────────────────────────────────────────────────────────────────

export interface LlmCallMetric {
  /** Feature tag for grouping — e.g. "morning_briefing", "offer_narrative".
   *  When a call is served by the OpenRouter fallback the suffix
   *  `_via_fallback` is appended automatically. */
  feature: string;
  /** Model ID actually used. */
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
  /** True when Claude returned a usable result, false on any failure path. */
  success: boolean;
  /** Short error description on failure. Never includes prompt content. */
  errorReason?: string;
}

export type LlmLogger = (metric: LlmCallMetric) => Promise<void> | void;

let llmLogger: LlmLogger | null = null;

/**
 * Install a logger callback. Apps wire this in their instrumentation.ts
 * so @repo/ai doesn't take a hard dependency on @repo/database.
 *
 *   // apps/api/instrumentation.ts
 *   export async function register() {
 *     const { setLlmLogger } = await import('@repo/ai/claude');
 *     const { database } = await import('@repo/database');
 *     setLlmLogger((m) => database.llmCallLog.create({ data: m }));
 *   }
 *
 * Pass null to remove the logger (useful in tests).
 */
export function setLlmLogger(logger: LlmLogger | null): void {
  llmLogger = logger;
}

async function logSafely(metric: LlmCallMetric): Promise<void> {
  if (!llmLogger) return;
  try {
    await llmLogger(metric);
  } catch (err) {
    console.warn('[@repo/ai/claude] LLM logger failed (non-fatal)', err);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// callClaude — single text completion with fallback + caching
// ───────────────────────────────────────────────────────────────────────────

export interface CallClaudeInput {
  system: string;
  user: string;
  /** Hard cap on response length. Default 800. */
  maxTokens?: number;
  /** Temperature 0-1. Default 0.3 — tight but not deterministic. */
  temperature?: number;
  /** Model selector. Defaults to Sonnet. Use CLAUDE_HAIKU for classification. */
  model?: ClaudeModelId;
  /** Feature tag for metrics. Default 'unknown'. */
  feature?: string;
  /**
   * Opt into Anthropic ephemeral prompt caching for the static system
   * prompt. Only applied when `system.length > 1024` — shorter prompts
   * incur cache-write overhead that exceeds the saving. Default false.
   */
  cacheSystemPrompt?: boolean;
  /**
   * Per-attempt wall-clock budget in ms. Primary + first fallback hop
   * are bounded to ~2×this. Default 8000.
   */
  attemptTimeoutMs?: number;
}

/** Decide whether to attach Anthropic prompt-cache control to this call. */
function shouldCache(input: CallClaudeInput): boolean {
  if (!input.cacheSystemPrompt) return false;
  if (!input.system) return false;
  return input.system.length > 1024;
}

/**
 * Build the messages array. When caching is on, we promote the system
 * prompt to a CoreMessage with providerOptions so the Anthropic provider
 * emits the wire-level `cache_control` block. When caching is off, we
 * return undefined system+messages and rely on the simpler top-level
 * `system: string, prompt: string` API of generateText.
 */
function buildPromptShape(
  input: CallClaudeInput,
  enableCache: boolean,
):
  | { mode: 'simple'; system: string; prompt: string }
  | { mode: 'messages'; messages: CoreMessage[] } {
  if (!enableCache) {
    return { mode: 'simple', system: input.system, prompt: input.user };
  }
  // AI SDK v4: providerOptions on a text part. The Anthropic provider
  // reads `providerOptions.anthropic.cacheControl` and emits the
  // wire-level `cache_control` block.
  const messages: CoreMessage[] = [
    {
      role: 'system',
      content: [
        {
          type: 'text',
          text: input.system,
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        },
      ],
    } as CoreMessage,
    { role: 'user', content: input.user },
  ];
  return { mode: 'messages', messages };
}

/**
 * Single text-completion call. Returns the assistant text, or null on any
 * failure (missing key, network, model error, empty content). NEVER throws.
 *
 * Flow:
 *   1. Try Anthropic direct (with optional prompt caching).
 *   2. On recoverable error (429 / 5xx / timeout) AND OPENROUTER_API_KEY
 *      present: retry once through OpenRouter routing chain.
 *   3. On all paths failing: log + return null. Callers degrade.
 */
export async function callClaude(input: CallClaudeInput): Promise<string | null> {
  const model = input.model ?? CLAUDE_SONNET;
  const feature = input.feature ?? 'unknown';
  const enableCache = shouldCache(input);
  const attemptTimeoutMs = input.attemptTimeoutMs ?? 8000;
  const startedAt = Date.now();

  if (!env.ANTHROPIC_API_KEY) {
    console.warn('[@repo/ai/claude] no ANTHROPIC_API_KEY set — returning null');
    await logSafely({
      feature,
      model,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
      success: false,
      errorReason: 'no_api_key',
    });
    return null;
  }

  const shape = buildPromptShape(input, enableCache);
  const maxTokens = input.maxTokens ?? 800;
  const temperature = input.temperature ?? 0.3;

  // Track usage from whichever provider answers.
  let lastUsage: { promptTokens?: number; completionTokens?: number } = {};

  // ── Primary: Anthropic direct ────────────────────────────────────────
  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const primaryCall = async (): Promise<string | null> => {
    const result =
      shape.mode === 'simple'
        ? await generateText({
            model: anthropic(model),
            system: shape.system,
            prompt: shape.prompt,
            maxTokens,
            temperature,
          })
        : await generateText({
            model: anthropic(model),
            messages: shape.messages,
            maxTokens,
            temperature,
          });
    lastUsage = result.usage;
    return result.text || null;
  };

  // ── Fallbacks: OpenRouter chain (opt-in via OPENROUTER_API_KEY) ──────
  const fallbacks: { provider: string; call: () => Promise<string | null> }[] =
    [];
  if (env.OPENROUTER_API_KEY) {
    const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
    for (const orModel of openRouterChainFor(model)) {
      fallbacks.push({
        provider: `openrouter:${orModel}`,
        call: async (): Promise<string | null> => {
          const result =
            shape.mode === 'simple'
              ? await generateText({
                  model: openrouter(orModel),
                  system: shape.system,
                  prompt: shape.prompt,
                  maxTokens,
                  temperature,
                })
              : await generateText({
                  model: openrouter(orModel),
                  messages: shape.messages,
                  maxTokens,
                  temperature,
                });
          lastUsage = result.usage;
          return result.text || null;
        },
      });
    }
  }

  const fallbackResult = await callWithFallback<string | null>({
    primary: { provider: `anthropic:${model}`, call: primaryCall },
    fallbacks,
    isRecoverable: isRecoverableProviderError,
    attemptTimeoutMs,
  });

  const durationMs = Date.now() - startedAt;

  if (fallbackResult.ok) {
    const text = fallbackResult.value;
    await logSafely({
      feature: fallbackResult.viaFallback ? `${feature}_via_fallback` : feature,
      model,
      inputTokens: lastUsage.promptTokens ?? 0,
      outputTokens: lastUsage.completionTokens ?? 0,
      durationMs,
      success: !!text,
      errorReason: text ? undefined : 'empty_response',
    });
    return text;
  }

  console.error('[@repo/ai/claude] all providers failed', {
    feature,
    provider: fallbackResult.provider,
  });
  await logSafely({
    feature,
    model,
    inputTokens: 0,
    outputTokens: 0,
    durationMs,
    success: false,
    errorReason:
      fallbacks.length > 0
        ? 'all_providers_failed'
        : shortErrorReason(fallbackResult.error),
  });
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// callClaudeForJson — text completion + tolerant JSON parse
// ───────────────────────────────────────────────────────────────────────────

/**
 * Tolerant JSON extractor. Accepts:
 *   - bare JSON
 *   - JSON wrapped in ```json ... ``` fences
 *   - JSON with leading/trailing prose
 *
 * Returns null on any parse failure. Callers MUST fall back to defaults.
 */
export function extractJson<T = Record<string, unknown>>(text: string): T | null {
  const trimmed = text.trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? (fenced[1] ?? '') : trimmed;

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/**
 * Call Claude and parse the response as JSON. Returns null on missing key,
 * failed call, or unparseable response. NEVER throws.
 *
 * Prefer this when the prompt asks Claude to return JSON in free-form. For
 * strict Zod-schema enforcement, use generateObject() directly via the
 * Vercel AI SDK with createAnthropic(model).
 */
export async function callClaudeForJson<T = Record<string, unknown>>(
  input: CallClaudeInput,
): Promise<T | null> {
  const text = await callClaude(input);
  if (!text) return null;
  return extractJson<T>(text);
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function shortErrorReason(err: unknown): string {
  if (err instanceof Error) {
    return err.message.slice(0, 200);
  }
  return String(err).slice(0, 200);
}

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
 *   1. OpenRouter first, with a fallback chain. When OPENROUTER_API_KEY is
 *      set every call goes through OpenRouter (one bill, any model — see
 *      planProviders in ./routing). On a recoverable error (429 / 5xx /
 *      timeout / network / EMPTY BALANCE) we try Anthropic direct (if
 *      keyed), then the per-tier chain of Claude-via-OpenRouter and two
 *      open-weight models. When a fallback serves the call the logger
 *      sees `feature: '<original>_via_fallback'` and the model that
 *      actually answered. LLM_PRIMARY_PROVIDER=anthropic goes direct
 *      first instead; no OpenRouter key = Anthropic direct only.
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
import { type CoreMessage, generateObject, generateText } from 'ai';
import type { z } from 'zod';
import { callWithFallback, isRecoverableProviderError } from './fallback';
import { keys } from './keys';
import {
  type ModelRoute,
  type ProviderPlanStep,
  openRouterProviderPrefs,
  planProviders,
  resolveRoute,
} from './routing';

export {
  DEFAULT_FALLBACK_CHAINS,
  OPENROUTER_CLAUDE_IDS,
  planProviders,
  setModelRouter,
  toOpenRouterId,
  type ModelRoute,
  type ModelRouter,
} from './routing';

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
 * Is any LLM provider keyed? Callers that used to check ANTHROPIC_API_KEY
 * before calling (deep appraisal, WhatsApp parser, photo screener) should
 * use this instead — OpenRouter alone is enough to serve every feature.
 */
export function hasLlmProvider(): boolean {
  return !!(env.ANTHROPIC_API_KEY || env.OPENROUTER_API_KEY);
}

// ───────────────────────────────────────────────────────────────────────────
// Per-call metric capture
// ───────────────────────────────────────────────────────────────────────────

export interface LlmCallMetric {
  /** Feature tag for grouping — e.g. "morning_briefing", "offer_narrative".
   *  When a call is served by the OpenRouter fallback the suffix
   *  `_via_fallback` is appended automatically. */
  feature: string;
  /** Model id that actually answered (the fallback's id when one served). */
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
  // Fallback to the globalThis hook: instrumentation.ts CANNOT import this
  // module (its runtime lacks the react-server condition, so the
  // 'server-only' guard throws), and even if it could, Next bundles
  // instrumentation separately — module-level state would not be shared
  // with route handlers. globalThis IS shared across bundles in a process.
  const logger =
    llmLogger ??
    ((globalThis as Record<string, unknown>).__bellwoodLlmLogger as
      | LlmLogger
      | undefined);
  if (!logger) return;
  try {
    await logger(metric);
  } catch (err) {
    console.warn('[@repo/ai/claude] LLM logger failed (non-fatal)', err);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Provider attempt construction — shared by callClaude / callClaudeForObject
// ───────────────────────────────────────────────────────────────────────────

type ProviderAttempt<T> = { provider: string; call: () => Promise<T> };
type AiModelInstance = Parameters<typeof generateText>[0]['model'];

/** Live AI SDK model instance for one step of a provider plan. */
function instantiate(
  s: ProviderPlanStep,
  providerPrefs: Record<string, unknown> | undefined
): AiModelInstance {
  if (s.kind === 'anthropic') {
    return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY! })(s.model);
  }
  const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY! });
  // extraBody.provider is OpenRouter's provider-routing block; the
  // ai-sdk provider forwards it verbatim. Cast: the settings type lags
  // the wire format.
  return openrouter(
    s.model,
    (providerPrefs ? { extraBody: { provider: providerPrefs } } : {}) as Record<
      string,
      never
    >
  );
}

/**
 * Build the primary + fallback provider attempts for a resolved model id.
 * The ORDER is decided by planProviders (pure, tested); this only wires
 * SDK instances. Returns null when no viable key exists.
 */
function buildProviderAttempts<T>(
  model: string,
  providerPrefs: Record<string, unknown> | undefined,
  runModel: (modelInstance: AiModelInstance) => Promise<T>
): { primary: ProviderAttempt<T>; fallbacks: ProviderAttempt<T>[] } | null {
  const plan = planProviders(model, env);
  if (!plan) return null;
  const toAttempt = (s: ProviderPlanStep): ProviderAttempt<T> => ({
    provider: s.label,
    call: () => runModel(instantiate(s, providerPrefs)),
  });
  return {
    primary: toAttempt(plan.primary),
    fallbacks: plan.fallbacks.map(toAttempt),
  };
}

/** "openrouter:z-ai/glm-5.2" → "z-ai/glm-5.2" — the id for the log row. */
function servedModel(providerLabel: string, fallback: string): string {
  const i = providerLabel.indexOf(':');
  return i === -1 ? fallback : providerLabel.slice(i + 1);
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
  /**
   * Photos to show the model (vision). Base64 data + media type, already
   * fetched and size-checked by the caller. Sent as image parts ahead of
   * the user text. Only pick vision-capable models for such features.
   */
  images?: { data: string; mediaType: string }[];
  /**
   * INTERNAL — set on shadow-eval calls so they bypass routing (no
   * recursion) and never trigger their own shadow. Do not set manually.
   */
  bypassRouting?: boolean;
  /**
   * INTERNAL — OpenRouter provider-routing prefs threaded from the
   * route to shadow calls (host pinning / ZDR). Do not set manually.
   */
  providerPrefs?: Record<string, unknown>;
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
 * emits the wire-level `cache_control` block. Images force the messages
 * shape too (the user turn becomes image parts + text). Otherwise we
 * return the simpler top-level `system: string, prompt: string` API of
 * generateText.
 */
function buildPromptShape(
  input: CallClaudeInput,
  enableCache: boolean
):
  | { mode: 'simple'; system: string; prompt: string }
  | { mode: 'messages'; messages: CoreMessage[] } {
  const images = input.images ?? [];
  if (!enableCache && images.length === 0) {
    return { mode: 'simple', system: input.system, prompt: input.user };
  }
  // AI SDK v4.1: CoreSystemMessage.content is typed as string only, but
  // the Anthropic provider DOES accept text-part arrays with
  // providerOptions.anthropic.cacheControl at runtime — this is how
  // wire-level `cache_control` blocks are emitted. The typing is behind
  // the runtime here; cast through unknown to bridge the gap.
  const systemMsg = enableCache
    ? {
        role: 'system' as const,
        content: [
          {
            type: 'text' as const,
            text: input.system,
            providerOptions: {
              anthropic: { cacheControl: { type: 'ephemeral' as const } },
            },
          },
        ],
      }
    : { role: 'system' as const, content: input.system };
  const userMsg: CoreMessage =
    images.length > 0
      ? {
          role: 'user',
          content: [
            ...images.map((img) => ({
              type: 'image' as const,
              image: img.data,
              mimeType: img.mediaType,
            })),
            { type: 'text' as const, text: input.user },
          ],
        }
      : { role: 'user', content: input.user };
  const messages: CoreMessage[] = [
    systemMsg as unknown as CoreMessage,
    userMsg,
  ];
  return { mode: 'messages', messages };
}

export interface CallClaudeResult {
  /** Assistant text, or null on any failure. */
  text: string | null;
  /** Model id that answered (or was attempted last), for audit fields. */
  model: string;
  /** Provider label that answered, e.g. "openrouter:z-ai/glm-5.2". */
  provider: string | null;
  viaFallback: boolean;
}

/**
 * Single text-completion call. Returns the assistant text, or null on any
 * failure (missing key, network, model error, empty content). NEVER throws.
 *
 * Flow:
 *   1. Try the primary from planProviders (OpenRouter when keyed).
 *   2. On recoverable error (429 / 5xx / timeout / empty balance): walk
 *      the fallback chain — Anthropic direct, then Claude-via-OpenRouter,
 *      then two open-weight models.
 *   3. On all paths failing: log + return null. Callers degrade.
 */
export async function callClaude(
  input: CallClaudeInput
): Promise<string | null> {
  return (await callClaudeWithMeta(input)).text;
}

/** callClaude, plus which model/provider actually answered. */
export async function callClaudeWithMeta(
  input: CallClaudeInput
): Promise<CallClaudeResult> {
  const feature = input.feature ?? 'unknown';
  // Dashboard routing wins over the caller's hardcoded tier. Shadow-eval
  // calls bypass routing so they can't recurse or be re-overridden.
  const route: ModelRoute | null = input.bypassRouting
    ? null
    : await resolveRoute(feature);
  const model = route?.model ?? input.model ?? CLAUDE_SONNET;
  const enableCache = shouldCache(input);
  const attemptTimeoutMs = input.attemptTimeoutMs ?? 8000;
  const startedAt = Date.now();

  const noKey = { text: null, model, provider: null, viaFallback: false };
  if (!planProviders(model, env)) {
    console.warn(
      '[@repo/ai/claude] no API key for routed model — returning null'
    );
    await logSafely({
      feature,
      model,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
      success: false,
      errorReason: 'no_api_key',
    });
    return noKey;
  }

  const shape = buildPromptShape(input, enableCache);
  const maxTokens = input.maxTokens ?? 800;
  const temperature = input.temperature ?? 0.3;

  // Track usage from whichever provider answers.
  let lastUsage: { promptTokens?: number; completionTokens?: number } = {};

  const runModel = async (
    modelInstance: Parameters<typeof generateText>[0]['model']
  ): Promise<string | null> => {
    const result =
      shape.mode === 'simple'
        ? await generateText({
            model: modelInstance,
            system: shape.system,
            prompt: shape.prompt,
            maxTokens,
            temperature,
          })
        : await generateText({
            model: modelInstance,
            messages: shape.messages,
            maxTokens,
            temperature,
          });
    lastUsage = result.usage;
    return result.text || null;
  };

  // OpenRouter provider-routing prefs (host pinning / ZDR / no-training)
  // come from the route, and are threaded to shadow calls explicitly.
  const providerPrefs = input.providerPrefs ?? openRouterProviderPrefs(route);

  const attempts = buildProviderAttempts(model, providerPrefs, runModel);
  if (!attempts) {
    // Defensive — the key check above should already have caught this.
    return noKey;
  }

  const fallbackResult = await callWithFallback<string | null>({
    primary: attempts.primary,
    fallbacks: attempts.fallbacks,
    isRecoverable: isRecoverableProviderError,
    attemptTimeoutMs,
  });

  const durationMs = Date.now() - startedAt;
  const served = servedModel(fallbackResult.provider, model);

  if (fallbackResult.ok) {
    const text = fallbackResult.value;
    await logSafely({
      feature: fallbackResult.viaFallback ? `${feature}_via_fallback` : feature,
      model: served,
      inputTokens: lastUsage.promptTokens ?? 0,
      outputTokens: lastUsage.completionTokens ?? 0,
      durationMs,
      success: !!text,
      errorReason: text ? undefined : 'empty_response',
    });

    // ── Shadow eval: re-run the same prompt on the challenger model.
    // Result is logged (feature suffix `__shadow`) and discarded — the
    // caller only ever sees the primary's answer. Failures are silent.
    if (text && !input.bypassRouting && route?.shadowModel) {
      const rate = route.shadowSampleRate ?? 1;
      if (Math.random() < rate) {
        try {
          await callClaude({
            ...input,
            model: route.shadowModel,
            feature: `${feature}__shadow`,
            bypassRouting: true,
            providerPrefs: openRouterProviderPrefs(route),
            cacheSystemPrompt: false,
          });
        } catch {
          // never let a shadow failure affect the primary path
        }
      }
    }

    return {
      text,
      model: served,
      provider: fallbackResult.provider,
      viaFallback: fallbackResult.viaFallback,
    };
  }

  console.error('[@repo/ai/claude] all providers failed', {
    feature,
    provider: fallbackResult.provider,
    error: shortErrorReason(fallbackResult.error),
  });
  await logSafely({
    feature,
    model: served,
    inputTokens: 0,
    outputTokens: 0,
    durationMs,
    success: false,
    errorReason:
      attempts.fallbacks.length > 0
        ? `all_providers_failed: ${shortErrorReason(fallbackResult.error)}`.slice(
            0,
            200
          )
        : shortErrorReason(fallbackResult.error),
  });
  return {
    text: null,
    model: served,
    provider: fallbackResult.provider,
    viaFallback: false,
  };
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
export function extractJson<T = Record<string, unknown>>(
  text: string
): T | null {
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
  input: CallClaudeInput
): Promise<T | null> {
  const text = await callClaude(input);
  if (!text) return null;
  return extractJson<T>(text);
}

// ───────────────────────────────────────────────────────────────────────────
// callClaudeForObject — schema-GUARANTEED structured output
// ───────────────────────────────────────────────────────────────────────────

export interface CallClaudeObjectInput<T> {
  system: string;
  user: string;
  /** Zod schema — the provider constrains generation to match it. */
  schema: z.ZodType<T>;
  /** Hard cap on response length. Default 800. */
  maxTokens?: number;
  /** Temperature 0-1. Default 0.2 — structured extraction wants tight. */
  temperature?: number;
  /** Model selector. Routing config overrides it, as in callClaude. */
  model?: ClaudeModelId;
  /** Feature tag for metrics + routing. Default 'unknown'. */
  feature?: string;
  /** Per-attempt wall-clock budget in ms. Default 8000. */
  attemptTimeoutMs?: number;
  /** INTERNAL — shadow-eval calls bypass routing. Do not set manually. */
  bypassRouting?: boolean;
  /** INTERNAL — provider prefs threaded to shadow calls. Do not set manually. */
  providerPrefs?: Record<string, unknown>;
}

/**
 * Structured-output call: the response is generated AGAINST the Zod
 * schema (AI SDK generateObject), so the returned object is valid or the
 * call fails — no tolerant-parse failure class, no prompt-begging for
 * JSON. Prefer this over callClaudeForJson for anything a cron writes to
 * the database.
 *
 * Same routing, provider fallback, logging and shadow evals as callClaude.
 * The shadow re-runs the same schema on the challenger model, so a
 * challenger that cannot hold the schema shows up as `__shadow` failures
 * on the usage page before anyone flips it to primary. Returns null on any
 * failure — callers degrade as usual.
 */
export async function callClaudeForObject<T>(
  input: CallClaudeObjectInput<T>
): Promise<T | null> {
  const feature = input.feature ?? 'unknown';
  const route: ModelRoute | null = input.bypassRouting
    ? null
    : await resolveRoute(feature);
  const model = route?.model ?? input.model ?? CLAUDE_SONNET;
  const startedAt = Date.now();

  let lastUsage: { promptTokens?: number; completionTokens?: number } = {};
  const runModel = async (modelInstance: AiModelInstance): Promise<T> => {
    const result = await generateObject({
      model: modelInstance,
      schema: input.schema,
      system: input.system,
      prompt: input.user,
      maxTokens: input.maxTokens ?? 800,
      temperature: input.temperature ?? 0.2,
    });
    lastUsage = result.usage;
    return result.object;
  };

  const providerPrefs = input.providerPrefs ?? openRouterProviderPrefs(route);
  const attempts = buildProviderAttempts(model, providerPrefs, runModel);
  if (!attempts) {
    console.warn(
      '[@repo/ai/claude] no API key for routed model — returning null'
    );
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

  const result = await callWithFallback<T>({
    primary: attempts.primary,
    fallbacks: attempts.fallbacks,
    isRecoverable: isRecoverableProviderError,
    attemptTimeoutMs: input.attemptTimeoutMs ?? 8000,
  });

  const durationMs = Date.now() - startedAt;
  const served = servedModel(result.provider, model);
  if (result.ok) {
    await logSafely({
      feature: result.viaFallback ? `${feature}_via_fallback` : feature,
      model: served,
      inputTokens: lastUsage.promptTokens ?? 0,
      outputTokens: lastUsage.completionTokens ?? 0,
      durationMs,
      success: true,
    });

    // ── Shadow eval, mirroring callClaudeWithMeta: same prompt + schema on
    // the challenger, logged under `__shadow`, result discarded. Silent on
    // failure so it can never affect the primary path.
    if (!input.bypassRouting && route?.shadowModel) {
      const rate = route.shadowSampleRate ?? 1;
      if (Math.random() < rate) {
        try {
          await callClaudeForObject({
            ...input,
            model: route.shadowModel,
            feature: `${feature}__shadow`,
            bypassRouting: true,
            providerPrefs,
          });
        } catch {
          // never let a shadow failure affect the primary path
        }
      }
    }

    return result.value;
  }

  console.error('[@repo/ai/claude] structured call failed', {
    feature,
    provider: result.provider,
    error: shortErrorReason(result.error),
  });
  await logSafely({
    feature,
    model: served,
    inputTokens: 0,
    outputTokens: 0,
    durationMs,
    success: false,
    errorReason: shortErrorReason(result.error),
  });
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// Direct-call logging
// ───────────────────────────────────────────────────────────────────────────

/**
 * For the few call sites that MUST talk to Anthropic directly because they
 * use a feature the AI SDK path does not carry (the Files API + citations
 * in probate-extract, the web-search server tool in overnight-research).
 * They cannot be routed, but their spend should still land on the usage
 * page next to everything else. Never throws.
 */
export function recordLlmCall(metric: LlmCallMetric): Promise<void> {
  return logSafely(metric);
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

/**
 * @repo/ai/fallback — provider fallback orchestration.
 *
 * The Vercel AI SDK does not ship a built-in multi-provider fallback
 * primitive, so we layer one on top. The goal: if the primary call
 * (Anthropic direct) hits a recoverable error (429 rate-limit, 5xx,
 * network timeout, AbortError), retry exactly once through OpenRouter
 * routing across a small chain of equivalent models.
 *
 * Design constraints (from Tier-A plan):
 *   - NEVER throws. The fallback returning a null `Result` is the
 *     failure mode — callers already handle null gracefully (see the
 *     "iron rule" pattern in callClaude / callClaudeForJson).
 *   - Total wall-clock budget for primary + fallback is bounded so a
 *     stuck provider can't block a request indefinitely: a per-attempt
 *     cap AND an overall deadline (`totalBudgetMs`). The deadline matters
 *     more than the cap. Oct 2026: every attempt was capped at 8s with no
 *     deadline, so a 1,000-word blog draft timed out on every model in
 *     the chain and the weekly guide never once produced a draft. Give
 *     each attempt the time its output needs; let the deadline stop the
 *     chain before the Vercel function is killed, so the failure is
 *     logged instead of lost.
 *   - OpenRouter is OPT-IN: if no fallback function is supplied, the
 *     primary failure short-circuits to null. The caller (claude.ts)
 *     omits the fallback function when OPENROUTER_API_KEY is missing.
 */

// ───────────────────────────────────────────────────────────────────────────
// Time budgets
//
// Founder direction (Oct 2026): slower is fine, cutting out is not. Until
// then every attempt had a flat 8s cap, which no long output can meet: the
// blog drafter (4,000 tokens) timed out on every model in the chain and the
// weekly guide never once produced a draft. Budgets now scale with the
// output asked for, and one overall deadline stops the chain while there is
// still time to log the failure.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Per-attempt budget for an output of `maxTokens`. Assumes a slow host
 * (~40 tokens/s) plus time to first token, so 800 tokens gets 50s and a
 * 4,000-token draft gets 130s. Capped at 180s.
 */
export function defaultAttemptTimeoutMs(maxTokens: number): number {
  return Math.min(180_000, Math.max(45_000, 30_000 + maxTokens * 25));
}

/**
 * Overall deadline across primary + fallbacks. Sits under the 300s Vercel
 * default with room for the caller to write its result. A route that makes
 * several calls in a row needs its own `maxDuration` to match.
 */
export const DEFAULT_TOTAL_BUDGET_MS = 270_000;

export type FallbackResult<T> =
  | { ok: true; value: T; viaFallback: boolean; provider: string }
  | { ok: false; error: unknown; provider: string };

export type ProviderAttempt<T> = {
  /** Label used in logs and the LlmCallLog `feature` suffix. */
  provider: string;
  /** The async call that actually invokes the model. */
  call: () => Promise<T>;
};

export type CallWithFallbackOpts<T> = {
  primary: ProviderAttempt<T>;
  /**
   * Ordered list of providers to try after the primary fails on a
   * recoverable error. The first one to succeed wins. Pass an empty
   * array (or omit) to disable fallback entirely.
   */
  fallbacks?: ProviderAttempt<T>[];
  /** Predicate: does this error count as recoverable / worth retrying? */
  isRecoverable?: (err: unknown) => boolean;
  /** Per-attempt wall-clock budget in ms. Default 5000. */
  attemptTimeoutMs?: number;
  /**
   * Overall deadline in ms across primary + every fallback. Each attempt
   * gets min(attemptTimeoutMs, time left). Unset = no deadline.
   */
  totalBudgetMs?: number;
  /**
   * Reject a value that arrived but is unusable (empty text, unparseable
   * JSON). Return a short reason to reject, null to accept. A rejection
   * is treated as a recoverable error, so the next model gets a turn:
   * one model returning nothing is not evidence the next one will.
   */
  validate?: (value: T) => string | null;
};

/** Below this much time left, starting another attempt is pointless. */
const MIN_ATTEMPT_MS = 5000;

/** Error for a response that arrived but failed `validate`. */
export class InvalidResponseError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'InvalidResponseError';
  }
}

/**
 * Wording the providers use for "your account has no money". Anthropic
 * sends it as HTTP 400 invalid_request_error, OpenAI as 429
 * insufficient_quota, OpenRouter as 402. None of these are the caller's
 * fault and every one of them is exactly what another provider can serve.
 * Sept 2026: an empty Anthropic balance took down deep appraisal, the
 * photo screener, the morning briefing and the marketer for days because
 * a 400 was treated as non-recoverable and the fallback never ran.
 */
const BILLING_SIGNATURES = [
  'credit balance',
  'insufficient_quota',
  'insufficient credits',
  'exceeded your current quota',
  'payment required',
  'billing',
];

/**
 * True when the error says the provider's account is out of money or
 * quota — retry elsewhere rather than failing the feature.
 */
export function isBillingError(err: unknown): boolean {
  if (!err) return false;
  const status =
    (err as { statusCode?: unknown })?.statusCode ??
    (err as { status?: unknown })?.status;
  if (status === 402) return true;
  const message = err instanceof Error ? err.message : String(err);
  const body = (err as { responseBody?: unknown })?.responseBody;
  const text =
    `${message} ${typeof body === 'string' ? body : ''}`.toLowerCase();
  return BILLING_SIGNATURES.some((sig) => text.includes(sig));
}

/**
 * Default recoverable-error detection. We're conservative — rate-limit
 * (429), 5xx upstream, network/abort/timeout and billing/quota errors
 * are retried. Other 4xx (auth, validation, unknown model) hit the same
 * wall on the next provider so are surfaced as primary failures.
 */
export function isRecoverableProviderError(err: unknown): boolean {
  if (!err) return false;
  if (isBillingError(err)) return true;
  if (err instanceof Error) {
    // An unusable answer (see `validate`) or a structured call whose output
    // missed the schema: a different model can do better, so try it. Oct
    // 2026: the founder desk failed 14 days of 14 on one model's schema
    // misses and never asked the next one.
    if (err.name === 'InvalidResponseError') return true;
    if (err.name === 'AI_NoObjectGeneratedError') return true;
    if (err.message?.includes('No object generated')) return true;
  }
  // Network / abort / timeout signatures
  if (err instanceof Error) {
    const msg = err.message?.toLowerCase() ?? '';
    if (err.name === 'AbortError') return true;
    if (err.name === 'TimeoutError') return true;
    if (msg.includes('timeout')) return true;
    if (msg.includes('econnreset')) return true;
    if (msg.includes('etimedout')) return true;
    if (msg.includes('socket hang up')) return true;
    if (msg.includes('fetch failed')) return true;
    if (msg.includes('network')) return true;
  }
  // The AI SDK wraps provider HTTP errors with a numeric `statusCode`
  // and Anthropic SDK with `status`. Check both shapes.
  const status =
    (err as { statusCode?: unknown })?.statusCode ??
    (err as { status?: unknown })?.status;
  if (typeof status === 'number') {
    if (status === 408 || status === 425 || status === 429) return true;
    // OpenRouter answers 404 when THIS model cannot be served as asked: an
    // id that is not on its list, or a host pin that excludes every host
    // for it. The next model in the chain can serve the feature, and the
    // `_via_fallback` log row records that it did. Before Oct 2026 this
    // was fatal and a pinned Haiku route stayed dark for three weeks.
    if (status === 404) return true;
    if (status >= 500 && status < 600) return true;
  }
  return false;
}

/**
 * Race a promise against a timeout. Resolves to the promise's value
 * or rejects with a TimeoutError if the budget is exceeded. We use
 * Error rather than a custom class so isRecoverableProviderError
 * still treats it as retryable.
 */
async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error(`${label} timed out after ${ms}ms`);
      e.name = 'TimeoutError';
      reject(e);
    }, ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Run the primary call. On recoverable failure, sequentially try
 * each fallback attempt. Returns the first successful result or, if
 * all paths fail, the error from the last attempt.
 *
 * Never throws — wrap usage in `.then(r => r.ok ? r.value : null)`
 * at the call site if a nullable surface is preferred.
 */
export async function callWithFallback<T>(
  opts: CallWithFallbackOpts<T>
): Promise<FallbackResult<T>> {
  const recoverable = opts.isRecoverable ?? isRecoverableProviderError;
  const attemptTimeoutMs = opts.attemptTimeoutMs ?? 5000;
  const deadline =
    opts.totalBudgetMs === undefined ? null : Date.now() + opts.totalBudgetMs;

  const run = async (attempt: ProviderAttempt<T>): Promise<T> => {
    const left = deadline === null ? attemptTimeoutMs : deadline - Date.now();
    const value = await withTimeout(
      attempt.call(),
      Math.min(attemptTimeoutMs, left),
      attempt.provider
    );
    const rejected = opts.validate?.(value);
    if (rejected) throw new InvalidResponseError(rejected);
    return value;
  };

  // Primary attempt
  try {
    const value = await run(opts.primary);
    return {
      ok: true,
      value,
      viaFallback: false,
      provider: opts.primary.provider,
    };
  } catch (primaryErr) {
    if (!recoverable(primaryErr) || !opts.fallbacks?.length) {
      return { ok: false, error: primaryErr, provider: opts.primary.provider };
    }

    let lastErr: unknown = primaryErr;
    let lastProvider = opts.primary.provider;
    for (const fb of opts.fallbacks) {
      if (deadline !== null && deadline - Date.now() < MIN_ATTEMPT_MS) {
        const e = new Error(
          `time budget used up after ${lastProvider}: ${errMessage(lastErr)}`
        );
        e.name = 'TimeoutError';
        return { ok: false, error: e, provider: lastProvider };
      }
      try {
        const value = await run(fb);
        return { ok: true, value, viaFallback: true, provider: fb.provider };
      } catch (err) {
        lastErr = err;
        lastProvider = fb.provider;
        // Only continue down the chain if THIS error is also recoverable.
        // A hard 4xx from OpenRouter (e.g. invalid model) means the chain
        // is misconfigured; surface it immediately.
        if (!recoverable(err)) {
          return { ok: false, error: err, provider: fb.provider };
        }
      }
    }
    return { ok: false, error: lastErr, provider: lastProvider };
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

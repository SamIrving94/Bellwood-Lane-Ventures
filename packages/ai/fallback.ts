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
 *     stuck provider can't block a request indefinitely. Default 5s
 *     per attempt (configurable).
 *   - OpenRouter is OPT-IN: if no fallback function is supplied, the
 *     primary failure short-circuits to null. The caller (claude.ts)
 *     omits the fallback function when OPENROUTER_API_KEY is missing.
 */

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
};

/**
 * Default recoverable-error detection. We're conservative — only
 * rate-limit (429), 5xx upstream, network/abort/timeout errors are
 * retried. 4xx auth or validation errors hit the same wall on
 * OpenRouter so are surfaced as primary failures.
 */
export function isRecoverableProviderError(err: unknown): boolean {
  if (!err) return false;
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
  label: string,
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
  opts: CallWithFallbackOpts<T>,
): Promise<FallbackResult<T>> {
  const recoverable = opts.isRecoverable ?? isRecoverableProviderError;
  const attemptTimeoutMs = opts.attemptTimeoutMs ?? 5000;

  // Primary attempt
  try {
    const value = await withTimeout(
      opts.primary.call(),
      attemptTimeoutMs,
      opts.primary.provider,
    );
    return { ok: true, value, viaFallback: false, provider: opts.primary.provider };
  } catch (primaryErr) {
    if (!recoverable(primaryErr) || !opts.fallbacks?.length) {
      return { ok: false, error: primaryErr, provider: opts.primary.provider };
    }

    let lastErr: unknown = primaryErr;
    let lastProvider = opts.primary.provider;
    for (const fb of opts.fallbacks) {
      try {
        const value = await withTimeout(fb.call(), attemptTimeoutMs, fb.provider);
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

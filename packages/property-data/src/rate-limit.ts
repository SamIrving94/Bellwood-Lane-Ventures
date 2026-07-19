/**
 * Global PropertyData rate limiter.
 *
 * PropertyData allows 4 calls per rolling 10 seconds per API key (error
 * X14 / HTTP 429 beyond that). Every outbound call must await
 * {@link acquireRateLimitSlot} before hitting the network, so the limit
 * holds process-wide even when callers fire concurrently (Promise.all
 * fan-outs like probeSourcedByType or the lead-appraise cron).
 *
 * Serialisation: acquisitions are chained on a single promise so two
 * concurrent callers can never both observe "3 slots used" and start.
 */

const WINDOW_MS = 10_000;
const MAX_CALLS_PER_WINDOW = 4;

/** Timestamps (ms) of the call-starts inside the current rolling window. */
let callStarts: number[] = [];

/** Serialisation chain — each acquisition waits for the previous one. */
let chain: Promise<void> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolves when the caller may start a PropertyData API call. Guarantees
 * no more than MAX_CALLS_PER_WINDOW call-starts in any rolling WINDOW_MS.
 * FIFO under concurrency.
 */
export function acquireRateLimitSlot(): Promise<void> {
  const acquisition = chain.then(async () => {
    for (;;) {
      const now = Date.now();
      // Entries older than the window no longer count against the limit.
      callStarts = callStarts.filter((t) => now - t < WINDOW_MS);
      if (callStarts.length < MAX_CALLS_PER_WINDOW) {
        callStarts.push(now);
        return;
      }
      // Oldest in-window entry gates the next free slot.
      const oldest = callStarts[0]!;
      await sleep(WINDOW_MS - (now - oldest));
    }
  });
  // The chain itself must never reject or every later caller would fail.
  chain = acquisition.catch(() => {});
  return acquisition;
}

/** Test hook — clears window state and the serialisation chain. */
export function resetRateLimiter(): void {
  callStarts = [];
  chain = Promise.resolve();
}

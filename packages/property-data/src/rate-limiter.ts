/**
 * Global client-side rate limiter for PropertyData.
 *
 * PropertyData allows 4 calls / 10s per key. Every LIVE fetch in the client
 * routes through `acquireRateSlot()` so no single caller can trip the 429 "X14"
 * limit. This is the ONE throttle gate — callers must NOT rely on their own
 * `setTimeout` spacing (that reliance was the latent bug behind the 2026-07-17
 * scout incident; see docs/LEARNINGS.md, "Rate limiting lives in the client,
 * not in accidental sleeps").
 *
 * Kept dependency-free (no `server-only`) so it is unit-testable in isolation.
 */

const RATE_MAX_CALLS = 4;
const RATE_WINDOW_MS = 10_000;

// Timestamps (ms) of the calls currently inside the sliding window.
const rateCallTimes: number[] = [];
// Serializes slot acquisition so concurrent callers queue in order.
let rateAcquireChain: Promise<void> = Promise.resolve();

function rateSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Block until a call slot is free within the sliding 4-calls/10s window.
 * Acquisitions are chained so concurrent callers (e.g. a Promise.all fan-out)
 * queue in order and the window is never exceeded.
 */
export async function acquireRateSlot(): Promise<void> {
  const mine = rateAcquireChain.then(async () => {
    for (;;) {
      const now = Date.now();
      while (
        rateCallTimes.length > 0 &&
        now - (rateCallTimes[0] as number) >= RATE_WINDOW_MS
      ) {
        rateCallTimes.shift();
      }
      if (rateCallTimes.length < RATE_MAX_CALLS) {
        rateCallTimes.push(now);
        return;
      }
      const waitMs = RATE_WINDOW_MS - (now - (rateCallTimes[0] as number));
      await rateSleep(Math.max(waitMs, 1));
    }
  });
  // The next caller waits for THIS caller to secure its slot (not its fetch).
  rateAcquireChain = mine.catch(() => undefined);
  return mine;
}

/** Test-only: clear the sliding window and the acquisition chain. */
export function __resetRateLimiter(): void {
  rateCallTimes.length = 0;
  rateAcquireChain = Promise.resolve();
}

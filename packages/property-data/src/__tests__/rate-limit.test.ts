import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acquireRateLimitSlot, resetRateLimiter } from '../rate-limit';

const WINDOW_MS = 10_000;
const MAX_CALLS = 4;

describe('acquireRateLimitSlot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRateLimiter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('grants the first 4 slots immediately', async () => {
    let granted = 0;
    for (let i = 0; i < MAX_CALLS; i++) {
      acquireRateLimitSlot().then(() => granted++);
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(granted).toBe(MAX_CALLS);
  });

  it('delays the 5th call until the window rolls', async () => {
    const grantedAt: number[] = [];
    const start = Date.now();
    for (let i = 0; i < 5; i++) {
      acquireRateLimitSlot().then(() => grantedAt.push(Date.now() - start));
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(grantedAt).toHaveLength(4);

    // Just before the window rolls: still blocked.
    await vi.advanceTimersByTimeAsync(WINDOW_MS - 1);
    expect(grantedAt).toHaveLength(4);

    await vi.advanceTimersByTimeAsync(1);
    expect(grantedAt).toHaveLength(5);
    expect(grantedAt[4]).toBe(WINDOW_MS);
  });

  it('12 concurrent acquisitions space into 4-per-window batches (Promise.all)', async () => {
    const grantedAt: number[] = [];
    const start = Date.now();
    const all = Promise.all(
      Array.from({ length: 12 }, () =>
        acquireRateLimitSlot().then(() => grantedAt.push(Date.now() - start)),
      ),
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(grantedAt).toHaveLength(4);

    await vi.advanceTimersByTimeAsync(WINDOW_MS);
    expect(grantedAt).toHaveLength(8);

    await vi.advanceTimersByTimeAsync(WINDOW_MS);
    expect(grantedAt).toHaveLength(12);
    await all;

    // Invariant: no rolling 10s window ever contains more than 4 starts.
    for (const t of grantedAt) {
      const inWindow = grantedAt.filter((u) => u >= t && u < t + WINDOW_MS);
      expect(inWindow.length).toBeLessThanOrEqual(MAX_CALLS);
    }
    expect(grantedAt).toEqual([
      0, 0, 0, 0,
      WINDOW_MS, WINDOW_MS, WINDOW_MS, WINDOW_MS,
      2 * WINDOW_MS, 2 * WINDOW_MS, 2 * WINDOW_MS, 2 * WINDOW_MS,
    ]);
  });

  it('staggered arrivals honour the rolling window, not fixed batches', async () => {
    const grantedAt: number[] = [];
    const start = Date.now();
    const track = () =>
      acquireRateLimitSlot().then(() => grantedAt.push(Date.now() - start));

    // 3 calls at t=0, 1 at t=4000 — window full at t=4000.
    track();
    track();
    track();
    await vi.advanceTimersByTimeAsync(4_000);
    track();
    await vi.advanceTimersByTimeAsync(0);
    expect(grantedAt).toEqual([0, 0, 0, 4_000]);

    // 5th call at t=5000 must wait for the t=0 trio to age out at t=10000.
    await vi.advanceTimersByTimeAsync(1_000);
    track();
    await vi.advanceTimersByTimeAsync(0);
    expect(grantedAt).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(grantedAt).toEqual([0, 0, 0, 4_000, WINDOW_MS]);
  });

  it('frees all slots once a full quiet window has passed', async () => {
    for (let i = 0; i < MAX_CALLS; i++) acquireRateLimitSlot();
    await vi.advanceTimersByTimeAsync(WINDOW_MS);

    let granted = 0;
    for (let i = 0; i < MAX_CALLS; i++) {
      acquireRateLimitSlot().then(() => granted++);
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(granted).toBe(MAX_CALLS);
  });
});

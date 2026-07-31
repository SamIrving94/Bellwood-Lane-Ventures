import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetRateLimiter, acquireRateSlot } from '../rate-limiter';

// PropertyData allows 4 calls / 10s per key. The limiter is the single gate that
// stops any caller (or a Promise.all fan-out) tripping the 429 "X14" limit.

describe('acquireRateSlot — 4 calls / 10s sliding window', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetRateLimiter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets the first 4 through immediately, then gates the rest until the window frees', async () => {
    const resolved: number[] = [];
    for (let i = 0; i < 6; i++) {
      acquireRateSlot().then(() => resolved.push(i));
    }

    // Flush microtasks WITHOUT advancing time: the burst of 4 clears at once.
    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toEqual([0, 1, 2, 3]);

    // Still inside the 10s window → the 5th and 6th stay blocked.
    await vi.advanceTimersByTimeAsync(9_000);
    expect(resolved).toEqual([0, 1, 2, 3]);

    // Cross the 10s boundary → the oldest slots expire and the rest proceed.
    await vi.advanceTimersByTimeAsync(1_500);
    expect(resolved).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('preserves FIFO order across the window boundary', async () => {
    const order: string[] = [];
    for (const label of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
      acquireRateSlot().then(() => order.push(label));
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual(['a', 'b', 'c', 'd']); // first window
    await vi.advanceTimersByTimeAsync(10_000);
    expect(order).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']); // next window, in order
  });
});

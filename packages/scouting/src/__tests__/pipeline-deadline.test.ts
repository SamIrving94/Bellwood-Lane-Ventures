import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runScoutingPipeline } from '../index';

/**
 * The deadline contract (27 Aug 2026): when a run hits `deadlineMs`, the
 * pipeline stops STARTING paid enrichment work and still RETURNS a normal
 * result for the caller to persist. From 24–27 Aug the daily run outgrew the
 * 800s function budget and was platform-killed BEFORE persistence — four
 * days of leads evaporated as 504s. These tests pin the two halves of the
 * fix: an expired deadline truncates the paid phases (and says so), and a
 * run with no deadline behaves exactly as before.
 */

describe('runScoutingPipeline — deadlineMs', () => {
  beforeEach(() => {
    // No network in this test: every source must fail fast and the deadline
    // guard must trip before any short-lease call is attempted.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network disabled in test');
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Generous timeouts: even with fetch disabled, the pipeline's source
  // retry/backoff loops (Gazette feed shapes, CH candidates) burn several
  // real seconds before failing over.
  it('an expired deadline truncates paid phases but the run still returns', { timeout: 60_000 }, async () => {
    const result = await runScoutingPipeline({
      limit: 5,
      scanSeeds: [{ postcode: 'SW3 3TH', radiusMiles: 1 }],
      scanShortLeases: true,
      skipSlowSources: true,
      deadlineMs: Date.now() - 1, // already passed when the run starts
    });

    // The short-lease loop is deadline-guarded per seed and must have been
    // cut before attempting its (disabled) network call.
    expect(result.truncatedByDeadline).toContain('shortLease');
    // The run completed and produced a well-formed result — this is the
    // whole point: truncation costs polish, never the run itself.
    expect(Array.isArray(result.leads)).toBe(true);
    expect(result.sourceHealth.length).toBeGreaterThan(0);
  });

  it('no deadline → no truncation (previous behaviour preserved)', { timeout: 60_000 }, async () => {
    const result = await runScoutingPipeline({
      limit: 5,
      scanSeeds: [{ postcode: 'SW3 3TH', radiusMiles: 1 }],
      scanShortLeases: true,
      skipSlowSources: true,
    });
    expect(result.truncatedByDeadline).toEqual([]);
  });
});

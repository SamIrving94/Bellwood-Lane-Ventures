import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getHousepriceIndex } from '../hmlr-hpi';

// getHousepriceIndex feeds the AVM's HPI nudge (base-valuation.ts). The /hmlr-hpi
// endpoint has been 404-ing in production; the invariant here is that a failed
// fetch must NOT fabricate a trend — a random annualChange would silently move a
// live binding-offer valuation (a Bet-2 "never silently guessed" violation).

describe('getHousepriceIndex fallback', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns an "unavailable", neutral record when the live call fails (no synthetic)', async () => {
    fetchMock.mockResolvedValue(new Response('not found', { status: 404 }));

    const hpi = await getHousepriceIndex('SW1A 2AA');

    expect(hpi.source).toBe('unavailable');
    // Neutral: annualChange 0 → the AVM nudge (1 + 0*0.15) is a no-op.
    expect(hpi.annualChange).toBe(0);
    expect(hpi.monthlyChange).toBe(0);
    expect(hpi.averagePrice).toBeNull();
    expect(hpi.trend).toBe('stable');
  });

  it('returns an "unavailable" record when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const hpi = await getHousepriceIndex('M1 1AE');
    expect(hpi.source).toBe('unavailable');
    expect(hpi.annualChange).toBe(0);
  });

  it('parses a real response and marks it hmlr_hpi', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              annualChange: 5.2,
              monthlyChange: 0.4,
              averagePrice: 320_000,
              refPeriod: '2026-05',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const hpi = await getHousepriceIndex('LS1 1AA');

    expect(hpi.source).toBe('hmlr_hpi');
    expect(hpi.annualChange).toBe(5.2);
    expect(hpi.trend).toBe('rising');
  });
});

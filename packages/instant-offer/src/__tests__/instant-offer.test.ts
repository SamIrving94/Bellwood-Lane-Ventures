/**
 * Tests for the web-facing instant offer wrapper.
 *
 * The AVM itself is covered in @repo/valuation — here we only pin the
 * behaviour this package adds on top: what gets forwarded to runAVM, how the
 * confidence score is gated, when an offer is routed to founder review, and
 * whether the seller-facing reasoning lines state the truth.
 *
 * runAVM and callClaude are mocked: the first hits HMLR/PropertyData, the
 * second hits Anthropic. Neither belongs in a unit test.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runAVM, callClaude } = vi.hoisted(() => ({
  runAVM: vi.fn(),
  callClaude: vi.fn(),
}));

vi.mock('@repo/valuation', () => ({ runAVM }));
vi.mock('@repo/ai/claude', () => ({ callClaude }));

import {
  ASSUMED_SHORT_LEASE_YEARS,
  computeConfidence,
  generateInstantOffer,
  type InstantOfferInput,
} from '../index';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * A healthy AVM payload. NOTE: every money field here is in POUNDS — that is
 * what the AVM works in, and the wrapper converts to pence on the way out.
 */
function avmResult(overrides: Record<string, unknown> = {}) {
  return {
    resultJson: {
      postcode: 'M14 5AB',
      avmPointEstimate: 305_000,
      avmLow: 295_850,
      avmHigh: 314_150,
      confidenceLevel: 'high',
      comparableCount: 11,
      avmSources: 'hmlr_ppd+hmlr_hpi+epc',
      baseAcquisitionMargin: 0.22,
      discountLines: [] as Array<{ label: string; fraction: number }>,
      finalOffer: 237_900,
      epcRating: 'C',
      epcAdjustment: 0,
      preRicsFlags: [] as string[],
      requiresCeoEscalation: false,
      discountCapped: false,
      ...overrides,
    },
  };
}

const baseInput: InstantOfferInput = {
  postcode: 'M14 5AB',
  propertyType: 'terraced',
  situation: 'other',
};

beforeEach(() => {
  vi.clearAllMocks();
  callClaude.mockResolvedValue(null);
  runAVM.mockResolvedValue(avmResult());
});

// ---------------------------------------------------------------------------
// Short lease
// ---------------------------------------------------------------------------

describe('short lease', () => {
  it('forwards a conservative lease assumption when none is supplied', async () => {
    await generateInstantOffer({ ...baseInput, situation: 'short_lease' });

    expect(runAVM).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerType: 'short_lease',
        remainingLeaseYears: ASSUMED_SHORT_LEASE_YEARS,
      }),
    );
  });

  it('the assumption is enough to offset the discounted short_lease margin', () => {
    // short_lease base margin is 15% vs standard 22% — a 7 point gap that the
    // lease discount is supposed to pay for. 65 years sits in the 60-69 band
    // of the valuation lease curve, worth exactly 7%.
    expect(ASSUMED_SHORT_LEASE_YEARS).toBeGreaterThanOrEqual(60);
    expect(ASSUMED_SHORT_LEASE_YEARS).toBeLessThan(70);
  });

  it('a caller-supplied lease term wins over the assumption', async () => {
    await generateInstantOffer({
      ...baseInput,
      situation: 'short_lease',
      remainingLeaseYears: 42,
    });

    expect(runAVM).toHaveBeenCalledWith(
      expect.objectContaining({ remainingLeaseYears: 42 }),
    );
  });

  it('discloses the assumption in the reasoning', async () => {
    const offer = await generateInstantOffer({
      ...baseInput,
      situation: 'short_lease',
    });

    expect(
      offer.reasoning.some(
        (l) => l.includes('lease not supplied') && l.includes('65'),
      ),
    ).toBe(true);
  });

  it('does not invent a lease term for other situations', async () => {
    await generateInstantOffer({ ...baseInput, situation: 'probate' });

    expect(runAVM).toHaveBeenCalledWith(
      expect.objectContaining({ remainingLeaseYears: undefined }),
    );
  });

  it('regression: short_lease never returns a HIGHER offer than standard', async () => {
    // Same property, two labels. Without the lease assumption the wrapper
    // asked for a 15% margin and never paid for it, so ticking "short lease"
    // bought you a better price than "other".
    const captured: Array<number | undefined> = [];
    runAVM.mockImplementation(
      (input: { sellerType: string; remainingLeaseYears?: number }) => {
        captured.push(input.remainingLeaseYears);
        // Reproduce the offer engine's arithmetic for the two seller types.
        const margin = input.sellerType === 'short_lease' ? 0.15 : 0.22;
        const lease =
          input.remainingLeaseYears === undefined
            ? 0
            : input.remainingLeaseYears >= 85
              ? 0
              : input.remainingLeaseYears >= 70
                ? 0.03
                : input.remainingLeaseYears >= 60
                  ? 0.07
                  : 0.12;
        return Promise.resolve(
          avmResult({ finalOffer: Math.round(305_000 * (1 - margin - lease)) }),
        );
      },
    );

    const shortLease = await generateInstantOffer({
      ...baseInput,
      situation: 'short_lease',
    });
    const standard = await generateInstantOffer({
      ...baseInput,
      situation: 'other',
    });

    expect(captured).toEqual([ASSUMED_SHORT_LEASE_YEARS, undefined]);
    expect(shortLease.offerPence).toBeLessThanOrEqual(standard.offerPence);
  });
});

// ---------------------------------------------------------------------------
// Confidence gating
// ---------------------------------------------------------------------------

describe('computeConfidence', () => {
  it('scores a well-evidenced valuation high', () => {
    expect(computeConfidence(11, true, 'high', 'hmlr_ppd+hmlr_hpi+epc')).toBe(
      1,
    );
  });

  it('regression: a synthetic-source valuation can no longer score 0.85', () => {
    // 0.5 base + 0.25 comps + 0.1 condition = 0.85 on entirely fabricated data.
    expect(
      computeConfidence(11, true, 'medium', 'synthetic'),
    ).toBeLessThanOrEqual(0.4);
  });

  it("caps a 'low' AVM confidence level", () => {
    expect(
      computeConfidence(11, true, 'low', 'hmlr_ppd'),
    ).toBeLessThanOrEqual(0.4);
  });

  it('caps a valuation with no comparables at all', () => {
    expect(
      computeConfidence(0, true, 'high', 'hmlr_ppd'),
    ).toBeLessThanOrEqual(0.4);
  });

  it('never inflates a score that was already below the cap', () => {
    expect(computeConfidence(0, false, 'low', 'synthetic')).toBe(0.4);
    expect(computeConfidence(1, false, 'low', 'synthetic')).toBe(0.4);
  });
});

describe('requiresReview', () => {
  it('is false for a well-evidenced, in-band offer', async () => {
    const offer = await generateInstantOffer(baseInput);
    expect(offer.requiresReview).toBe(false);
  });

  it('regression: routes a synthetic-comparables offer to founder review', async () => {
    runAVM.mockResolvedValue(avmResult({ avmSources: 'synthetic' }));
    const offer = await generateInstantOffer(baseInput);

    expect(offer.requiresReview).toBe(true);
    expect(
      offer.reasoning.some((l) => l.includes('Limited comparable evidence')),
    ).toBe(true);
  });

  it("routes a 'low' confidence offer to founder review", async () => {
    runAVM.mockResolvedValue(avmResult({ confidenceLevel: 'low' }));
    expect((await generateInstantOffer(baseInput)).requiresReview).toBe(true);
  });

  it('routes a zero-comparable offer to founder review', async () => {
    runAVM.mockResolvedValue(avmResult({ comparableCount: 0 }));
    expect((await generateInstantOffer(baseInput)).requiresReview).toBe(true);
  });

  it('still routes CEO escalation and discount caps', async () => {
    runAVM.mockResolvedValue(avmResult({ requiresCeoEscalation: true }));
    expect((await generateInstantOffer(baseInput)).requiresReview).toBe(true);

    runAVM.mockResolvedValue(avmResult({ discountCapped: true }));
    expect((await generateInstantOffer(baseInput)).requiresReview).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Reasoning lines
// ---------------------------------------------------------------------------

describe('reasoning lines', () => {
  it('regression: the AVM figure is stated in pounds, not 1/100th of them', async () => {
    // avmPointEstimate is already POUNDS. It used to be divided by 100, so a
    // £305,000 valuation was shown to the seller as "£3,050".
    const offer = await generateInstantOffer(baseInput);
    const line = offer.reasoning.find((l) => l.startsWith('AVM point estimate'));

    expect(line).toContain('£305,000');
    expect(line).not.toContain('£3,050');
  });

  it('the stated AVM matches the pence fields on the payload', async () => {
    const offer = await generateInstantOffer(baseInput);
    // Sanity: the offer is a plausible fraction of the stated valuation.
    expect(offer.offerPence).toBe(23_790_000);
    expect(offer.estimatedMarketValueMinPence).toBe(29_585_000);
  });

  it('regression: an A-rated EPC reads as an uplift, not a penalty', async () => {
    // EPC_ADJUSTMENT is positive for an uplift (A/B = +0.01) and negative for
    // a penalty (F/G = -0.02) — the opposite convention to discountLines,
    // whose ternary this was copy-pasted from.
    runAVM.mockResolvedValue(
      avmResult({ epcRating: 'A', epcAdjustment: 0.01 }),
    );
    const offer = await generateInstantOffer(baseInput);

    expect(offer.reasoning).toContain('EPC rating A (+1.0%)');
  });

  it('regression: an F-rated EPC reads as a penalty, not an uplift', async () => {
    runAVM.mockResolvedValue(
      avmResult({ epcRating: 'F', epcAdjustment: -0.02 }),
    );
    const offer = await generateInstantOffer(baseInput);

    expect(offer.reasoning).toContain('EPC rating F (-2.0%)');
  });

  it('a neutral band reads as +0.0%, not -0.0%', async () => {
    const offer = await generateInstantOffer(baseInput);
    expect(offer.reasoning).toContain('EPC rating C (+0.0%)');
  });

  it('discount lines keep their own (opposite) sign convention', async () => {
    runAVM.mockResolvedValue(
      avmResult({
        discountLines: [{ label: 'Flood risk (Zone 3a)', fraction: 0.035 }],
      }),
    );
    const offer = await generateInstantOffer(baseInput);

    // A positive discount fraction takes money OFF, so it prints with a minus.
    expect(offer.reasoning).toContain('Flood risk (Zone 3a): -3.5%');
  });
});

/**
 * Evidence gate (evidence.ts)
 *
 * The AVM refuses to put a number on a property it has no sold evidence for.
 * Before Sep 2026 a valuation with zero comparables silently fell back to
 * an area average — and when the Land Registry feed was down, that average
 * was a hash-generated placeholder. The number looked real, drove an offer,
 * and told the founder a £750k semi was worth £345k.
 *
 * Founder rule: with no comps from any source, return "no valuation" and
 * block the offer, instead of a number. This error is how the engine says
 * so. Call sites catch it with {@link isInsufficientEvidence} and record a
 * no-valuation state; anything else thrown by runAVM is a real failure.
 */

export type NoEvidenceReason =
  /** Every source answered and none had a same-type sale to offer. */
  | 'no_sales'
  /** The Land Registry feeds themselves were unreachable — try again later. */
  | 'sources_unavailable';

export class InsufficientEvidenceError extends Error {
  override readonly name = 'InsufficientEvidenceError';
  readonly postcode: string;
  readonly propertyType: string;
  readonly reason: NoEvidenceReason;
  /** The comp sources consulted, for the audit trail. */
  readonly tried: string[];

  constructor(args: {
    postcode: string;
    propertyType: string;
    reason: NoEvidenceReason;
    tried: string[];
  }) {
    const why =
      args.reason === 'sources_unavailable'
        ? 'the Land Registry feeds were unreachable'
        : 'no same-type sold comparables were found';
    super(
      `No valuation for a ${args.propertyType} at ${args.postcode}: ${why} (tried ${args.tried.join(', ')}).`
    );
    this.postcode = args.postcode;
    this.propertyType = args.propertyType;
    this.reason = args.reason;
    this.tried = args.tried;
  }
}

/** instanceof plus a name check, so a copy bundled twice still matches. */
export function isInsufficientEvidence(
  err: unknown
): err is InsufficientEvidenceError {
  return (
    err instanceof InsufficientEvidenceError ||
    (err instanceof Error && err.name === 'InsufficientEvidenceError')
  );
}

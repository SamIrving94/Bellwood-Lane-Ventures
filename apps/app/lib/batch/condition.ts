/**
 * Condition-adjusted, conservative market value.
 *
 * The AVM returns a market value assuming broadly average/sound condition.
 * The founder's spreadsheet grades each property (Excellent → Poor), so we
 * apply a haircut to reflect refurbishment cost / saleability, then a small
 * blanket prudence haircut on top — the founder asked for conservative
 * estimates.
 *
 * Factors are deliberately cautious and centralised here so they can become
 * founder-tunable (like the offer policy) later.
 */

/** Multiplier applied to the AVM point estimate, by condition grade. */
export const CONDITION_FACTORS: Record<string, number> = {
  excellent: 1.0,
  good: 0.98,
  average: 0.93,
  poor: 0.85,
};

/** Used when the Condition cell is blank/unrecognised — leans cautious. */
export const UNKNOWN_CONDITION_FACTOR = 0.92;

/** Blanket prudence haircut applied on top of the condition factor. */
export const PRUDENCE_FACTOR = 0.97;

export function conditionFactor(condition?: string | null): number {
  if (!condition) return UNKNOWN_CONDITION_FACTOR;
  const key = condition.trim().toLowerCase();
  return CONDITION_FACTORS[key] ?? UNKNOWN_CONDITION_FACTOR;
}

/**
 * Conservative, condition-adjusted estimated market value (in the same unit
 * as `avmPointEstimate` — pounds in, pounds out).
 */
export function conservativeMarketValue(
  avmPointEstimate: number,
  condition?: string | null,
): number {
  return Math.round(avmPointEstimate * PRUDENCE_FACTOR * conditionFactor(condition));
}

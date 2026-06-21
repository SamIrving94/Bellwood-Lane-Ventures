/**
 * Map the free-text "Property Type" column from a founder's spreadsheet onto
 * the four AVM property types the valuation engine understands.
 *
 * The AVM (HMLR comparable analysis) only distinguishes detached /
 * semi-detached / terraced / flat — that's the grain HM Land Registry records
 * sales at. Everything else collapses into the nearest of those four.
 */

export type AvmPropertyType = 'detached' | 'semi-detached' | 'terraced' | 'flat';

/** Ordered rules: first substring that matches wins. */
const RULES: Array<{ test: RegExp; type: AvmPropertyType }> = [
  // Flats first — "apartment", "maisonette", "flat" are unambiguous
  { test: /apartment|flat|maisonette/i, type: 'flat' },
  // Semi-detached before detached (so "semi-detached" doesn't match detached)
  { test: /semi[-\s]?detached|semi/i, type: 'semi-detached' },
  { test: /detached|bungalow/i, type: 'detached' },
  // Terraced family — terrace, townhouse, end-of-terrace
  { test: /terrace|town\s?house|end[-\s]?of[-\s]?terrace/i, type: 'terraced' },
];

/**
 * Returns the mapped AVM type, or null if the raw value is empty/unknown.
 * Bungalows map to detached (most are); townhouses map to terraced.
 */
export function mapPropertyType(raw?: string | null): AvmPropertyType | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  for (const rule of RULES) {
    if (rule.test.test(value)) return rule.type;
  }
  return null;
}

/**
 * PropertyData property-type value mapping.
 *
 * PropertyData's accepted property-type values are `_house`-suffixed
 * (flat, terraced_house, semi-detached_house, detached_house, house), NOT the
 * bare values (detached, semi-detached, terraced) we use internally. Sending a
 * bare value is rejected — e.g. /valuation-sale returns 400 "Missing input:
 * property_type", /sold-prices returns 422 "Invalid filter: type". Map at the
 * boundary. See docs/LEARNINGS.md (2026-07-17).
 *
 * Pure module: no `server-only`, no env — safe to unit-test in isolation.
 */
export type PropertyDataType =
  | 'flat'
  | 'terraced_house'
  | 'semi-detached_house'
  | 'detached_house'
  | 'house';

export function toPropertyDataType(
  t: string | null | undefined,
): PropertyDataType | undefined {
  if (!t) return undefined;
  const s = t.toLowerCase().trim();
  if (s === 'flat' || s === 'apartment' || s === 'studio') return 'flat';
  // "semi-detached" contains "detached", so semi MUST be checked first.
  if (s.includes('semi')) return 'semi-detached_house';
  if (s.includes('terrace')) return 'terraced_house';
  if (s.includes('detached')) return 'detached_house';
  if (s.includes('bungalow')) return 'detached_house';
  // Already-correct API values pass straight through.
  if (
    s === 'terraced_house' ||
    s === 'semi-detached_house' ||
    s === 'detached_house' ||
    s === 'house'
  ) {
    return s as PropertyDataType;
  }
  return 'house'; // safe generic rather than an invalid filter value
}

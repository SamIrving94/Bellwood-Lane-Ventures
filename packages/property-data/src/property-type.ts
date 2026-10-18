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
  t: string | null | undefined
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

// ---------------------------------------------------------------------------
// Canonical property type (ours) + the AVM's view of it
// ---------------------------------------------------------------------------

export type CanonicalPropertyType =
  | 'detached'
  | 'semi-detached'
  | 'terraced'
  | 'flat'
  | 'bungalow';

/**
 * Read a free-text type (listing, EPC, a deal column) as one of ours, or
 * null when it doesn't say. Null matters: "probate", "unknown" and a bare
 * "house" are not property types, and every caller used to turn them into
 * "terraced" without saying so.
 */
export function canonicalPropertyType(
  raw: string | null | undefined
): CanonicalPropertyType | null {
  if (typeof raw !== 'string') return null;
  const s = raw.toLowerCase();
  // "semi-detached" contains "detached", so semi MUST be checked first.
  if (s.includes('semi')) return 'semi-detached';
  if (s.includes('bungalow')) return 'bungalow';
  if (s.includes('detached')) return 'detached';
  if (s.includes('terrace')) return 'terraced';
  if (/\b(flats?|apartments?|studios?|maisonettes?)\b/.test(s)) return 'flat';
  return null;
}

export type AvmPropertyType =
  | 'detached'
  | 'semi-detached'
  | 'terraced'
  | 'flat';

/**
 * The type the AVM is run with. The AVM needs one, so an unknown type is
 * valued as terraced (the long-standing default) — but `assumed` says so,
 * and every caller must surface it rather than present the offer as if the
 * type were known. Bungalows value as detached (no bungalow comps band).
 */
export function avmPropertyTypeFor(raw: string | null | undefined): {
  propertyType: AvmPropertyType;
  assumed: boolean;
} {
  const t = canonicalPropertyType(raw);
  if (t === null) return { propertyType: 'terraced', assumed: true };
  return { propertyType: t === 'bungalow' ? 'detached' : t, assumed: false };
}

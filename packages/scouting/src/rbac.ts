/**
 * GDPR Field Sanitiser (rbac.ts)
 *
 * Strips protected / special-category personal data from raw lead payloads
 * before they are stored, scored, or passed to downstream agents.
 *
 * Regulated under UK GDPR Article 9 (special categories) and ICO guidance
 * on probate / estate data handling.
 *
 * Protected fields are matched by exact key name OR by the NHS* prefix pattern.
 */

// ---------------------------------------------------------------------------
// Protected field registry
// ---------------------------------------------------------------------------

/**
 * Exact field names that must never be stored or transmitted.
 * Covers UK GDPR Article 9 special categories + probate-specific sensitivities.
 */
const BLOCKED_FIELDS = new Set([
  // Death & probate
  'causeOfDeath',
  'causeOfDeathDetails',
  'deceasedMedicalHistory',

  // Health & medical
  'medicalCondition',
  'medicalHistory',
  'diagnosis',
  'prescription',
  'mentalCapacity',
  'mentalHealthStatus',
  'disabilityStatus',

  // Financial distress
  'debtAmount',
  'debtDetails',
  'bankruptcyStatus',
  'creditScore',
  'creditHistory',
  'ccjCount',

  // Biometric & genetic
  'biometricData',
  'geneticData',
  'faceRecognitionId',

  // Identity & protected characteristics
  'sexualOrientation',
  'genderIdentity',
  'politicalViews',
  'politicalParty',
  'religiousBeliefs',
  'tradeUnionMembership',
  'ethnicOrigin',
  'immigrationStatus',

  // Criminal
  'criminalRecord',
  'convictions',
  'offenceHistory',
]);

/** Prefix patterns — any key starting with these strings is blocked. */
const BLOCKED_PREFIXES = ['nhs', 'NHS'];

// ---------------------------------------------------------------------------
// Core sanitiser
// ---------------------------------------------------------------------------

/**
 * Returns true when a field key should be stripped from the payload.
 */
function isProtectedField(key: string): boolean {
  if (BLOCKED_FIELDS.has(key)) return true;
  for (const prefix of BLOCKED_PREFIXES) {
    if (key.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Deep-sanitise a raw payload object, removing all protected fields at every
 * nesting level.  Returns a new object; the original is not mutated.
 *
 * @param payload - Any JSON-serialisable object from a lead source.
 * @returns Sanitised copy with all GDPR-protected fields removed.
 */
export function sanitisePayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (isProtectedField(key)) continue;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitisePayload(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === 'object' && !Array.isArray(item)
          ? sanitisePayload(item as Record<string, unknown>)
          : item
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Audit helper — returns the list of protected field keys that were present
 * in the original payload (for logging / compliance trails).
 */
export function auditProtectedFields(
  payload: Record<string, unknown>
): string[] {
  const found: string[] = [];

  function walk(obj: Record<string, unknown>, path: string): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = path ? `${path}.${key}` : key;
      if (isProtectedField(key)) {
        found.push(fullKey);
      } else if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        walk(value as Record<string, unknown>, fullKey);
      }
    }
  }

  walk(payload, '');
  return found;
}

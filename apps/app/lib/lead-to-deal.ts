import { canonicalPropertyType } from '@repo/property-data/src/property-type';

/**
 * The property facts a deal inherits from the scout lead it came from.
 *
 * Conversion used to write `lead.leadType` ("probate", "chain_break" …) into
 * the deal's propertyType column, so every converted deal was valued as a
 * terraced house with no bedroom count. The type lives in the listing data
 * (`rawPayload.propertyData`); when it isn't there the deal says "unknown"
 * rather than borrowing a word that isn't a property type.
 */
export function propertyFromLead(rawPayload: unknown): {
  propertyType: string;
  bedrooms: number | null;
} {
  const pd = (rawPayload as { propertyData?: Record<string, unknown> } | null)
    ?.propertyData;
  const rawType = typeof pd?.propertyType === 'string' ? pd.propertyType : null;
  const beds = pd?.bedrooms;
  return {
    propertyType: canonicalPropertyType(rawType) ?? 'unknown',
    bedrooms:
      typeof beds === 'number' && Number.isInteger(beds) && beds > 0
        ? beds
        : null,
  };
}

import { addressKey } from '@repo/property-data/src/uprn';

/**
 * What the UPRN step does with one lead, decided without touching the
 * network or the database so it can be tested (the loop that acts on it is
 * in ./uprn.ts).
 */

/** What /listing-address said about a lead's Rightmove listing. */
export type ListingLookup = {
  checkedAt: string;
  resolved: boolean;
  uprn?: string;
  address?: string;
  postcode?: string;
};

export type LeadPlan =
  /** Nothing new to try: leave the lead as it is, no write. */
  | { kind: 'skip' }
  /** Street-only Rightmove listing not yet asked about: ask once. */
  | { kind: 'lookup'; url: string }
  /** Run the strict matcher on this address. */
  | { kind: 'match'; address: string; postcode: string };

/**
 * PropertyData's sourced-property ids carry the portal: "R169827281" is
 * Rightmove listing 169827281, "Z…" is Zoopla. Only Rightmove listings can be
 * resolved to an address, so anything else is null.
 */
export function rightmoveListingUrl(sourcedId: unknown): string | null {
  const m = /^R(\d+)$/.exec(typeof sourcedId === 'string' ? sourcedId : '');
  return m ? `https://www.rightmove.co.uk/properties/${m[1]}` : null;
}

export function planLead(
  lead: {
    address: string;
    postcode: string;
    uprnCheckedAt: Date | null;
    propertyData?: Record<string, unknown>;
  },
  canLookUp: boolean
): LeadPlan {
  const pd = lead.propertyData;
  const lookup = pd?.listingLookup as ListingLookup | undefined;

  // A resolved listing gives the full address and, for leads that only carry
  // an outcode ("SW17"), the full postcode the matcher needs.
  if (lookup?.resolved && lookup.address && lookup.postcode) {
    return {
      kind: 'match',
      address: lookup.address,
      postcode: lookup.postcode,
    };
  }
  // The listing's house-numbered address beats the display address, which
  // is often just "Acacia Road, London".
  const address =
    typeof pd?.preciseAddress === 'string' ? pd.preciseAddress : lead.address;
  if (addressKey(address).designator) {
    return { kind: 'match', address, postcode: lead.postcode };
  }

  // Street-only from here.
  const url = rightmoveListingUrl(pd?.id);
  if (!lookup && url && canLookUp) return { kind: 'lookup', url };
  // Never checked: stamp it street-only so a person can see why. Already
  // stamped and nothing new to try: leave it.
  return lead.uprnCheckedAt
    ? { kind: 'skip' }
    : { kind: 'match', address, postcode: lead.postcode };
}

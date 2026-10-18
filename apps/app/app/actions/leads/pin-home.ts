'use server';

import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import { searchDomesticEpc } from '@repo/property-data/src/epc';
import { getPostcodeUprnsResult } from '@repo/property-data/src/propertydata';
import { revalidatePath } from 'next/cache';

/**
 * "Pin the home" — a person picks which home a street-only lead is.
 *
 * About 60% of scouted listings never state a house number ("Ecclesall
 * Road, Sheffield S11"), so no matcher can find their UPRN, and on Zoopla
 * nothing can look it up. For a lead we are actually pursuing, the founder
 * looks at the listing and taps the right home from the postcode's list:
 * a person decides, nothing is guessed. Every street-only lead carries a
 * full postcode (checked Oct 2026: 51 of 51 live ones), which is what the
 * list is built from.
 *
 * The list is only fetched on request (PropertyData /uprns, 6-9 credits per
 * postcode, cached 60 days), never on page view.
 */

export type PinCandidate = {
  uprn: string;
  address: string;
  /** Also on the EPC register under the same UPRN: a second source agrees it exists. */
  onEpc: boolean;
};

export type PinCandidates =
  | {
      ok: true;
      postcode: string;
      homes: PinCandidate[];
      /** The home PropertyData resolved the Rightmove listing to, if any. */
      suggestedUprn: string | null;
    }
  | { ok: false; error: string };

const FULL_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

async function homesFor(postcode: string) {
  const [pd, epc] = await Promise.all([
    getPostcodeUprnsResult(postcode),
    process.env.EPC_API_TOKEN
      ? searchDomesticEpc(postcode).catch(() => [])
      : Promise.resolve([]),
  ]);
  return { pd, epcUprns: new Set(epc.map((e) => e.uprn).filter(Boolean)) };
}

export async function getPinCandidates(leadId: string): Promise<PinCandidates> {
  await requireFounder();
  const lead = await database.scoutLead.findUnique({
    where: { id: leadId },
    select: { postcode: true, rawPayload: true },
  });
  if (!lead) return { ok: false, error: 'Lead not found.' };
  const postcode = lead.postcode.toUpperCase().trim();
  if (!FULL_POSTCODE.test(postcode)) {
    return {
      ok: false,
      error: `"${postcode}" isn't a full postcode, so there's no list of homes to pick from. Open the listing to find the address.`,
    };
  }

  const { pd, epcUprns } = await homesFor(postcode);
  if (pd.outcome === 'failed') {
    return {
      ok: false,
      error: `Couldn't load the homes in ${postcode} (${pd.error}). Try again in a minute.`,
    };
  }
  const homes = (pd.outcome === 'ok' ? pd.value : [])
    .map((h) => ({ ...h, onEpc: epcUprns.has(h.uprn) }))
    .sort((a, b) =>
      a.address.localeCompare(b.address, 'en', { numeric: true })
    );

  const listing = (
    (lead.rawPayload as Record<string, unknown> | null)?.propertyData as
      | Record<string, unknown>
      | undefined
  )?.listingLookup as { resolved?: boolean; uprn?: string } | undefined;

  return {
    ok: true,
    postcode,
    homes,
    suggestedUprn: listing?.resolved ? (listing.uprn ?? null) : null,
  };
}

export async function pinLeadHome(
  leadId: string,
  uprn: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await requireFounder();
  const lead = await database.scoutLead.findUnique({
    where: { id: leadId },
    select: {
      postcode: true,
      rawPayload: true,
      convertedDealId: true,
      uprn: true,
    },
  });
  if (!lead) return { ok: false, error: 'Lead not found.' };
  if (lead.uprn) {
    return { ok: false, error: 'This lead already has a home pinned.' };
  }

  // Only a UPRN from this postcode's own list can be pinned: a typo or a
  // stale page must fail here, not become a stored identifier (the SW3 rule).
  const { pd, epcUprns } = await homesFor(lead.postcode.toUpperCase().trim());
  if (pd.outcome !== 'ok') {
    return { ok: false, error: "Couldn't re-check the list. Try again." };
  }
  const home = pd.value.find((h) => h.uprn === uprn);
  if (!home) {
    return {
      ok: false,
      error: `That home isn't in ${lead.postcode}'s list any more. Reload and pick again.`,
    };
  }

  const raw = (lead.rawPayload ?? {}) as Record<string, unknown>;
  const propertyData = (raw.propertyData ?? {}) as Record<string, unknown>;
  const data = {
    uprn: home.uprn,
    // A person's pick, not a match: kept distinct from high/medium so the
    // matcher's hit rate and the backtest never count it as automatic.
    uprnConfidence: 'pinned',
    uprnSources: epcUprns.has(home.uprn) ? 'founder,epc' : 'founder',
    uprnReason: null,
    uprnCheckedAt: new Date(),
  };
  await database.scoutLead.update({
    where: { id: leadId },
    data: {
      ...data,
      rawPayload: {
        ...raw,
        propertyData: {
          ...propertyData,
          pinnedHome: {
            address: home.address,
            by: userId,
            at: new Date().toISOString(),
          },
        },
      },
    },
  });
  // A converted lead's deal is the same property, unless one was set by hand.
  if (lead.convertedDealId) {
    await database.deal.updateMany({
      where: { id: lead.convertedDealId, uprn: null },
      data,
    });
  }

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

import { type Prisma, database } from '@repo/database';
import { getListingAddressResult, resolveUprn } from '@repo/property-data';
import { type ListingLookup, planLead } from './uprn-plan';

/**
 * Stamp a UPRN on live scout leads that don't have one yet.
 *
 * Bounded per run: each lead is two lookups, an EPC search (free) and a
 * PropertyData /uprns postcode list (6-9 credits, cached 60 days per
 * postcode; a street-only lead is refused before either call, so it costs
 * nothing). A lead that came back unresolved is retried after
 * RETRY_MS, since new EPC certificates and addresses do land; leads whose
 * address or postcode can't be matched at all are not, because nothing
 * upstream will change that. When neither source could answer, the lead is
 * NOT stamped — an outage is not a no-match, so it tries again next run.
 *
 * Street-only leads ("Ecclesall Road, Sheffield S11", 109 of 196 in Oct
 * 2026) get one more chance first: if the listing is on Rightmove,
 * PropertyData's /listing-address may know which home it is. This runs
 * straight after every scout run (scouting triggers lead-appraise, which
 * calls this), while the listing is still live; a listing that has come off
 * the market usually can't be resolved. The answer is recorded on the lead
 * (`propertyData.listingLookup`) so it is bought once, and the address it
 * gives still has to pass the strict matcher before it becomes a UPRN.
 */

const MAX_PER_RUN = 25;
/** 10 credits each when they resolve (free when not): ≤250 credits a run. */
const MAX_LISTING_LOOKUPS_PER_RUN = 25;
const RETRY_MS = 30 * 24 * 60 * 60 * 1000;
const RETRYABLE_REASONS = ['no_match', 'ambiguous', 'sources_disagree'];

export async function resolveLeadUprns(): Promise<{
  checked: number;
  resolved: number;
  listingLookups: number;
}> {
  const leads = await database.scoutLead.findMany({
    where: {
      status: { in: ['new', 'shortlisted', 'watching', 'converted'] },
      uprn: null,
      OR: [
        { uprnCheckedAt: null },
        {
          uprnReason: { in: RETRYABLE_REASONS },
          uprnCheckedAt: { lt: new Date(Date.now() - RETRY_MS) },
        },
        // Street-only leads that may not have had their listing looked up.
        // Those that have are skipped below without a write, so the scan is
        // wider than the per-run cap.
        { uprnReason: 'unparseable_address' },
      ],
    },
    orderBy: { leadScore: 'desc' },
    take: MAX_PER_RUN * 8,
    select: {
      id: true,
      address: true,
      postcode: true,
      rawPayload: true,
      convertedDealId: true,
      uprnCheckedAt: true,
    },
  });

  let checked = 0;
  let resolved = 0;
  let listingLookups = 0;
  for (const lead of leads) {
    if (checked >= MAX_PER_RUN) break;
    const raw = (lead.rawPayload ?? {}) as Record<string, unknown>;
    let pd = raw.propertyData as Record<string, unknown> | undefined;
    let plan = planLead(
      { ...lead, propertyData: pd },
      listingLookups < MAX_LISTING_LOOKUPS_PER_RUN
    );
    if (plan.kind === 'lookup') {
      listingLookups++;
      const res = await getListingAddressResult(plan.url);
      // A failed call is not an answer: leave it for the next run.
      if (res.outcome === 'failed') continue;
      const lookup: ListingLookup = {
        checkedAt: new Date().toISOString(),
        resolved: res.outcome === 'ok',
        ...(res.outcome === 'ok' ? res.value : {}),
      };
      pd = { ...pd, listingLookup: lookup };
      await database.scoutLead.update({
        where: { id: lead.id },
        data: {
          rawPayload: { ...raw, propertyData: pd } as Prisma.InputJsonValue,
        },
      });
      plan = planLead({ ...lead, propertyData: pd }, false);
    }
    if (plan.kind !== 'match') continue;
    const { address, postcode } = plan;

    checked++;
    const r = await resolveUprn({ address, postcode });
    if (r.reason === 'sources_unavailable') continue;

    const data = {
      uprn: r.uprn,
      uprnConfidence: r.confidence,
      uprnSources: r.sources.length ? r.sources.join(',') : null,
      uprnReason: r.reason,
      uprnCheckedAt: new Date(),
    };
    await database.scoutLead.update({ where: { id: lead.id }, data });
    // A converted lead's deal is the same property; give it the same ID
    // unless someone already set one by hand.
    if (r.uprn && lead.convertedDealId) {
      await database.deal.updateMany({
        where: { id: lead.convertedDealId, uprn: null },
        data,
      });
    }
    if (r.uprn) resolved++;
  }
  return { checked, resolved, listingLookups };
}

import { database } from '@repo/database';
import { resolveUprn } from '@repo/property-data';

/**
 * Stamp a UPRN on live scout leads that don't have one yet.
 *
 * Bounded per run: each lead is two free-tier lookups (EPC search + OS
 * Places postcode). A lead that came back unresolved is retried after
 * RETRY_MS, since new EPC certificates and addresses do land; leads whose
 * address or postcode can't be matched at all are not, because nothing
 * upstream will change that. When neither source could answer, the lead is
 * NOT stamped — an outage is not a no-match, so it tries again next run.
 */

const MAX_PER_RUN = 25;
const RETRY_MS = 30 * 24 * 60 * 60 * 1000;
const RETRYABLE_REASONS = ['no_match', 'ambiguous', 'sources_disagree'];

export async function resolveLeadUprns(): Promise<{
  checked: number;
  resolved: number;
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
      ],
    },
    orderBy: { leadScore: 'desc' },
    take: MAX_PER_RUN,
    select: {
      id: true,
      address: true,
      postcode: true,
      rawPayload: true,
      convertedDealId: true,
    },
  });

  let resolved = 0;
  for (const lead of leads) {
    // The listing's house-numbered address beats the display address, which
    // is often just "Acacia Road, London".
    const pd = (lead.rawPayload as Record<string, unknown> | null)
      ?.propertyData as Record<string, unknown> | undefined;
    const address =
      typeof pd?.preciseAddress === 'string' ? pd.preciseAddress : lead.address;

    const r = await resolveUprn({ address, postcode: lead.postcode });
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
  return { checked: leads.length, resolved };
}

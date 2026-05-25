import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
import { LeadsTable } from './leads-table';

export const metadata: Metadata = {
  title: 'Leads — Bellwood Ventures',
  description: 'Scouted leads with scoring and verdicts',
};

const LeadsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) => {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const { filter } = await searchParams;

  const leads = await database.scoutLead.findMany({
    orderBy: [{ leadScore: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  });

  // Fetch all feedback for these leads in one query
  const feedbackRecords = await database.founderFeedback.findMany({
    where: {
      targetType: 'scout_lead',
      targetId: { in: leads.map((l) => l.id) },
    },
    select: { targetId: true, rating: true },
  });

  const feedbackByLeadId = Object.fromEntries(
    feedbackRecords.map((f) => [f.targetId, f.rating])
  );

  const unratedCount = leads.filter(
    (l) => l.status === 'new' && !feedbackByLeadId[l.id]
  ).length;

  return (
    <>
      <Header pages={[]} page="Leads" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <LeadsTable
          leads={leads.map((l) => {
            const raw = (l.rawPayload ?? {}) as Record<string, unknown>;
            const pd = raw.propertyData as Record<string, unknown> | undefined;
            const planning = raw.planning as Record<string, unknown> | undefined;
            const hmo = raw.hmo as Record<string, unknown> | undefined;
            return {
              id: l.id,
              address: l.address,
              postcode: l.postcode,
              leadType: l.leadType,
              leadScore: l.leadScore,
              verdict: l.verdict,
              estimatedEquityPence: l.estimatedEquityPence,
              marketTrend: l.marketTrend,
              status: l.status,
              source: l.source,
              existingRating: feedbackByLeadId[l.id] ?? 0,
              // Rich PropertyData fields (when source is propertydata_*)
              listingType:
                (pd?.listingType as string | undefined) ?? null,
              listingUrl: (pd?.listingUrl as string | undefined) ?? null,
              imageUrl: (pd?.imageUrl as string | undefined) ?? null,
              summary: (pd?.summary as string | undefined) ?? null,
              pricePence: (pd?.pricePence as number | undefined) ?? null,
              originalPricePence:
                (pd?.originalPricePence as number | undefined) ?? null,
              discountPercent:
                (pd?.discountPercent as number | undefined) ?? null,
              bedrooms: (pd?.bedrooms as number | undefined) ?? null,
              propertyType:
                (pd?.propertyType as string | undefined) ?? null,
              daysOnMarket:
                (pd?.daysOnMarket as number | undefined) ?? null,
              // Planning + HMO labels
              planningDecision:
                (planning?.decision as string | undefined) ?? null,
              planningRating:
                (planning?.decisionRating as string | undefined) ?? null,
              planningProposal:
                (planning?.proposal as string | undefined) ?? null,
              planningUrl: (planning?.url as string | undefined) ?? null,
              hmoExpiringSoon:
                (hmo?.licenceExpiringSoon as boolean | undefined) ?? false,
              hmoLicenceExpiry:
                (hmo?.licenceExpiry as string | undefined) ?? null,
            };
          })}
          unratedCount={unratedCount}
          initialFilter={filter ?? 'all'}
        />
      </div>
    </>
  );
};

export default LeadsPage;

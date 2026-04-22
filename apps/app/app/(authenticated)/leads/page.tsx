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
          leads={leads.map((l) => ({
            id: l.id,
            address: l.address,
            postcode: l.postcode,
            leadType: l.leadType,
            leadScore: l.leadScore,
            verdict: l.verdict,
            estimatedEquityPence: l.estimatedEquityPence,
            marketTrend: l.marketTrend,
            status: l.status,
            existingRating: feedbackByLeadId[l.id] ?? 0,
          }))}
          unratedCount={unratedCount}
          initialFilter={filter ?? 'all'}
        />
      </div>
    </>
  );
};

export default LeadsPage;

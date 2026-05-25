import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
import { presentLead } from './lead-payload';
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

  const views = leads.map((l) =>
    presentLead({
      id: l.id,
      address: l.address,
      postcode: l.postcode,
      leadType: l.leadType,
      leadScore: l.leadScore,
      verdict: l.verdict,
      status: l.status,
      source: l.source,
      sourceTrail: l.sourceTrail,
      marketTrend: l.marketTrend,
      estimatedEquityPence: l.estimatedEquityPence,
      contactName: l.contactName,
      contactPhone: l.contactPhone,
      contactEmail: l.contactEmail,
      rawPayload: l.rawPayload,
      existingRating: feedbackByLeadId[l.id] ?? 0,
    })
  );

  return (
    <>
      <Header pages={[]} page="Leads" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <LeadsTable
          leads={views}
          unratedCount={unratedCount}
          initialFilter={filter ?? 'all'}
        />
      </div>
    </>
  );
};

export default LeadsPage;

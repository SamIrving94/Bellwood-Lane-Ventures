import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { subDays } from 'date-fns';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
import { InsightsView } from './insights-view';

export const metadata: Metadata = {
  title: 'Insights · Microjournal',
};

const InsightsPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const since = subDays(new Date(), 30);

  const entries = await database.journalEntry.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { mood: true, source: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <>
      <Header pages={[]} page="Insights" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <InsightsView entries={entries} />
      </div>
    </>
  );
};

export default InsightsPage;

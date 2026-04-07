import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
import { EntriesWithSearch } from './entries-with-search';

export const metadata: Metadata = {
  title: 'History · Microjournal',
};

const EntriesPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const [entries, totalCount] = await Promise.all([
    database.journalEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    database.journalEntry.count({ where: { userId } }),
  ]);

  return (
    <>
      <Header pages={[]} page="History" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <EntriesWithSearch initialEntries={entries} totalCount={totalCount} />
      </div>
    </>
  );
};

export default EntriesPage;

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
import { CalendarView } from './calendar-view';

export const metadata: Metadata = {
  title: 'Calendar · Microjournal',
};

const CalendarPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Load current month ± 1 month buffer for navigation
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  const entries = await database.journalEntry.findMany({
    where: {
      userId,
      createdAt: { gte: start, lte: end },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <Header pages={[]} page="Calendar" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <CalendarView entries={entries} />
      </div>
    </>
  );
};

export default CalendarPage;

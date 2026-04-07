import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { format, subDays, subYears, startOfDay, endOfDay } from 'date-fns';
import { redirect } from 'next/navigation';
import { calculateStreak } from '@repo/whatsapp/commands';
import { DashboardStats } from './components/dashboard-stats';
import { EntryComposer } from './components/entry-composer';
import { EntryList } from './components/entry-list';
import { Header } from './components/header';
import { OnboardingWizard } from './components/onboarding-wizard';

export const metadata: Metadata = {
  title: 'Microjournal',
  description: 'Your daily journaling companion.',
};

const App = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);

  // Build "this day" queries for up to 5 years back
  const yearDates = Array.from({ length: 5 }, (_, i) => subYears(now, i + 1));
  const thisDayQueries = yearDates.map((date) =>
    database.journalEntry.findMany({
      where: {
        userId,
        createdAt: { gte: startOfDay(date), lte: endOfDay(date) },
      },
      orderBy: { createdAt: 'desc' },
    })
  );

  // Run all queries in parallel
  const [entries, streakDates, weekEntries, phoneMapping, ...thisDayResults] =
    await Promise.all([
      // Recent entries for the list
      database.journalEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // All entry dates for streak calculation (last 365 days)
      database.journalEntry.findMany({
        where: { userId, createdAt: { gte: subDays(now, 365) } },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      // Entries from the last 7 days for mood summary
      database.journalEntry.findMany({
        where: { userId, createdAt: { gte: sevenDaysAgo } },
        select: { mood: true },
      }),
      // Check if phone is linked (for onboarding)
      database.phoneMapping.findUnique({
        where: { userId },
        select: { id: true },
      }),
      // This day in previous years (1-5 years ago)
      ...thisDayQueries,
    ]);

  // Build "this day" grouped by year
  const thisDayByYear = thisDayResults
    .map((entries, i) => ({
      yearsAgo: i + 1,
      entries,
    }))
    .filter((g) => g.entries.length > 0);

  // Calculate streak
  const streak = calculateStreak(streakDates.map((e) => e.createdAt));

  // Count moods from this week
  const moodCounts: Record<string, number> = {};
  for (const e of weekEntries) {
    if (e.mood) {
      moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
    }
  }

  const today = format(now, 'EEEE, MMMM d, yyyy');
  const isNewUser = entries.length === 0 && !phoneMapping;

  return (
    <>
      <Header pages={[]} page={today} />
      {isNewUser && <OnboardingWizard />}
      <div className="flex flex-1 flex-col gap-6 p-6">
        <DashboardStats
          streak={streak}
          moodCounts={moodCounts}
          thisDayByYear={thisDayByYear}
        />

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Today's entry
          </h2>
          <EntryComposer />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Recent entries
          </h2>
          <EntryList initialEntries={entries} />
        </section>
      </div>
    </>
  );
};

export default App;

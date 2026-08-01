import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Header } from '../components/header';
import { MarketingTabs } from './components/marketing-tabs';
import { MARKETING_ACTION_TYPES } from './lib/marketing-types';

export const dynamic = 'force-dynamic';

const MarketingLayout = async ({ children }: { children: ReactNode }) => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Counts for tab badges
  const [queueCount, publishedCount] = await Promise.all([
    database.founderAction.count({
      where: {
        type: { in: MARKETING_ACTION_TYPES },
        status: { in: ['pending', 'in_progress'] },
      },
    }),
    database.founderAction.count({
      where: {
        type: { in: MARKETING_ACTION_TYPES },
        status: 'completed',
      },
    }),
  ]);

  return (
    <>
      <Header pages={[]} page="Marketing" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <MarketingTabs queueCount={queueCount} publishedCount={publishedCount} />
        {children}
      </div>
    </>
  );
};

export default MarketingLayout;

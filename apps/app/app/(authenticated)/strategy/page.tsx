import { auth } from '@repo/auth/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
import { getStrategyDoc } from './actions';
import { StrategyDoc } from './strategy-doc';

export const metadata: Metadata = {
  title: 'Strategy — Bellwoods Lane',
  description: 'The Bellwoods Lane decision stack — vision, mission, bets, OKRs.',
};

export const dynamic = 'force-dynamic';

const StrategyPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const doc = await getStrategyDoc();

  return (
    <>
      <Header pages={[]} page="Strategy" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div>
          <h1 className="text-xl font-bold">Strategy — Decision Stack</h1>
          <p className="text-sm text-muted-foreground">
            Our shared, living plan. Both founders can edit it here — changes
            save to one live copy.
          </p>
        </div>
        <StrategyDoc
          initialMarkdown={doc.markdown}
          updatedBy={doc.updatedBy}
          updatedAt={doc.updatedAt}
        />
      </div>
    </>
  );
};

export default StrategyPage;

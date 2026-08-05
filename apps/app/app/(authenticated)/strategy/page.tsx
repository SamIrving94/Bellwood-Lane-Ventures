import { auth } from '@repo/auth/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { STRATEGY_PROPOSALS } from '../../../lib/strategy/proposals';
import { Header } from '../components/header';
import { getStrategyDoc } from './actions';
import { ProposalCard } from './proposal-card';
import { StrategyDoc } from './strategy-doc';

export const metadata: Metadata = {
  title: 'Strategy — Kept',
  description: 'The Kept decision stack — vision, mission, bets, OKRs.',
};

export const dynamic = 'force-dynamic';

const StrategyPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const doc = await getStrategyDoc();
  const proposals = STRATEGY_PROPOSALS.filter((p) => p.status === 'for_review');

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

        {proposals.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
              Proposals for review
            </h2>
            {proposals.map((p, i) => (
              <ProposalCard
                key={p.id}
                title={p.title}
                date={p.date}
                reviewer={p.reviewer}
                markdown={p.markdown}
                defaultOpen={i === 0}
              />
            ))}
          </div>
        )}

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

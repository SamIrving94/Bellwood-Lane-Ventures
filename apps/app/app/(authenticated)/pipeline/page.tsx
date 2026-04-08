import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
import { PipelineBoard } from './components/pipeline-board';

export const metadata: Metadata = {
  title: 'Pipeline — Bellwood Ventures',
  description: 'Deal pipeline kanban board',
};

const PipelinePage = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const deals = await database.deal.findMany({
    where: {
      status: {
        notIn: ['completed', 'rejected', 'withdrawn'],
      },
    },
    orderBy: { stageEnteredAt: 'asc' },
  });

  return (
    <>
      <Header pages={[]} page="Pipeline" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <PipelineBoard initialDeals={deals} />
      </div>
    </>
  );
};

export default PipelinePage;

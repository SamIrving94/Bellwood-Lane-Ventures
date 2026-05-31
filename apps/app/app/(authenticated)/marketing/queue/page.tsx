import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MarketingCard } from '../components/marketing-card';
import {
  MARKETING_ACTION_TYPES,
  PRIORITY_ORDER,
} from '../lib/marketing-types';

export const metadata: Metadata = {
  title: 'Queue — Marketing — Bellwoods Lane',
  description: 'Drafts awaiting founder approval.',
};

export const dynamic = 'force-dynamic';

const QueuePage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const actions = await database.founderAction.findMany({
    where: {
      type: { in: MARKETING_ACTION_TYPES },
      status: { in: ['pending', 'in_progress'] },
    },
    // Prisma enum ordering is alphabetical (critical < high < low < medium) so
    // we pull by createdAt then sort priority in JS — same pattern as /actions.
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const sorted = [...actions].sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // Tally by priority for the summary bar
  const criticalCount = sorted.filter((a) => a.priority === 'critical').length;
  const highCount = sorted.filter((a) => a.priority === 'high').length;

  if (sorted.length === 0) {
    return (
      <div className="space-y-6">
        <SummaryBar pending={0} critical={0} high={0} />
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-lg font-medium">No drafts waiting.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Approved campaigns go to the Calendar tab. New drafts appear here
            as the marketing crons run.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SummaryBar
        pending={sorted.length}
        critical={criticalCount}
        high={highCount}
      />

      <div className="space-y-3">
        {sorted.map((action) => (
          <MarketingCard
            key={action.id}
            action={{
              id: action.id,
              type: action.type,
              priority: action.priority,
              status: action.status,
              title: action.title,
              description: action.description,
              agent: action.agent,
              dealId: action.dealId,
              metadata: action.metadata,
              createdAt: action.createdAt,
            }}
          />
        ))}
      </div>
    </div>
  );
};

function SummaryBar({
  pending,
  critical,
  high,
}: {
  pending: number;
  critical: number;
  high: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Pending</p>
        <p className="text-2xl font-bold">{pending}</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Critical</p>
        <p
          className={`text-2xl font-bold ${critical > 0 ? 'text-red-600' : ''}`}
        >
          {critical}
        </p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">High priority</p>
        <p className={`text-2xl font-bold ${high > 0 ? 'text-amber-600' : ''}`}>
          {high}
        </p>
      </div>
    </div>
  );
}

export default QueuePage;

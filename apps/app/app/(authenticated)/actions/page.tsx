import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
import { ActionCard } from './components/action-card';

export const metadata: Metadata = {
  title: 'Action Centre — Bellwood Ventures',
  description: 'Review items that need your attention',
};

const ActionsPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Fetch pending + in_progress actions, ordered by priority then recency
  const actions = await database.founderAction.findMany({
    where: {
      status: { in: ['pending', 'in_progress'] },
    },
    orderBy: [
      { priority: 'asc' },   // critical first (alphabetical: critical < high < low < medium)
      { createdAt: 'desc' },
    ],
    take: 50,
  });

  // Manual sort since Prisma enum ordering is alphabetical
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = actions.sort(
    (a, b) =>
      (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Count by priority for header
  const criticalCount = sorted.filter((a) => a.priority === 'critical').length;
  const highCount = sorted.filter((a) => a.priority === 'high').length;

  // Recent completed/dismissed (last 7 days)
  const recentResolved = await database.founderAction.count({
    where: {
      status: { in: ['completed', 'dismissed'] },
      resolvedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  return (
    <>
      <Header pages={[]} page="Action Centre" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Summary bar */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold">{sorted.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Critical</p>
            <p className={`text-2xl font-bold ${criticalCount > 0 ? 'text-red-600' : ''}`}>
              {criticalCount}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">High Priority</p>
            <p className={`text-2xl font-bold ${highCount > 0 ? 'text-amber-600' : ''}`}>
              {highCount}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Resolved (7d)</p>
            <p className="text-2xl font-bold text-emerald-600">{recentResolved}</p>
          </div>
        </div>

        {/* Action list */}
        {sorted.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <p className="text-lg font-medium">All clear</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No actions need your attention right now. The agents are working.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((action) => (
              <ActionCard key={action.id} action={action} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default ActionsPage;

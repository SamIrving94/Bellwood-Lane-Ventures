import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
import { ActionCard } from './components/action-card';
import { BulkActionsToolbar } from './components/bulk-actions-toolbar';

export const metadata: Metadata = {
  title: 'Action Centre — Bellwood Ventures',
  description: 'Review items that need your attention',
};

const ActionsPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Fetch pending + in_progress actions, ordered by priority then recency.
  // Exclude anything past its expiry so stale, time-boxed alerts drop off on
  // their own instead of adding to the pile.
  const now = new Date();
  const actions = await database.founderAction.findMany({
    where: {
      status: { in: ['pending', 'in_progress'] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [
      { priority: 'asc' }, // critical first (alphabetical: critical < high < low < medium)
      { createdAt: 'desc' },
    ],
    take: 100,
  });

  // Manual sort since Prisma enum ordering is alphabetical
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = actions.sort(
    (a, b) =>
      (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // For review_leads actions, fetch top 5 unrated leads to surface inline
  const hasReviewLeads = sorted.some((a) => a.type === 'review_leads');
  let inlineLeads: {
    id: string;
    address: string;
    postcode: string;
    leadScore: number;
    verdict: string;
    existingRating: number;
  }[] = [];

  if (hasReviewLeads) {
    const topLeads = await database.scoutLead.findMany({
      where: { status: 'new' },
      orderBy: { leadScore: 'desc' },
      take: 20,
      select: {
        id: true,
        address: true,
        postcode: true,
        leadScore: true,
        verdict: true,
      },
    });
    const leadIds = topLeads.map((l) => l.id);
    const feedbackRecords = await database.founderFeedback.findMany({
      where: { targetType: 'scout_lead', targetId: { in: leadIds } },
      select: { targetId: true, rating: true },
    });
    const ratedIds = new Set(feedbackRecords.map((f) => f.targetId));
    inlineLeads = topLeads
      .filter((l) => !ratedIds.has(l.id))
      .slice(0, 5)
      .map((l) => ({ ...l, verdict: String(l.verdict), existingRating: 0 }));
  }

  // Count by priority for header
  const criticalCount = sorted.filter((a) => a.priority === 'critical').length;
  const highCount = sorted.filter((a) => a.priority === 'high').length;

  // Id lists for the bulk-clear toolbar. "Routine" = low + medium noise the
  // founder can safely sweep without reading each one.
  const routineIds = sorted
    .filter((a) => a.priority === 'low' || a.priority === 'medium')
    .map((a) => a.id);
  const allIds = sorted.map((a) => a.id);

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
            <p className="text-muted-foreground text-sm">Pending</p>
            <p className="font-bold text-2xl">{sorted.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-muted-foreground text-sm">Critical</p>
            <p
              className={`font-bold text-2xl ${criticalCount > 0 ? 'text-red-600' : ''}`}
            >
              {criticalCount}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-muted-foreground text-sm">High Priority</p>
            <p
              className={`font-bold text-2xl ${highCount > 0 ? 'text-amber-600' : ''}`}
            >
              {highCount}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-muted-foreground text-sm">Resolved (7d)</p>
            <p className="font-bold text-2xl text-emerald-600">
              {recentResolved}
            </p>
          </div>
        </div>

        {/* Action list */}
        {sorted.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <p className="font-medium text-lg">All clear</p>
            <p className="mt-1 text-muted-foreground text-sm">
              No actions need your attention right now. The agents are working.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <BulkActionsToolbar routineIds={routineIds} allIds={allIds} />
            {sorted.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                reviewLeads={
                  action.type === 'review_leads' ? inlineLeads : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default ActionsPage;

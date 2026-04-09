import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../../components/header';
import { HoldCard } from './components/hold-card';

export const metadata: Metadata = {
  title: 'Review Vendor Emails — Bellwood Ventures',
  description: 'Approve or edit vendor communications before sending',
};

const HoldsPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const [heldEmails, recentlySent] = await Promise.all([
    database.outreachHold.findMany({
      where: { status: 'held' },
      orderBy: { createdAt: 'desc' },
    }),
    database.outreachHold.findMany({
      where: { status: { in: ['sent', 'approved', 'rejected'] } },
      orderBy: { reviewedAt: 'desc' },
      take: 10,
    }),
  ]);

  return (
    <>
      <Header
        pages={[{ title: 'Outreach', url: '/outreach' }]}
        page="Vendor Email Review"
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-bold">Vendor Email Review</h1>
          <p className="text-sm text-muted-foreground">
            These emails are to individual vendors — they require your personal touch before sending.
          </p>
        </div>

        {/* Pending holds */}
        {heldEmails.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              No vendor emails awaiting review. The outreach pipeline will queue them here when ready.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Awaiting Review ({heldEmails.length})
            </h2>
            {heldEmails.map((hold) => (
              <HoldCard key={hold.id} hold={hold} />
            ))}
          </div>
        )}

        {/* Recently processed */}
        {recentlySent.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Recently Processed
            </h2>
            {recentlySent.map((hold) => (
              <div
                key={hold.id}
                className="flex items-center justify-between rounded-lg border bg-card p-3 opacity-60"
              >
                <div>
                  <p className="text-sm font-medium">{hold.recipientName ?? 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{hold.renderedSubject}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    hold.status === 'sent'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                      : hold.status === 'rejected'
                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                        : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {hold.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default HoldsPage;

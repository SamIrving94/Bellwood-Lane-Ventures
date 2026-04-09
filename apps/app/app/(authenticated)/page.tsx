import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from './components/header';

export const metadata: Metadata = {
  title: 'Dashboard — Bellwood Ventures',
  description: 'Deal pipeline overview',
};

// Format pence to GBP string
function formatGBP(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

const Dashboard = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Fetch pipeline stats in parallel
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalDeals,
    dealsByStatus,
    recentDeals,
    leadsThisWeek,
    strongLeads,
    pendingActions,
    agentEventsToday,
    upcomingDeadlines,
  ] = await Promise.all([
    database.deal.count(),
    database.deal.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    database.deal.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    database.scoutLead.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    database.scoutLead.count({
      where: {
        verdict: 'STRONG',
        status: 'new',
      },
    }),
    database.founderAction.count({
      where: { status: { in: ['pending', 'in_progress'] } },
    }),
    database.agentEvent.findMany({
      where: { createdAt: { gte: todayStart } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    database.deal.findMany({
      where: {
        OR: [
          { goldenWindowExpiresAt: { gte: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } },
          { mortgageExpiryDate: { gte: new Date(), lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) } },
        ],
      },
      orderBy: { goldenWindowExpiresAt: 'asc' },
      take: 5,
      select: { id: true, address: true, postcode: true, sellerType: true, goldenWindowExpiresAt: true, mortgageExpiryDate: true },
    }),
  ]);

  // Calculate pipeline value (sum of asking prices for active deals)
  const activeDeals = await database.deal.findMany({
    where: {
      status: {
        in: ['contacted', 'valuation', 'offer_made', 'under_offer'],
      },
    },
    select: { askingPricePence: true, ourOfferPence: true },
  });

  const pipelineValue = activeDeals.reduce(
    (sum, d) => sum + (d.ourOfferPence || d.askingPricePence || 0),
    0
  );

  // Build status counts map
  const statusCounts = Object.fromEntries(
    dealsByStatus.map((s) => [s.status, s._count.id])
  );

  const stages = [
    { key: 'new_lead', label: 'New', color: 'bg-slate-500' },
    { key: 'contacted', label: 'Contacted', color: 'bg-blue-500' },
    { key: 'valuation', label: 'Valuation', color: 'bg-amber-500' },
    { key: 'offer_made', label: 'Offer Made', color: 'bg-purple-500' },
    { key: 'under_offer', label: 'Under Offer', color: 'bg-emerald-500' },
    { key: 'exchanged', label: 'Exchanged', color: 'bg-green-600' },
    { key: 'completed', label: 'Completed', color: 'bg-green-800' },
  ];

  return (
    <>
      <Header pages={[]} page="Dashboard" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Active Deals</p>
            <p className="text-2xl font-bold">{totalDeals}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Pipeline Value</p>
            <p className="text-2xl font-bold">
              {pipelineValue > 0 ? formatGBP(pipelineValue) : '—'}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Leads This Week</p>
            <p className="text-2xl font-bold">{leadsThisWeek}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Strong Leads</p>
            <p className="text-2xl font-bold text-emerald-600">
              {strongLeads}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Actions Pending</p>
            <p className={`text-2xl font-bold ${pendingActions > 0 ? 'text-red-600' : ''}`}>
              {pendingActions}
            </p>
            {pendingActions > 0 && (
              <a href="/actions" className="text-xs text-primary hover:underline">
                View Action Centre →
              </a>
            )}
          </div>
        </div>

        {/* Pipeline stages */}
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Pipeline
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            {stages.map((stage) => (
              <div
                key={stage.key}
                className="rounded-lg border bg-card p-3 text-center"
              >
                <div
                  className={`mx-auto mb-2 h-2 w-2 rounded-full ${stage.color}`}
                />
                <p className="text-xs text-muted-foreground">{stage.label}</p>
                <p className="text-lg font-semibold">
                  {statusCounts[stage.key] || 0}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Recent deals */}
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Recent Deals
          </h2>
          {recentDeals.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center">
              <p className="text-muted-foreground">
                No deals yet. Add your first deal from the Pipeline page.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentDeals.map((deal) => (
                <a
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
                >
                  <div>
                    <p className="font-medium">{deal.address}</p>
                    <p className="text-sm text-muted-foreground">
                      {deal.postcode} &middot; {deal.sellerType.replace('_', ' ')} &middot;{' '}
                      {deal.propertyType}
                    </p>
                  </div>
                  <div className="text-right">
                    {deal.askingPricePence && (
                      <p className="font-medium">
                        {formatGBP(deal.askingPricePence)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground capitalize">
                      {deal.status.replace('_', ' ')}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
        {/* Two-column layout: Agent Activity + Upcoming Deadlines */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Agent Activity Feed */}
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Agent Activity Today
            </h2>
            {agentEventsToday.length === 0 ? (
              <div className="rounded-lg border bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No agent activity yet today.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {agentEventsToday.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 rounded-lg border bg-card p-3"
                  >
                    <span className="mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium capitalize dark:bg-slate-800">
                      {event.agent}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{event.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.createdAt).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Upcoming Deadlines */}
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Upcoming Deadlines
            </h2>
            {upcomingDeadlines.length === 0 ? (
              <div className="rounded-lg border bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No upcoming deadlines.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.map((deal) => {
                  const deadline = deal.goldenWindowExpiresAt ?? deal.mortgageExpiryDate;
                  const daysLeft = deadline
                    ? Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;
                  const isUrgent = daysLeft !== null && daysLeft <= 14;

                  return (
                    <a
                      key={deal.id}
                      href={`/deals/${deal.id}`}
                      className="flex items-center justify-between rounded-lg border bg-card p-3 transition-colors hover:bg-accent"
                    >
                      <div>
                        <p className="text-sm font-medium">{deal.address}</p>
                        <p className="text-xs text-muted-foreground">
                          {deal.sellerType.replace('_', ' ')} &middot; {deal.postcode}
                        </p>
                      </div>
                      <div className="text-right">
                        {daysLeft !== null && (
                          <p className={`text-sm font-medium ${isUrgent ? 'text-red-600' : 'text-amber-600'}`}>
                            {daysLeft}d left
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {deal.goldenWindowExpiresAt ? 'Golden window' : 'Mortgage expiry'}
                        </p>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
};

export default Dashboard;

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../../components/header';
import { AreasForm } from './areas-form';
import { getAreas } from './areas-actions';

export const metadata: Metadata = {
  title: 'Scouting · Settings — Bellwoods Lane',
  description: 'Tell the platform where to look for distressed leads.',
};

export const dynamic = 'force-dynamic';

export default async function ScoutingSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const [areas, lastRun, recentLeadCount] = await Promise.all([
    getAreas(),
    database.agentEvent.findFirst({
      where: { eventType: 'leads_created' },
      orderBy: { createdAt: 'desc' },
    }),
    database.scoutLead.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return (
    <>
      <Header
        pages={[{ title: 'Settings', url: '/settings' }]}
        page="Scouting"
      />
      <main className="mx-auto w-full max-w-3xl space-y-8 p-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Settings · Scouting
          </p>
          <h1 className="mt-1 font-semibold text-2xl tracking-tight">
            Where you buy
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Tell the platform which UK areas to look for distressed property
            leads in. Every morning at 07:00 UTC we pull probate, repos, BMV,
            auction and stale-listing data from PropertyData for each area,
            score the results, and surface high-scoring leads on Today.
          </p>
        </div>

        <AreasForm initial={areas} />

        {/* Recent run snapshot */}
        <div className="rounded-2xl border bg-card p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Last 7 days
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Leads found</dt>
              <dd className="mt-1 font-semibold text-lg">{recentLeadCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last scout run</dt>
              <dd className="mt-1 text-[13px]">
                {lastRun ? (
                  <>
                    {lastRun.createdAt.toLocaleString('en-GB')}
                    <br />
                    <span className="text-muted-foreground text-[12px]">
                      {lastRun.summary}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">No runs yet.</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <p className="text-center text-muted-foreground text-xs">
          <Link href="/settings" className="hover:underline">
            ← Back to Settings
          </Link>
        </p>
      </main>
    </>
  );
}

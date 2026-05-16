import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../../components/header';
import { ScoutingPostcodesForm } from './scouting-postcodes-form';
import { ScanSeedsForm } from './scan-seeds-form';
import { getScanSeeds } from './actions';

export const metadata: Metadata = {
  title: 'Scouting · Settings — Bellwoods Lane',
  description: 'Manage target postcodes for the daily scouting cron.',
};

export const dynamic = 'force-dynamic';

const POSTCODE_KEY = 'scouting.targetPostcodes';

export default async function ScoutingSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const setting = await database.setting.findUnique({
    where: { key: POSTCODE_KEY },
  });
  const postcodes = Array.isArray(setting?.value) ? (setting!.value as string[]) : [];

  // Last cron run summary — what came back yesterday?
  const lastRun = await database.agentEvent.findFirst({
    where: { eventType: 'leads_created' },
    orderBy: { createdAt: 'desc' },
  });

  const recentLeadCount = await database.scoutLead.count({
    where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  });

  const scanSeeds = await getScanSeeds();

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
            Target postcodes
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Every morning at 07:00 UTC the scouting cron pulls distressed
            property listings from PropertyData for each of these postcodes,
            scores them, and surfaces high-scoring leads on Today. Edit the
            list here — no code deploy needed.
          </p>
        </div>

        {/* The form */}
        <ScoutingPostcodesForm initialPostcodes={postcodes} />

        {/* Scan seeds (full postcode + radius) — the proper PropertyData input */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Scan seeds · PropertyData
          </p>
          <h2 className="mt-1 font-semibold text-xl tracking-tight">
            Scan seeds (full postcode + radius)
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            PropertyData rejects district codes (M14) on the sourced-properties
            endpoint. To pull listings you need a full postcode and a search
            radius. Add one or more seeds per area you want to cover —
            typically one central seed per district at 1 mile, or 2-3 seeds
            for larger towns.
          </p>
        </div>
        <ScanSeedsForm initialSeeds={scanSeeds} />

        {/* Status card */}
        <div className="rounded-2xl border bg-card p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Status
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Active postcodes</dt>
              <dd className="mt-1 font-semibold text-lg">{postcodes.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Leads (last 7 days)</dt>
              <dd className="mt-1 font-semibold text-lg">{recentLeadCount}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Last scout run</dt>
              <dd className="mt-1 text-sm">
                {lastRun ? (
                  <>
                    {lastRun.createdAt.toLocaleString('en-GB')} —{' '}
                    <span className="text-muted-foreground">{lastRun.summary}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">No runs yet.</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        {/* Info card */}
        <div className="rounded-2xl border border-dashed bg-slate-50/50 p-5 text-sm">
          <p className="font-medium">How the two lists work together</p>
          <ul className="mt-2 space-y-1.5 text-muted-foreground">
            <li>· <strong>Target postcodes (districts above)</strong> drive HMCTS probate filtering, The Gazette parsing, and the Monday agent-prospecting cron. Format: <code className="rounded bg-white px-1">M14</code>, <code className="rounded bg-white px-1">SK4</code>.</li>
            <li>· <strong>Scan seeds (full postcodes below)</strong> drive PropertyData <code className="rounded bg-white px-1">/sourced-properties</code> and <code className="rounded bg-white px-1">/listings</code> — both reject districts. Format: <code className="rounded bg-white px-1">M14 5LL</code> + radius.</li>
            <li>· <strong>For full coverage you need both.</strong> One scan seed per district, 1 mile radius is a good default.</li>
            <li>· ~6 PropertyData credits per seed per daily run (3 sourced + 3 listings).</li>
          </ul>
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

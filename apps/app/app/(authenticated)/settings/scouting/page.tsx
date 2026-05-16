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
  description: 'Configure where the platform looks for distressed leads.',
};

export const dynamic = 'force-dynamic';

const POSTCODE_KEY = 'scouting.targetPostcodes';

export default async function ScoutingSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const setting = await database.setting.findUnique({
    where: { key: POSTCODE_KEY },
  });
  const postcodes = Array.isArray(setting?.value)
    ? (setting!.value as string[])
    : [];

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
      <main className="mx-auto w-full max-w-3xl space-y-10 p-6">
        {/* Page intro */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Settings · Scouting
          </p>
          <h1 className="mt-1 font-semibold text-2xl tracking-tight">
            Lead sources
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Configure where the daily 07:00 UTC scouting cron looks for
            distressed property leads. Two lists below feed different data
            sources — you need <strong>both</strong> for full coverage.
          </p>
        </div>

        {/* Live status snapshot — front and centre */}
        <div className="rounded-2xl border bg-card p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Live status
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Scan seeds</dt>
              <dd className="mt-1 font-semibold text-lg">{scanSeeds.length}</dd>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                PropertyData input
              </p>
            </div>
            <div>
              <dt className="text-muted-foreground">Districts</dt>
              <dd className="mt-1 font-semibold text-lg">{postcodes.length}</dd>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                HMCTS / Gazette / agents
              </p>
            </div>
            <div>
              <dt className="text-muted-foreground">Leads (7d)</dt>
              <dd className="mt-1 font-semibold text-lg">{recentLeadCount}</dd>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Scored & qualified
              </p>
            </div>
          </dl>
          <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Last run:</span>{' '}
            {lastRun ? (
              <>
                {lastRun.createdAt.toLocaleString('en-GB')} — {lastRun.summary}
              </>
            ) : (
              'No runs yet.'
            )}
          </div>
        </div>

        {/* SECTION 1 — Scan seeds (primary source) */}
        <section className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-900">
                Primary
              </span>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                PropertyData distressed listings
              </p>
            </div>
            <h2 className="mt-2 font-semibold text-xl tracking-tight">
              Scan seeds — full postcode + radius
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
              Each seed is a real UK postcode (e.g.{' '}
              <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">M14 5LL</code>
              ) and a search radius. The cron calls PropertyData{' '}
              <code className="font-mono text-[12px]">/sourced-properties</code> (probate, repos, BMV, auction, unmodernised) and{' '}
              <code className="font-mono text-[12px]">/listings</code> (stale active listings &gt; 60 days on market) for each seed. <strong>This is the only source currently producing leads.</strong>{' '}
              ~6 credits per seed per day.
            </p>
          </div>
          <ScanSeedsForm initialSeeds={scanSeeds} />
        </section>

        {/* SECTION 2 — Districts (secondary sources) */}
        <section className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-200 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-700">
                Secondary
              </span>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Probate + agent prospecting
              </p>
            </div>
            <h2 className="mt-2 font-semibold text-xl tracking-tight">
              Districts — postcode prefixes
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
              UK postcode districts (e.g.{' '}
              <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">M14</code>,{' '}
              <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">SK4</code>
              ) used for three things:
            </p>
            <ul className="mt-2 ml-4 max-w-2xl space-y-1 text-muted-foreground text-sm">
              <li>
                · <strong>HMCTS probate filter</strong> — currently 0
                results (no live HMCTS API wired)
              </li>
              <li>
                · <strong>The Gazette probate notices</strong> — currently 0
                results (TLS fingerprinting blocks our Vercel calls)
              </li>
              <li>
                · <strong>Monday agent-prospecting cron</strong> — finds
                estate agents in each district to outreach (this one
                works)
              </li>
            </ul>
            <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
              These do <strong>not</strong> hit PropertyData distressed
              listings — that requires scan seeds above. The Test button
              here will 400 until we wire the list param through the
              districts code path too.
            </p>
          </div>
          <ScoutingPostcodesForm initialPostcodes={postcodes} />
        </section>

        <p className="text-center text-muted-foreground text-xs">
          <Link href="/settings" className="hover:underline">
            ← Back to Settings
          </Link>
        </p>
      </main>
    </>
  );
}

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { asMeta, readPublishedAt } from '../lib/metadata';
import {
  MARKETING_ACTION_TYPES,
  MARKETING_TYPE_LABELS,
} from '../lib/marketing-types';

export const metadata: Metadata = {
  title: 'Performance — Marketing — Bellwoods Lane',
  description: 'KPIs and counts for marketing activity.',
};

export const dynamic = 'force-dynamic';

/**
 * Marketing plan §10 KPIs.
 * These are placeholders until UTM wiring lands.
 */
const KPIS: Array<{ label: string; help: string }> = [
  { label: 'CPL (cost / lead)', help: 'Ad spend ÷ qualified leads' },
  { label: 'CPA (cost / appointment)', help: 'Ad spend ÷ booked calls' },
  { label: 'Lead → call rate', help: 'Calls booked ÷ leads' },
  { label: 'Call → offer rate', help: 'Offers ÷ booked calls' },
  { label: 'Offer → accept rate', help: 'Accepts ÷ offers sent' },
  { label: 'Avg deal margin', help: 'Net profit ÷ resale price' },
  { label: 'CAC payback (days)', help: 'Days to recoup acquisition' },
  { label: 'Channel ROAS', help: 'Revenue ÷ spend, per channel' },
];

const PerformancePage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Pending drafts by type — Prisma groupBy returns one row per type.
  const pendingByTypeRaw = await database.founderAction.groupBy({
    by: ['type'],
    where: {
      type: { in: MARKETING_ACTION_TYPES },
      status: 'pending',
    },
    _count: { _all: true },
  });

  const pendingByType: Array<{ type: string; count: number }> =
    pendingByTypeRaw.map((row) => ({
      type: String(row.type),
      count:
        typeof row._count === 'object' && row._count
          ? (row._count._all ?? 0)
          : 0,
    }));

  // Completed marketing actions — we bucket in JS by publishedAt, since the
  // date lives inside the Json `metadata` blob which Prisma can't group on.
  const completed = await database.founderAction.findMany({
    where: {
      type: { in: MARKETING_ACTION_TYPES },
      status: 'completed',
    },
    orderBy: { resolvedAt: 'desc' },
    take: 500,
    select: { id: true, type: true, metadata: true, resolvedAt: true },
  });

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const buckets = {
    thisWeek: 0,
    lastWeek: 0,
    lastMonth: 0,
  };
  for (const row of completed) {
    const publishedAt = readPublishedAt(asMeta(row.metadata));
    if (!publishedAt) continue;
    const ageMs = now - publishedAt.getTime();
    if (ageMs < 7 * DAY) buckets.thisWeek += 1;
    else if (ageMs < 14 * DAY) buckets.lastWeek += 1;
    if (ageMs < 30 * DAY) buckets.lastMonth += 1;
  }

  return (
    <div className="space-y-8">
      {/* Pending drafts by type */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Pending drafts</h2>
          <p className="text-xs text-muted-foreground">
            Waiting in the Queue tab, by type.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left dark:bg-slate-900">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Pending</th>
              </tr>
            </thead>
            <tbody>
              {pendingByType.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-slate-500"
                    colSpan={2}
                  >
                    No pending marketing drafts.
                  </td>
                </tr>
              ) : (
                pendingByType
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .map((row) => (
                    <tr
                      key={row.type}
                      className="border-t border-slate-100 dark:border-slate-800"
                    >
                      <td className="px-3 py-2">
                        {MARKETING_TYPE_LABELS[row.type] ?? row.type}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {row.count}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cadence */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Publication cadence</h2>
          <p className="text-xs text-muted-foreground">
            Based on{' '}
            <code className="font-mono text-[11px]">metadata.publishedAt</code>{' '}
            on completed marketing actions.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="This week" value={buckets.thisWeek} />
          <Stat label="Last week" value={buckets.lastWeek} />
          <Stat label="Last 30 days" value={buckets.lastMonth} />
        </div>
      </section>

      {/* KPI placeholders */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">KPIs (marketing plan §10)</h2>
          <p className="text-xs text-muted-foreground">
            Real numbers go here once UTM tagging + funnel attribution are wired.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {KPIS.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-lg border border-dashed border-slate-300 bg-slate-50/40 p-4 dark:border-slate-700 dark:bg-slate-900/30"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {kpi.label}
              </p>
              <p className="mt-2 font-mono text-lg text-muted-foreground">—</p>
              <p className="mt-1 text-[11px] italic text-muted-foreground">
                Awaiting UTM wiring
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                {kpi.help}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default PerformancePage;

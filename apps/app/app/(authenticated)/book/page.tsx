import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';

export const metadata: Metadata = {
  title: 'Book — Bellwood Ventures',
  description: 'Realised trade P&L on deals Bellwood bought for its own book.',
};

export const dynamic = 'force-dynamic';

function formatGBP(pence: number | null): string {
  if (pence === null) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function formatDate(d: Date | null): string {
  return d
    ? new Date(d).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';
}

const BookPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // The book = deals we've actually put money into. A deal earns its place
  // here as soon as an acquisition price is recorded.
  const deals = await database.deal.findMany({
    where: { acquisitionPricePence: { not: null } },
    orderBy: [{ exitedAt: 'desc' }, { acquiredAt: 'desc' }],
    select: {
      id: true,
      address: true,
      postcode: true,
      estimatedMarketValuePence: true,
      acquisitionPricePence: true,
      acquiredAt: true,
      refurbCostPence: true,
      legalFeesPence: true,
      otherCostsPence: true,
      exitPricePence: true,
      exitedAt: true,
      realisedProfitPence: true,
    },
  });

  const rows = deals.map((d) => {
    const costs =
      (d.refurbCostPence ?? 0) +
      (d.legalFeesPence ?? 0) +
      (d.otherCostsPence ?? 0);
    const totalIn = (d.acquisitionPricePence ?? 0) + costs;
    const exited = d.exitedAt !== null && d.exitPricePence !== null;
    const profit = d.realisedProfitPence;
    const roi =
      profit !== null && totalIn > 0 ? (profit / totalIn) * 100 : null;
    return { ...d, costs, totalIn, exited, profit, roi };
  });

  const exitedRows = rows.filter((r) => r.exited);
  const liveRows = rows.filter((r) => !r.exited);

  // Capital currently tied up in unsold holdings.
  const capitalDeployed = liveRows.reduce((s, r) => s + r.totalIn, 0);
  // Realised profit only counts closed trades.
  const realisedProfit = exitedRows.reduce((s, r) => s + (r.profit ?? 0), 0);
  const exitedCapital = exitedRows.reduce((s, r) => s + r.totalIn, 0);
  const blendedRoi =
    exitedCapital > 0 ? (realisedProfit / exitedCapital) * 100 : null;
  const winners = exitedRows.filter((r) => (r.profit ?? 0) > 0).length;
  const winRate =
    exitedRows.length > 0 ? (winners / exitedRows.length) * 100 : null;

  return (
    <>
      <Header
        pages={[{ title: 'Pipeline', url: '/pipeline' }]}
        page="Book"
      />
      <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Line 1 · Trade book
          </p>
          <h1 className="mt-1 font-semibold text-2xl tracking-tight">Book</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Realised P&amp;L on deals we&apos;ve bought for our own book. Add a
            past deal from the{' '}
            <Link href="/pipeline" className="font-medium text-foreground underline">
              Pipeline
            </Link>
            , then record its economics on the deal page.
          </p>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard
            label="Realised profit"
            value={formatGBP(realisedProfit)}
            tone={realisedProfit >= 0 ? 'good' : 'bad'}
          />
          <SummaryCard
            label="Blended ROI"
            value={blendedRoi !== null ? `${blendedRoi.toFixed(1)}%` : '—'}
          />
          <SummaryCard
            label="Win rate"
            value={
              winRate !== null
                ? `${winRate.toFixed(0)}% (${winners}/${exitedRows.length})`
                : '—'
            }
          />
          <SummaryCard
            label="Capital deployed"
            value={formatGBP(capitalDeployed)}
            sub={`${liveRows.length} live`}
          />
          <SummaryCard
            label="Deals exited"
            value={String(exitedRows.length)}
            sub={`${rows.length} total`}
          />
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground">
            No deals on the book yet. Record an acquisition price on a deal to
            add it here.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Property</th>
                  <th className="px-4 py-2 font-medium">Acquired</th>
                  <th className="px-4 py-2 text-right font-medium">Total in</th>
                  <th className="px-4 py-2 text-right font-medium">Exit</th>
                  <th className="px-4 py-2 text-right font-medium">Profit</th>
                  <th className="px-4 py-2 text-right font-medium">ROI</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <Link
                        href={`/deals/${r.id}`}
                        className="font-medium hover:underline"
                      >
                        {r.postcode}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.address}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatDate(r.acquiredAt)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {formatGBP(r.totalIn)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {formatGBP(r.exitPricePence)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-mono tabular-nums ${
                        r.profit === null
                          ? 'text-muted-foreground'
                          : r.profit >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatGBP(r.profit)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {r.roi !== null ? `${r.roi.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          r.exited
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        }`}
                      >
                        {r.exited ? 'Exited' : 'Live'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
};

function SummaryCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'bad';
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
          tone === 'good'
            ? 'text-emerald-600 dark:text-emerald-400'
            : tone === 'bad'
              ? 'text-red-600 dark:text-red-400'
              : ''
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default BookPage;

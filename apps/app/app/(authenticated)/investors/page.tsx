import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';

export const metadata: Metadata = {
  title: 'Investor feed — Bellwood Ventures',
  description: 'Deals Bellwood has passed on, released to the investor feed.',
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

const InvestorFeedPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Only released deals appear here. Seller PII (name/email/phone) is never
  // selected — the feed is deliberately a numbers-and-location view.
  const deals = await database.deal.findMany({
    where: { releasedForResale: true },
    orderBy: { releasedAt: 'desc' },
    select: {
      id: true,
      postcode: true,
      propertyType: true,
      bedrooms: true,
      sellerType: true,
      askingPricePence: true,
      ourOfferPence: true,
      estimatedMarketValuePence: true,
      marginPercent: true,
      verdict: true,
      resaleReason: true,
      resalePricePence: true,
      releasedAt: true,
      sourcingFeePence: true,
      sourcingFeeStatus: true,
      _count: { select: { investorInterests: true } },
    },
  });

  // Line 2 money view — what the sourcing channel has earned / is owed.
  const feePaid = deals
    .filter((d) => d.sourcingFeeStatus === 'paid')
    .reduce((s, d) => s + (d.sourcingFeePence ?? 0), 0);
  const feeOwed = deals
    .filter(
      (d) =>
        d.sourcingFeeStatus === 'agreed' || d.sourcingFeeStatus === 'invoiced',
    )
    .reduce((s, d) => s + (d.sourcingFeePence ?? 0), 0);
  const feeProposed = deals
    .filter((d) => d.sourcingFeeStatus === 'proposed')
    .reduce((s, d) => s + (d.sourcingFeePence ?? 0), 0);

  return (
    <>
      <Header
        pages={[{ title: 'Pipeline', url: '/pipeline' }]}
        page="Investor feed"
      />
      <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Deals · Investor feed
          </p>
          <h1 className="mt-1 font-semibold text-2xl tracking-tight">
            Investor feed
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Deals Bellwood has passed on for its own book and released to
            investors. {deals.length} live{' '}
            {deals.length === 1 ? 'deal' : 'deals'}. Seller contact details are
            never shown here — release a deal from its page with{' '}
            <span className="font-medium text-foreground">Pass &amp; release</span>.
          </p>
        </div>

        {/* Line 2 — sourcing fee pipeline */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Fees paid
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatGBP(feePaid)}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Agreed / invoiced
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
              {formatGBP(feeOwed)}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Proposed
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-muted-foreground">
              {formatGBP(feeProposed)}
            </p>
          </div>
        </div>

        {deals.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground">
            Nothing on the feed yet. Open a deal you&apos;ve decided to pass on
            and use <span className="font-medium">Pass &amp; release</span> to
            add it here.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {deals.map((d) => (
              <Link
                key={d.id}
                href={`/deals/${d.id}`}
                className="rounded-xl border bg-card p-5 transition hover:border-foreground/30 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{d.postcode}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {d.propertyType}
                      {d.bedrooms ? ` · ${d.bedrooms} bed` : ''} ·{' '}
                      {d.sellerType.replace('_', ' ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {d.verdict && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                        {d.verdict}
                      </span>
                    )}
                    {d._count.investorInterests > 0 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        {d._count.investorInterests} interested
                      </span>
                    )}
                    {d.sourcingFeeStatus !== 'none' && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          d.sourcingFeeStatus === 'paid'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        Fee {d.sourcingFeeStatus}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      EMV
                    </p>
                    <p className="font-mono text-sm font-semibold tabular-nums">
                      {formatGBP(d.estimatedMarketValuePence)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Our offer
                    </p>
                    <p className="font-mono text-sm font-semibold tabular-nums">
                      {formatGBP(d.ourOfferPence)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Margin
                    </p>
                    <p className="font-mono text-sm font-semibold tabular-nums">
                      {d.marginPercent ? `${d.marginPercent.toFixed(1)}%` : '—'}
                    </p>
                  </div>
                </div>

                {d.resalePricePence ? (
                  <p className="mt-3 text-xs">
                    <span className="text-muted-foreground">Referral price: </span>
                    <span className="font-mono font-semibold">
                      {formatGBP(d.resalePricePence)}
                    </span>
                  </p>
                ) : null}

                {d.resaleReason && (
                  <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                    {d.resaleReason}
                  </p>
                )}

                <p className="mt-3 text-[10px] text-muted-foreground">
                  Released{' '}
                  {d.releasedAt
                    ? new Date(d.releasedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
};

export default InvestorFeedPage;

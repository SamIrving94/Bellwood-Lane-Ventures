import Link from 'next/link';
import type { Metadata } from 'next';
import { database } from '@repo/database';
import { Header } from '../components/header';

export const metadata: Metadata = {
  title: 'Quotes — Bellwoods Lane',
  description: 'Public Instant Offer submissions and their generated quotes.',
};

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  processing: 'bg-amber-100 text-amber-700',
  quoted: 'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-rose-100 text-rose-700',
  expired: 'bg-slate-100 text-slate-500',
  converted_to_deal: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
};

function formatGBP(pence?: number | null) {
  if (pence == null) return '—';
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

function timeAgo(d: Date): string {
  const ms = Date.now() - d.getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.round(h / 24);
  return `${day}d ago`;
}

export default async function QuotesPage() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [quotes, monthCount, todayCount, acceptedCount, requireReviewCount] =
    await Promise.all([
      database.quoteRequest.findMany({
        include: { offer: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      database.quoteRequest.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      database.quoteRequest.count({
        where: { createdAt: { gte: startOfToday } },
      }),
      database.quoteRequest.count({ where: { status: 'accepted' } }),
      database.quoteRequest.count({
        where: {
          status: 'quoted',
          offer: { offerPercentOfAvm: { lt: 0.6 } },
        },
      }),
    ]);

  return (
    <>
      <Header
        pages={[{ title: 'Quotes', url: '/quotes' }]}
        page="All quotes"
      />
      <main className="mx-auto w-full max-w-7xl space-y-6 p-6">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Quotes</h1>
          <p className="text-muted-foreground text-sm">
            Every public Instant Offer submission. Click a row to see the
            offer, the live timeline, and act on it.
          </p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Today', value: todayCount },
            { label: 'This month', value: monthCount },
            { label: 'Accepted', value: acceptedCount },
            { label: 'Need review', value: requireReviewCount, tone: 'amber' },
          ].map((m) => (
            <div
              key={m.label}
              className={`rounded-2xl border p-5 ${
                m.tone === 'amber'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <p className="text-muted-foreground text-xs uppercase tracking-widest">
                {m.label}
              </p>
              <p
                className={`mt-2 font-serif text-4xl font-semibold ${
                  m.tone === 'amber' ? 'text-amber-700' : ''
                }`}
              >
                {m.value}
              </p>
            </div>
          ))}
        </div>

        {/* Table */}
        {quotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="font-serif text-xl">No quotes yet.</p>
            <p className="mt-2 text-muted-foreground text-sm">
              When someone submits the public Instant Offer, it will appear
              here in real time.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-muted-foreground text-xs uppercase tracking-widest">
                <tr>
                  <th className="px-5 py-3 text-left">Property</th>
                  <th className="px-5 py-3 text-left">Submitter</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Offer</th>
                  <th className="px-5 py-3 text-right">% AVM</th>
                  <th className="px-5 py-3 text-left">Submitted</th>
                  <th className="px-5 py-3 text-right">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {quotes.map((q) => {
                  const lowOffer =
                    q.offer && q.offer.offerPercentOfAvm < 0.6;
                  return (
                    <tr
                      key={q.id}
                      className={`group cursor-pointer hover:bg-slate-50 ${lowOffer ? 'bg-amber-50/40' : ''}`}
                    >
                      <td className="px-5 py-3">
                        <Link
                          href={`/quotes/${q.id}`}
                          className="block font-medium hover:text-amber-700"
                        >
                          {q.address}
                        </Link>
                        <p className="text-muted-foreground text-xs">
                          {q.postcode}
                          {q.bedrooms ? ` · ${q.bedrooms} bed` : ''}
                          {q.sellerSituation
                            ? ` · ${q.sellerSituation.replace(/_/g, ' ')}`
                            : ''}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium">{q.contactName}</p>
                        <p className="text-muted-foreground text-xs">
                          {q.role === 'agent' && q.firmName
                            ? q.firmName
                            : q.role}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            STATUS_TONE[q.status] ?? 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {q.status.replace(/_/g, ' ')}
                        </span>
                        {lowOffer && (
                          <span className="ml-2 inline-flex rounded-full bg-amber-200 px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber-800">
                            review
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-medium">
                        {formatGBP(q.offer?.offerPence)}
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground">
                        {q.offer
                          ? `${Math.round(q.offer.offerPercentOfAvm * 100)}%`
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">
                        {timeAgo(q.createdAt)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {q.source.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}

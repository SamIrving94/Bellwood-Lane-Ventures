import Link from 'next/link';
import type { Metadata } from 'next';
import { leadChannelLabel } from '@repo/analytics/lead-source';
import { database } from '@repo/database';
import { loadChannels, loadSourceRows } from '@/lib/lead-source-queries';
import { summariseLeadSources } from '@/lib/lead-sources';
import { Header } from '../components/header';

export const metadata: Metadata = {
  title: 'Quotes — Kept',
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

/**
 * Extract a UI-readable trigger label from QuoteRequest.notes.
 * Notes are persisted as 'Trigger: Mortgage refused\nSource: agent_quick_form'.
 */
function extractTrigger(notes?: string | null): string | undefined {
  if (!notes) return undefined;
  const match = notes.match(/Trigger:\s*([^\n]+)/i);
  return match?.[1]?.trim();
}

/**
 * Render an SLA-deadline countdown for the agent inbox. Returns the
 * remaining time + a tone hint for styling.
 */
function slaCountdown(submittedAt: Date, slaHours = 24): {
  label: string;
  tone: 'fresh' | 'warning' | 'breach';
} {
  const deadline = submittedAt.getTime() + slaHours * 60 * 60 * 1000;
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) {
    const overMin = Math.round(-remainingMs / 60000);
    return {
      label: overMin < 60 ? `${overMin}m late` : `${Math.round(overMin / 60)}h late`,
      tone: 'breach',
    };
  }
  const remainingMin = Math.round(remainingMs / 60000);
  if (remainingMin < 60) {
    return { label: `${remainingMin}m left`, tone: 'warning' };
  }
  const remainingH = Math.floor(remainingMin / 60);
  const stubMin = remainingMin % 60;
  return {
    label: `${remainingH}h ${stubMin}m left`,
    tone: remainingH < 1 ? 'warning' : 'fresh',
  };
}

const SLA_TONE: Record<'fresh' | 'warning' | 'breach', string> = {
  fresh: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-800',
  breach: 'bg-rose-100 text-rose-800',
};

/** How far back "Where enquiries came from" counts. */
const SOURCE_WINDOW_DAYS = 90;

const SOURCE_TH = 'px-5 py-2.5 text-right';
const SOURCE_TD = 'px-5 py-2.5 text-right tabular-nums';

export default async function QuotesPage() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const last48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const last90d = new Date(Date.now() - SOURCE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [
    quotes,
    monthCount,
    todayCount,
    acceptedCount,
    requireReviewCount,
    agentInbox,
    sourceRows,
    windowCount,
  ] = await Promise.all([
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
    // Agent quick-form submissions in the last 48h that haven't been
    // converted to a deal yet — these are the live SLA queue.
    database.quoteRequest.findMany({
      where: {
        source: 'agent_quick_form',
        createdAt: { gte: last48h },
        status: { in: ['quoted', 'processing'] },
      },
      include: { offer: true },
      orderBy: { createdAt: 'asc' },
    }),
    // Which advert, search or site each recent enquiry came from. Null
    // until the QuoteRequestSource table exists (see lead-source-queries).
    loadSourceRows(last90d),
    database.quoteRequest.count({ where: { createdAt: { gte: last90d } } }),
  ]);

  const sources = sourceRows
    ? summariseLeadSources(sourceRows, windowCount)
    : null;
  const channels = await loadChannels(quotes.map((q) => q.id));

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

        {/* Agent inbox — live SLA queue for /save-the-sale submissions */}
        {agentInbox.length > 0 && (
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-700">
                  Agent inbox · 24-hour signed-PDF SLA
                </p>
                <h2 className="mt-1 font-semibold text-lg">
                  {agentInbox.length} agent submission{agentInbox.length === 1 ? '' : 's'} awaiting signed PDF
                </h2>
              </div>
            </div>
            <ul className="space-y-2">
              {agentInbox.map((q) => {
                const sla = slaCountdown(q.createdAt);
                const trigger = extractTrigger(q.notes);
                return (
                  <li
                    key={q.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Link
                          href={`/quotes/${q.id}`}
                          className="font-medium hover:underline"
                        >
                          {q.address}, {q.postcode}
                        </Link>
                        {trigger && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                            {trigger}
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {q.firmName ?? 'Unknown firm'} · {q.contactName} ·{' '}
                        {q.contactEmail}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {q.offer && (
                        <p className="font-medium text-sm">
                          {formatGBP(q.offer.offerPence)}
                        </p>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest ${SLA_TONE[sla.tone]}`}
                      >
                        {sla.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

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

        {/* Where enquiries came from: which advert, search or site. Counted
            from the source saved on each enquiry, so it includes visitors
            who refused cookies, which Google's and Meta's own numbers don't. */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="px-5 pt-5 pb-3">
            <p className="text-muted-foreground text-xs uppercase tracking-widest">
              Where enquiries came from · last {SOURCE_WINDOW_DAYS} days
            </p>
            {!sources && (
              <p className="mt-3 text-sm">
                <strong>Not switched on yet.</strong> The database needs one
                update first: run <code>pnpm migrate</code>. Enquiries are
                still being saved as normal.
              </p>
            )}
            {sources && sources.channels.length === 0 && (
              <p className="mt-3 text-sm">
                <strong>Nothing recorded yet.</strong> Each new enquiry from
                the website now saves where the person came from. It will
                show here.
              </p>
            )}
          </div>
          {sources && sources.channels.length > 0 && (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-muted-foreground text-xs uppercase tracking-widest">
                <tr>
                  <th className="px-5 py-2.5 text-left">Source</th>
                  <th className={SOURCE_TH}>Enquiries</th>
                  <th className={SOURCE_TH}>Offer accepted</th>
                  <th className={SOURCE_TH}>Became a deal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sources.channels.map((c) => (
                  <tr key={c.channel}>
                    <td className="px-5 py-2.5 font-medium">{c.label}</td>
                    <td className={SOURCE_TD}>{c.enquiries}</td>
                    <td className={SOURCE_TD}>{c.accepted}</td>
                    <td className={SOURCE_TD}>{c.deals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {sources && sources.adverts.length > 0 && (
            <table className="min-w-full divide-y divide-slate-200 border-slate-200 border-t text-sm">
              <thead className="bg-slate-50 text-muted-foreground text-xs uppercase tracking-widest">
                <tr>
                  <th className="px-5 py-2.5 text-left">Campaign · advert</th>
                  <th className={SOURCE_TH}>Enquiries</th>
                  <th className={SOURCE_TH}>Offer accepted</th>
                  <th className={SOURCE_TH}>Became a deal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sources.adverts.map((a) => (
                  <tr key={`${a.channel}|${a.campaign}|${a.advert ?? ''}`}>
                    <td className="px-5 py-2.5">
                      <span className="font-medium">
                        {a.campaign}
                        {a.advert ? ` · ${a.advert}` : ''}
                      </span>
                      <span className="ml-2 text-muted-foreground text-xs">
                        {a.label}
                      </span>
                    </td>
                    <td className={SOURCE_TD}>{a.enquiries}</td>
                    <td className={SOURCE_TD}>{a.accepted}</td>
                    <td className={SOURCE_TD}>{a.deals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {sources && (
            <div className="space-y-1 border-slate-200 border-t px-5 py-3 text-muted-foreground text-xs">
              {sources.notRecorded > 0 && (
                <p>
                  {sources.notRecorded} more{' '}
                  {sources.notRecorded === 1
                    ? 'enquiry has'
                    : 'enquiries have'}{' '}
                  no source. They arrived before this was switched on, or not
                  through the website.
                </p>
              )}
              <p>
                <strong>Facebook / Instagram</strong> means an advert or a
                post. They look the same until the ad&rsquo;s link is tagged.
              </p>
              {sources.channels.length > 0 && sources.adverts.length === 0 && (
                <p>
                  No advert names yet. Those need tags on each ad&rsquo;s link.
                </p>
              )}
            </div>
          )}
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
                  <th className="px-5 py-3 text-right">Came from</th>
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
                        {/* The advert, search or site when we know it; the
                            form it came through when we don't. */}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {leadChannelLabel(channels?.get(q.id)) ??
                            q.source.replace(/_/g, ' ')}
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

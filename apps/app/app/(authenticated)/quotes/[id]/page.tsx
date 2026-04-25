import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { database } from '@repo/database';
import { Header } from '../../components/header';
import { QuoteActions } from './quote-actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const q = await database.quoteRequest.findUnique({
    where: { id },
    select: { address: true },
  });
  return {
    title: q ? `${q.address} — Quote` : 'Quote not found',
  };
}

const KIND_LABEL: Record<string, string> = {
  quote_requested: 'Quote received',
  offer_sent: 'Offer issued',
  offer_accepted: 'Offer accepted',
  offer_declined: 'Offer declined',
  offer_expired: 'Offer expired',
  solicitor_instructed: 'Solicitor instructed',
  searches_ordered: 'Searches ordered',
  survey_scheduled: 'Survey scheduled',
  survey_completed: 'Survey completed',
  enquiries_raised: 'Enquiries raised',
  enquiries_resolved: 'Enquiries resolved',
  exchange_target_set: 'Exchange target',
  exchanged: 'Contracts exchanged',
  completion_target_set: 'Completion target',
  completed: 'Completion confirmed',
  delay: 'Delay',
  founder_review: 'Founder review',
  resale_listed: 'Resale listed',
  note: 'Update',
};

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

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const quote = await database.quoteRequest.findUnique({
    where: { id },
    include: { offer: true, trackToken: true },
  });

  if (!quote) notFound();

  const [updates, agent] = await Promise.all([
    database.dealUpdate.findMany({
      where: { quoteRequestId: id },
      orderBy: { createdAt: 'desc' },
    }),
    quote.referralCode
      ? database.agentAccount.findUnique({
          where: { referralCode: quote.referralCode },
        })
      : Promise.resolve(null),
  ]);

  const trackUrl = quote.trackToken
    ? `${process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001'}/track/${quote.trackToken.token}`
    : null;

  const reasoning = Array.isArray(quote.offer?.reasoning)
    ? (quote.offer.reasoning as unknown[]).filter(
        (x): x is string => typeof x === 'string',
      )
    : [];

  return (
    <>
      <Header
        pages={[{ title: 'Quotes', url: '/quotes' }]}
        page={quote.address}
      />
      <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-semibold text-2xl tracking-tight">
              {quote.address}
            </h1>
            <p className="text-muted-foreground text-sm">
              {quote.postcode}
              {quote.bedrooms ? ` · ${quote.bedrooms} bed` : ''}
              {quote.propertyType
                ? ` · ${quote.propertyType.replace(/_/g, ' ')}`
                : ''}
              {quote.sellerSituation
                ? ` · ${quote.sellerSituation.replace(/_/g, ' ')}`
                : ''}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${STATUS_TONE[quote.status] ?? 'bg-slate-100 text-slate-600'}`}
            >
              {quote.status.replace(/_/g, ' ')}
            </span>
            {trackUrl && (
              <a
                href={trackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-blue-700 underline underline-offset-4 hover:text-blue-900"
              >
                {trackUrl}
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          {/* LEFT — offer + timeline */}
          <div className="space-y-6">
            {/* Offer card */}
            {quote.offer ? (
              <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/40 p-6">
                <p className="text-muted-foreground text-xs uppercase tracking-widest">
                  Offer
                </p>
                <p className="mt-2 font-serif text-5xl font-semibold text-slate-900">
                  {formatGBP(quote.offer.offerPence)}
                </p>
                <p className="mt-2 text-muted-foreground text-sm">
                  AVM range {formatGBP(quote.offer.estimatedMarketValueMinPence)}{' '}
                  – {formatGBP(quote.offer.estimatedMarketValueMaxPence)} ·{' '}
                  {Math.round(quote.offer.offerPercentOfAvm * 100)}% of AVM mid ·
                  confidence {Math.round(quote.offer.confidenceScore * 100)}% ·{' '}
                  {quote.offer.completionDays}d
                </p>
                <p className="mt-4 text-xs text-slate-600">
                  Locked until{' '}
                  {quote.offer.lockedUntil.toLocaleString('en-GB', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  })}
                  {quote.offer.acceptedAt
                    ? ` · accepted ${quote.offer.acceptedAt.toLocaleString('en-GB')}`
                    : ''}
                </p>

                {reasoning.length > 0 && (
                  <details className="mt-5 rounded-xl border border-amber-200 bg-white p-4">
                    <summary className="cursor-pointer text-sm font-medium">
                      Reasoning ({reasoning.length} lines)
                    </summary>
                    <ul className="mt-3 space-y-1 text-sm text-slate-700">
                      {reasoning.map((line, i) => (
                        <li key={i}>· {line}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
                <p className="text-muted-foreground">
                  No offer generated. Quote status is{' '}
                  <strong>{quote.status}</strong>.
                </p>
              </div>
            )}

            {/* Founder actions */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold">Founder actions</h2>
              <p className="mt-1 text-muted-foreground text-sm">
                Triggers a deal-update event and emails the chain.
              </p>
              <div className="mt-4">
                <QuoteActions
                  quoteRequestId={quote.id}
                  hasOffer={Boolean(quote.offer)}
                  status={quote.status}
                />
              </div>
            </div>

            {/* Timeline */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold">Timeline</h2>
              {updates.length === 0 ? (
                <p className="mt-3 text-muted-foreground text-sm">
                  No deal updates yet.
                </p>
              ) : (
                <ol className="mt-4 space-y-4 border-l-2 border-slate-200 pl-5">
                  {updates.map((u, i) => (
                    <li key={u.id} className="relative">
                      <span
                        className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 ${
                          i === 0
                            ? 'border-amber-500 bg-amber-500'
                            : 'border-slate-300 bg-white'
                        }`}
                      />
                      <p className="text-xs uppercase tracking-widest text-amber-700">
                        {KIND_LABEL[u.kind] ?? u.kind}
                      </p>
                      <p className="mt-1 font-medium">{u.title}</p>
                      {u.detail && (
                        <p className="mt-1 text-sm text-slate-600">
                          {u.detail}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {u.createdAt.toLocaleString('en-GB', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                        {u.notifiedTo.length > 0 && (
                          <>
                            {' · notified '}
                            {u.notifiedTo.length} recipient
                            {u.notifiedTo.length === 1 ? '' : 's'}
                          </>
                        )}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          {/* RIGHT — submitter / agent / metadata */}
          <aside className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-muted-foreground text-xs uppercase tracking-widest">
                Submitter
              </p>
              <p className="mt-2 font-serif text-xl">{quote.contactName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <a
                  href={`mailto:${quote.contactEmail}`}
                  className="hover:text-blue-700 hover:underline"
                >
                  {quote.contactEmail}
                </a>
              </p>
              {quote.contactPhone && (
                <p className="mt-1 text-sm text-muted-foreground">
                  <a
                    href={`tel:${quote.contactPhone}`}
                    className="hover:text-blue-700 hover:underline"
                  >
                    {quote.contactPhone}
                  </a>
                </p>
              )}
              <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
                Role
              </p>
              <p className="mt-1 capitalize">{quote.role}</p>
              {quote.firmName && (
                <>
                  <p className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">
                    Firm
                  </p>
                  <p className="mt-1">{quote.firmName}</p>
                </>
              )}
            </div>

            {agent && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6">
                <p className="text-muted-foreground text-xs uppercase tracking-widest">
                  Linked partner agent
                </p>
                <p className="mt-2 font-serif text-lg">{agent.firmName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {agent.contactName} · {agent.email}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Tier:{' '}
                  <span className="capitalize font-medium text-amber-800">
                    {agent.tier}
                  </span>{' '}
                  · {agent.totalReferrals} referrals · {agent.totalDeals} deals
                </p>
                <p className="mt-2 font-mono text-xs text-amber-800">
                  {agent.referralCode}
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm">
              <p className="text-muted-foreground text-xs uppercase tracking-widest">
                Metadata
              </p>
              <dl className="mt-3 space-y-1.5">
                <Row label="Source" value={quote.source.replace(/_/g, ' ')} />
                <Row
                  label="Submitted"
                  value={quote.createdAt.toLocaleString('en-GB')}
                />
                <Row
                  label="Updated"
                  value={quote.updatedAt.toLocaleString('en-GB')}
                />
                <Row
                  label="Condition"
                  value={
                    typeof quote.condition === 'number'
                      ? `${quote.condition}/10`
                      : '—'
                  }
                />
                <Row
                  label="Asking price"
                  value={formatGBP(quote.askingPricePence)}
                />
                <Row
                  label="Urgency"
                  value={
                    quote.urgencyDays ? `${quote.urgencyDays} days` : '—'
                  }
                />
                {quote.referralCode && (
                  <Row label="Referral code" value={quote.referralCode} />
                )}
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm">
              <p className="text-muted-foreground text-xs uppercase tracking-widest">
                Public artifacts
              </p>
              <div className="mt-3 space-y-2">
                {trackUrl && (
                  <Link
                    href={trackUrl}
                    target="_blank"
                    className="block text-blue-700 underline underline-offset-4 hover:text-blue-900"
                  >
                    Live timeline →
                  </Link>
                )}
                <a
                  href={`${process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001'}/instant-offer/offer/${quote.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-700 underline underline-offset-4 hover:text-blue-900"
                >
                  Offer certificate →
                </a>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

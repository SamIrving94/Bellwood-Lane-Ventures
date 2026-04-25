// Public deal-timeline page. No login. Anyone with the link sees every
// update in real time. This is the transparency moat made literal.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { database } from '@repo/database';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const t = await database.trackToken.findUnique({
    where: { token },
    include: { quoteRequest: true, deal: true },
  });
  const property =
    t?.quoteRequest?.address ?? t?.deal?.address ?? 'your property';
  return {
    title: `Live timeline · ${property} · Bellwoods Lane`,
    robots: 'noindex',
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

function formatGBP(pence: number) {
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const trackToken = await database.trackToken.findUnique({
    where: { token },
    include: {
      quoteRequest: { include: { offer: true } },
      deal: true,
    },
  });

  if (!trackToken) notFound();

  // Bump view count + last viewed
  await database.trackToken
    .update({
      where: { id: trackToken.id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    })
    .catch(() => undefined);

  const updates = await database.dealUpdate.findMany({
    where: {
      OR: [
        trackToken.quoteRequestId
          ? { quoteRequestId: trackToken.quoteRequestId }
          : { id: '__none__' },
        trackToken.dealId ? { dealId: trackToken.dealId } : { id: '__none__' },
      ],
      visibility: 'public',
    },
    orderBy: { createdAt: 'desc' },
  });

  const property = trackToken.quoteRequest
    ? {
        address: trackToken.quoteRequest.address,
        postcode: trackToken.quoteRequest.postcode,
      }
    : trackToken.deal
      ? {
          address: trackToken.deal.address,
          postcode: trackToken.deal.postcode,
        }
      : null;

  const offer = trackToken.quoteRequest?.offer;

  return (
    <main className="min-h-screen bg-[#FAFAF7] px-6 py-16 md:px-12 md:py-24">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/instant-offer"
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500 transition hover:text-[#0A2540]"
        >
          <span aria-hidden>←</span> bellwoodslane.co.uk
        </Link>

        <p className="mt-12 font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
          Live timeline · transparent
        </p>
        <h1
          className="mt-3 font-serif font-semibold leading-[1.05] tracking-[-0.025em] text-[#0A1020]"
          style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}
        >
          {property?.address ?? 'Your sale'}
        </h1>
        {property && (
          <p className="mt-2 font-mono text-[12px] text-slate-500">
            {property.postcode}
          </p>
        )}

        {/* Headline offer card */}
        {offer && (
          <div className="mt-10 rounded-2xl border-2 border-[#C6A664]/40 bg-[#FAF6EA] p-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
              Cash offer
            </p>
            <p className="mt-2 font-serif text-[48px] font-semibold leading-none tracking-[-0.025em] text-[#0A2540] md:text-[64px]">
              {formatGBP(offer.offerPence)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 font-mono text-[12px]">
              <span className="text-slate-500">
                Locked until{' '}
                {offer.lockedUntil.toLocaleString('en-GB', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-[#0A1020]">
                Target {offer.completionDays} days to completion
              </span>
            </div>
          </div>
        )}

        {/* Live status pill */}
        <div className="mt-10 flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1F6B3A] opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1F6B3A]" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-600">
            Live · refresh any time to see new events
          </span>
        </div>

        {/* Timeline */}
        <ol className="mt-10 space-y-0 border-l-2 border-slate-200">
          {updates.length === 0 ? (
            <li className="ml-6 py-6 text-sm text-slate-500">
              No updates yet. New events will appear here as the deal
              progresses.
            </li>
          ) : (
            updates.map((u, i) => (
              <li
                key={u.id}
                className={`relative ml-6 ${i === 0 ? 'pb-8' : 'py-8'}`}
              >
                <span
                  className={`absolute -left-[33px] top-8 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                    i === 0
                      ? 'border-[#C6A664] bg-[#C6A664]'
                      : 'border-slate-300 bg-[#FAFAF7]'
                  }`}
                >
                  {i === 0 && (
                    <span className="block h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </span>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#C6A664]">
                  {KIND_LABEL[u.kind] ?? u.kind}
                </p>
                <h2 className="mt-2 font-serif text-2xl font-semibold leading-tight">
                  {u.title}
                </h2>
                {u.detail && (
                  <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
                    {u.detail}
                  </p>
                )}
                <p className="mt-3 font-mono text-[11px] text-slate-500">
                  {u.createdAt.toLocaleString('en-GB', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  })}
                </p>
              </li>
            ))
          )}
        </ol>

        <hr className="my-16 border-slate-200" />

        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
            Why this page exists
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-700">
            Most cash buyers go silent between offer and completion. We
            don&rsquo;t. Every party in the chain — seller, agent,
            solicitor — sees this same timeline at the same moment.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-700">
            If anything looks wrong, reply to any of our emails or contact{' '}
            <a
              href="mailto:anthony@bellwoodslane.co.uk"
              className="text-[#0A2540] underline"
            >
              anthony@bellwoodslane.co.uk
            </a>
            .
          </p>
        </section>

        <p className="mt-12 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">
          Bellwoods Lane Ltd · NAPB · TPO · HMRC AML supervised
        </p>
      </div>
    </main>
  );
}

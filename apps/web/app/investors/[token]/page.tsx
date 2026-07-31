// Public, token-gated investor feed. No login — the link alone grants
// read-only access. Deliberately a numbers-and-location view: seller PII and
// Kept's own economics (our offer, margin, pass reason, sourcing fee) are
// NEVER selected here.

import { Eyebrow } from '@/components/brand';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sourced deals · Kept',
  robots: 'noindex',
};

function formatGBP(pence: number | null): string {
  if (pence === null) return '–';
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

export default async function InvestorFeedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const access = await database.investorAccessToken.findUnique({
    where: { token },
    select: { id: true, label: true, revoked: true },
  });

  if (!access || access.revoked) notFound();

  // Best-effort view tracking — never block the render on it.
  await database.investorAccessToken
    .update({
      where: { id: access.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    })
    .catch(() => {});

  const deals = await database.deal.findMany({
    where: { releasedForResale: true },
    orderBy: { releasedAt: 'desc' },
    select: {
      id: true,
      postcode: true,
      propertyType: true,
      bedrooms: true,
      sellerType: true,
      estimatedMarketValuePence: true,
      resalePricePence: true,
      releasedAt: true,
    },
  });

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div>
        <p className="font-serif text-[13px] text-body italic">
          Kept · Sourced deals
        </p>
        <h1 className="mt-1 font-semibold font-serif text-2xl text-forest tracking-tight">
          Sourced deals
        </h1>
        <p className="mt-2 max-w-2xl text-body text-sm">
          Off-market deals we&apos;ve sourced and are offering to investors.
          {deals.length} live{' '}
          {deals.length === 1 ? 'opportunity' : 'opportunities'}. Shared with{' '}
          <span className="font-medium text-forest">{access.label}</span>. To
          register interest in any deal, reply to the email this link came from.
        </p>
      </div>

      {deals.length === 0 ? (
        <div className="rounded-md border border-hair border-dashed bg-white p-8 text-center text-body text-sm">
          No live deals right now. New opportunities will appear here.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {deals.map((d) => {
            const discount =
              d.resalePricePence !== null &&
              d.estimatedMarketValuePence !== null &&
              d.estimatedMarketValuePence > 0
                ? ((d.estimatedMarketValuePence - d.resalePricePence) /
                    d.estimatedMarketValuePence) *
                  100
                : null;
            return (
              <div
                key={d.id}
                className="rounded-md border border-hair bg-white p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{d.postcode}</p>
                    <p className="text-body/80 text-xs capitalize">
                      {d.propertyType}
                      {d.bedrooms ? ` · ${d.bedrooms} bed` : ''} ·{' '}
                      {d.sellerType.replace('_', ' ')}
                    </p>
                  </div>
                  {discount !== null && discount > 0 && (
                    <span className="shrink-0 rounded-full border border-leaf/30 bg-leaf/10 px-2 py-0.5 font-medium text-[10px] text-leaf">
                      {discount.toFixed(0)}% below EMV
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 border-hair border-t pt-3">
                  <div>
                    <Eyebrow tone="muted" className="text-[9px]">
                      Market value
                    </Eyebrow>
                    <p className="font-semibold text-sm tabular-nums [font-family:var(--font-courier)]">
                      {formatGBP(d.estimatedMarketValuePence)}
                    </p>
                  </div>
                  <div>
                    <Eyebrow tone="muted" className="text-[9px]">
                      Price
                    </Eyebrow>
                    <p className="font-semibold text-sm tabular-nums [font-family:var(--font-courier)]">
                      {formatGBP(d.resalePricePence)}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-[10px] text-body/70">
                  Listed{' '}
                  {d.releasedAt
                    ? new Date(d.releasedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '–'}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <p className="border-hair border-t pt-4 text-center text-[11px] text-body/70">
        Private link · not for redistribution · Kept
      </p>
    </main>
  );
}

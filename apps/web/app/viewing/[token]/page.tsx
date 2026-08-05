// Field-partner viewing report. Token-gated like the investor feed — the
// link alone grants access, no account. Built to be filled on a phone while
// walking the property. Vendor PII beyond the address is never shown.

import { database } from '@repo/database';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ViewingForm } from './viewing-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Viewing report · Kept',
  robots: 'noindex',
};

export default async function ViewingReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const viewing = await database.viewing.findUnique({
    where: { token },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      accessNotes: true,
      submittedAt: true,
      partner: { select: { name: true } },
      deal: {
        select: {
          address: true,
          postcode: true,
          propertyType: true,
          bedrooms: true,
        },
      },
    },
  });

  if (!viewing || viewing.status === 'cancelled') notFound();

  const done = viewing.status === 'submitted' || viewing.status === 'reviewed';

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 p-4 pb-16 sm:p-6">
      <div>
        <p className="font-serif text-[13px] text-neutral-500 italic">
          Kept · Viewing report
        </p>
        <h1 className="mt-1 font-semibold text-2xl tracking-tight">
          {viewing.deal.address}
        </h1>
        <p className="mt-1 text-neutral-600 text-sm">
          {viewing.deal.postcode} · {viewing.deal.propertyType}
          {viewing.deal.bedrooms ? ` · ${viewing.deal.bedrooms} bed` : ''}
        </p>
        {viewing.scheduledAt && !done && (
          <p className="mt-2 text-neutral-600 text-sm">
            Booked for{' '}
            <span className="font-medium text-neutral-900">
              {viewing.scheduledAt.toLocaleString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </p>
        )}
      </div>

      {viewing.accessNotes && !done && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
          <p className="font-medium">Access</p>
          <p className="mt-1 whitespace-pre-wrap">{viewing.accessNotes}</p>
        </div>
      )}

      {done ? (
        <div className="rounded-xl border bg-neutral-50 p-8 text-center">
          <p className="text-2xl">✅</p>
          <p className="mt-2 font-medium">Report received — thank you.</p>
          <p className="mt-1 text-neutral-600 text-sm">
            {viewing.partner?.name ? `${viewing.partner.name}, w` : 'W'}e have
            it
            {viewing.submittedAt
              ? ` (${viewing.submittedAt.toLocaleString('en-GB')})`
              : ''}
            . We&apos;ll be in touch about the next one.
          </p>
        </div>
      ) : (
        <ViewingForm token={token} />
      )}

      <p className="border-t pt-4 text-center text-[11px] text-neutral-400">
        Private link · not for redistribution · Kept
      </p>
    </main>
  );
}

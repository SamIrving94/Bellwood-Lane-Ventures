import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Header } from '../../components/header';

export const metadata: Metadata = {
  title: 'Lead Detail — Bellwood Ventures',
};

function formatGBP(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

const verdictColors: Record<string, string> = {
  STRONG: 'bg-emerald-100 text-emerald-800',
  VIABLE: 'bg-blue-100 text-blue-800',
  THIN: 'bg-amber-100 text-amber-800',
  PASS: 'bg-red-100 text-red-800',
  INSUFFICIENT_DATA: 'bg-gray-100 text-gray-800',
};

const LeadDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const { id } = await params;

  const lead = await database.scoutLead.findUnique({
    where: { id },
  });

  if (!lead) {
    notFound();
  }

  return (
    <>
      <Header
        pages={[{ title: 'Leads', url: '/leads' }]}
        page={lead.address}
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold">{lead.address}</h1>
            <p className="text-sm text-muted-foreground">{lead.postcode}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                verdictColors[lead.verdict] || ''
              }`}
            >
              {lead.verdict}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs capitalize">
              {lead.leadType.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Scoring */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Lead Score</p>
            <p className="text-2xl font-bold">{lead.leadScore}/100</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Estimated Equity</p>
            <p className="text-2xl font-bold">
              {lead.estimatedEquityPence
                ? formatGBP(lead.estimatedEquityPence)
                : '—'}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Market Trend</p>
            <p className="text-2xl font-bold capitalize">
              {lead.marketTrend || '—'}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="text-2xl font-bold capitalize">{lead.status}</p>
          </div>
        </div>

        {/* Contact */}
        {(lead.contactName || lead.contactEmail || lead.contactPhone) && (
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Contact Info
            </h2>
            <div className="space-y-1 text-sm">
              {lead.contactName && <p className="font-medium">{lead.contactName}</p>}
              {lead.contactEmail && <p>{lead.contactEmail}</p>}
              {lead.contactPhone && <p>{lead.contactPhone}</p>}
            </div>
          </div>
        )}

        {/* Source trail */}
        {lead.sourceTrail && (
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Source Trail
            </h2>
            <p className="text-sm">{lead.sourceTrail}</p>
          </div>
        )}

        {/* Metadata */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Metadata
          </h2>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Source: </span>
              <span>{lead.source}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Run Date: </span>
              <span>
                {new Date(lead.runDate).toLocaleDateString('en-GB')}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Created: </span>
              <span>
                {new Date(lead.createdAt).toLocaleDateString('en-GB')}
              </span>
            </div>
            {lead.convertedDealId && (
              <div>
                <span className="text-muted-foreground">Converted to: </span>
                <a
                  href={`/deals/${lead.convertedDealId}`}
                  className="font-medium hover:underline"
                >
                  View Deal
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Convert to deal button */}
        {lead.status === 'new' && (
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Convert to Deal
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default LeadDetailPage;

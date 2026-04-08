import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Header } from '../../components/header';

export const metadata: Metadata = {
  title: 'Deal Detail — Bellwood Ventures',
};

function formatGBP(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

const DealDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const { id } = await params;

  const deal = await database.deal.findUnique({
    where: { id },
    include: {
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      legalSteps: {
        orderBy: { createdAt: 'asc' },
      },
      legalDocuments: {
        orderBy: { createdAt: 'desc' },
      },
      avmResults: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!deal) {
    notFound();
  }

  const latestAvm = deal.avmResults[0];

  return (
    <>
      <Header
        pages={[{ title: 'Pipeline', url: '/pipeline' }]}
        page={deal.address}
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold">{deal.address}</h1>
            <p className="text-sm text-muted-foreground">
              {deal.postcode} &middot; {deal.propertyType}
              {deal.bedrooms && ` &middot; ${deal.bedrooms} bed`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-muted px-3 py-1 text-xs capitalize">
              {deal.status.replace('_', ' ')}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs capitalize">
              {deal.sellerType.replace('_', ' ')}
            </span>
            {deal.verdict && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  deal.verdict === 'STRONG'
                    ? 'bg-emerald-100 text-emerald-800'
                    : deal.verdict === 'VIABLE'
                      ? 'bg-blue-100 text-blue-800'
                      : deal.verdict === 'THIN'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                }`}
              >
                {deal.verdict}
              </span>
            )}
          </div>
        </div>

        {/* Financials + Contact */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Asking Price</p>
            <p className="text-xl font-bold">
              {deal.askingPricePence
                ? formatGBP(deal.askingPricePence)
                : '—'}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Our Offer</p>
            <p className="text-xl font-bold">
              {deal.ourOfferPence ? formatGBP(deal.ourOfferPence) : '—'}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">EMV</p>
            <p className="text-xl font-bold">
              {deal.estimatedMarketValuePence
                ? formatGBP(deal.estimatedMarketValuePence)
                : '—'}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Margin</p>
            <p className="text-xl font-bold">
              {deal.marginPercent ? `${deal.marginPercent.toFixed(1)}%` : '—'}
            </p>
          </div>
        </div>

        {/* Seller contact */}
        {(deal.sellerName || deal.sellerEmail || deal.sellerPhone) && (
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Seller Contact
            </h2>
            <div className="space-y-1 text-sm">
              {deal.sellerName && <p className="font-medium">{deal.sellerName}</p>}
              {deal.sellerEmail && <p>{deal.sellerEmail}</p>}
              {deal.sellerPhone && <p>{deal.sellerPhone}</p>}
            </div>
          </div>
        )}

        {/* AVM Result */}
        {latestAvm && (
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Latest Valuation
            </h2>
            <div className="flex items-center gap-4 text-sm">
              <span>Risk Score: <strong>{latestAvm.riskScore}/100</strong></span>
              <span className="text-muted-foreground">
                Run {new Date(latestAvm.createdAt).toLocaleDateString('en-GB')}
              </span>
            </div>
          </div>
        )}

        {/* Legal steps */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Legal Progress
          </h2>
          {deal.legalSteps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No legal steps tracked yet.
            </p>
          ) : (
            <div className="space-y-2">
              {deal.legalSteps.map((step) => (
                <div
                  key={step.id}
                  className="flex items-center gap-3 text-sm"
                >
                  <div
                    className={`h-3 w-3 rounded-full ${
                      step.completed ? 'bg-green-500' : 'bg-muted'
                    }`}
                  />
                  <span className={step.completed ? '' : 'text-muted-foreground'}>
                    {step.stepKey.replace(/_/g, ' ')}
                  </span>
                  {step.completedAt && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(step.completedAt).toLocaleDateString('en-GB')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        {deal.notes && (
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Notes
            </h2>
            <p className="whitespace-pre-wrap text-sm">{deal.notes}</p>
          </div>
        )}

        {/* Activity log */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Activity
          </h2>
          {deal.activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activity recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {deal.activities.map((a) => (
                <div key={a.id} className="flex gap-3 text-sm">
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleDateString('en-GB')}
                  </span>
                  <div>
                    <span className="font-medium capitalize">
                      {a.action.replace('_', ' ')}
                    </span>
                    {a.detail && (
                      <p className="text-muted-foreground">{a.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default DealDetailPage;

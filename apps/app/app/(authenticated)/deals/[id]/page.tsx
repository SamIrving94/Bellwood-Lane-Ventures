import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Header } from '../../components/header';
import { FeedbackPanel } from '../../components/feedback-panel';

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
  if (!userId) redirect('/sign-in');

  const { id } = await params;

  const [deal, agentEvents, existingDealFeedback, existingAvmFeedback] = await Promise.all([
    database.deal.findUnique({
      where: { id },
      include: {
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
        legalSteps: { orderBy: { createdAt: 'asc' } },
        legalDocuments: { orderBy: { createdAt: 'desc' } },
        avmResults: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    database.agentEvent.findMany({
      where: { dealId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    database.founderFeedback.findFirst({
      where: { targetType: 'deal', targetId: id },
      orderBy: { createdAt: 'desc' },
    }),
    database.founderFeedback.findFirst({
      where: { targetType: 'avm_result', targetId: id },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!deal) notFound();

  const latestAvm = deal.avmResults[0];

  // Merge human activities + agent events into unified timeline
  const timeline = [
    ...deal.activities.map((a) => ({
      id: a.id,
      type: 'human' as const,
      action: a.action,
      detail: a.detail,
      createdAt: a.createdAt,
      agent: null as string | null,
    })),
    ...agentEvents.map((e) => ({
      id: e.id,
      type: 'agent' as const,
      action: e.eventType,
      detail: e.summary,
      createdAt: e.createdAt,
      agent: e.agent,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Golden window calculation
  const goldenWindowDays = deal.goldenWindowExpiresAt
    ? Math.ceil((new Date(deal.goldenWindowExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const mortgageDays = deal.mortgageExpiryDate
    ? Math.ceil((new Date(deal.mortgageExpiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // Parse suggested next action
  let suggestedAction: { action: string; reasoning: string; agent: string } | null = null;
  try {
    if (deal.suggestedNextAction) {
      suggestedAction = JSON.parse(deal.suggestedNextAction);
    }
  } catch {
    // ignore parse errors
  }

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
              {deal.bedrooms ? ` &middot; ${deal.bedrooms} bed` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-muted px-3 py-1 text-xs capitalize">
              {deal.status.replace(/_/g, ' ')}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs capitalize">
              {deal.sellerType.replace('_', ' ')}
            </span>
            {deal.verdict && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  deal.verdict === 'STRONG'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                    : deal.verdict === 'VIABLE'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400'
                      : deal.verdict === 'THIN'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400'
                }`}
              >
                {deal.verdict}
              </span>
            )}
          </div>
        </div>

        {/* Golden Window / Mortgage Expiry Alert */}
        {(goldenWindowDays !== null || mortgageDays !== null) && (
          <div
            className={`rounded-lg border p-4 ${
              (goldenWindowDays !== null && goldenWindowDays <= 14) ||
              (mortgageDays !== null && mortgageDays <= 42)
                ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950'
                : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'
            }`}
          >
            <h2 className="text-sm font-medium uppercase tracking-wide text-amber-800 dark:text-amber-400">
              Golden Window
            </h2>
            <div className="mt-2 flex flex-col gap-1 text-sm">
              {goldenWindowDays !== null && (
                <p>
                  <strong className={goldenWindowDays <= 14 ? 'text-red-600' : ''}>
                    {goldenWindowDays}d remaining
                  </strong>
                  {' '} — golden window expires {new Date(deal.goldenWindowExpiresAt!).toLocaleDateString('en-GB')}
                </p>
              )}
              {mortgageDays !== null && (
                <p>
                  Vendor mortgage expires in <strong>{mortgageDays}d</strong>
                  {' '}({new Date(deal.mortgageExpiryDate!).toLocaleDateString('en-GB')})
                </p>
              )}
            </div>
          </div>
        )}

        {/* Suggested Next Action */}
        {suggestedAction && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
            <h2 className="text-sm font-medium uppercase tracking-wide text-blue-800 dark:text-blue-400">
              Suggested Next Action
            </h2>
            <p className="mt-1 text-sm font-medium">{suggestedAction.action}</p>
            <p className="mt-1 text-xs text-muted-foreground">{suggestedAction.reasoning}</p>
            <p className="mt-1 text-xs text-muted-foreground capitalize">Agent: {suggestedAction.agent}</p>
          </div>
        )}

        {/* Financials */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Asking Price</p>
            <p className="text-xl font-bold">
              {deal.askingPricePence ? formatGBP(deal.askingPricePence) : '—'}
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

        {/* AVM Result + Feedback */}
        {latestAvm && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Latest Valuation
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span>Risk Score: <strong>{latestAvm.riskScore}/100</strong></span>
                {latestAvm.evalConfigVersion && (
                  <span className="text-muted-foreground">Eval v{latestAvm.evalConfigVersion}</span>
                )}
                <span className="text-muted-foreground">
                  Run {new Date(latestAvm.createdAt).toLocaleDateString('en-GB')}
                </span>
              </div>
            </div>

            {/* Rate the valuation */}
            <FeedbackPanel
              targetType="avm_result"
              targetId={latestAvm.id}
              title="Rate this valuation"
              overrideFields={[
                {
                  key: 'estimatedMarketValuePence',
                  label: 'Estimated Value',
                  type: 'number',
                  format: 'gbp',
                  currentValue: deal.estimatedMarketValuePence,
                },
                {
                  key: 'ourOfferPence',
                  label: 'Our Offer',
                  type: 'number',
                  format: 'gbp',
                  currentValue: deal.ourOfferPence,
                },
                {
                  key: 'verdict',
                  label: 'Verdict',
                  type: 'select',
                  currentValue: deal.verdict,
                  options: [
                    { label: 'STRONG', value: 'STRONG' },
                    { label: 'VIABLE', value: 'VIABLE' },
                    { label: 'THIN', value: 'THIN' },
                    { label: 'PASS', value: 'PASS' },
                  ],
                },
              ]}
              existingFeedback={
                existingAvmFeedback
                  ? {
                      rating: existingAvmFeedback.rating,
                      notes: existingAvmFeedback.notes,
                      overrides: existingAvmFeedback.overrides as Record<string, unknown> | null,
                    }
                  : null
              }
            />
          </div>
        )}

        {/* Rate this deal overall */}
        <FeedbackPanel
          targetType="deal"
          targetId={deal.id}
          title="Rate this deal overall"
          overrideFields={[
            {
              key: 'verdict',
              label: 'Verdict',
              type: 'select',
              currentValue: deal.verdict,
              options: [
                { label: 'STRONG', value: 'STRONG' },
                { label: 'VIABLE', value: 'VIABLE' },
                { label: 'THIN', value: 'THIN' },
                { label: 'PASS', value: 'PASS' },
              ],
            },
          ]}
          existingFeedback={
            existingDealFeedback
              ? {
                  rating: existingDealFeedback.rating,
                  notes: existingDealFeedback.notes,
                  overrides: existingDealFeedback.overrides as Record<string, unknown> | null,
                }
              : null
          }
        />

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
                <div key={step.id} className="flex items-start gap-3 text-sm">
                  <div
                    className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                      step.completed ? 'bg-green-500' : 'bg-muted'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={step.completed ? '' : 'text-muted-foreground capitalize'}>
                        {step.stepKey.replace(/_/g, ' ')}
                      </span>
                      {step.completedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(step.completedAt).toLocaleDateString('en-GB')}
                        </span>
                      )}
                    </div>
                    {step.notes && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {step.notes}
                      </p>
                    )}
                  </div>
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

        {/* Unified Timeline (human + agent) */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Activity Timeline
          </h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {timeline.map((item) => (
                <div key={item.id} className="flex gap-3 text-sm">
                  <span className="shrink-0 text-xs text-muted-foreground w-16">
                    {new Date(item.createdAt).toLocaleDateString('en-GB')}
                  </span>
                  {item.type === 'agent' && (
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium capitalize dark:bg-slate-800">
                      {item.agent}
                    </span>
                  )}
                  <div className="min-w-0">
                    <span className="font-medium capitalize">
                      {item.action.replace(/_/g, ' ')}
                    </span>
                    {item.detail && (
                      <p className="text-muted-foreground truncate">{item.detail}</p>
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

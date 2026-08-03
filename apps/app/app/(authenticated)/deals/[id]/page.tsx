import { auth } from '@repo/auth/server';
import { getBookingLink } from '@repo/calendly';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { FeedbackPanel } from '../../components/feedback-panel';
import { Header } from '../../components/header';
import { DealEconomicsPanel } from './deal-economics-panel';
import { GenerateOfferButton } from './generate-offer-button';
import { InvestorPanel } from './investor-panel';
import { LegalPanel } from './legal-panel';
import { ReleaseControl } from './release-control';
import { SourcingFeePanel } from './sourcing-fee-panel';
import { DealStatusControl } from './status-control';
import { ViewingsPanel } from './viewings-panel';
import { WorksPanel } from './works-panel';

export const metadata: Metadata = {
  title: 'Deal Detail — Kept',
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

  const [
    deal,
    agentEvents,
    existingDealFeedback,
    existingAvmFeedback,
    fieldPartners,
    chaserAction,
  ] = await Promise.all([
    database.deal.findUnique({
      where: { id },
      include: {
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
        legalSteps: { orderBy: { createdAt: 'asc' } },
        legalDocuments: { orderBy: { createdAt: 'desc' } },
        avmResults: { orderBy: { createdAt: 'desc' }, take: 1 },
        investorInterests: { orderBy: { createdAt: 'desc' } },
        viewings: {
          orderBy: { createdAt: 'desc' },
          include: { partner: { select: { name: true } } },
        },
        worksProject: {
          include: {
            workOrders: {
              orderBy: { createdAt: 'asc' },
              include: { partner: { select: { name: true } } },
            },
          },
        },
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
    database.fieldPartner.findMany({
      where: { active: true },
      orderBy: { viewingsCompleted: 'desc' },
      select: { id: true, name: true, postcodeAreas: true },
    }),
    database.founderAction.findFirst({
      where: { dealId: id, type: 'legal_flag', status: 'pending' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, metadata: true },
    }),
  ]);

  if (!deal) notFound();

  const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001';

  // Chaser draft from the legal-chaser cron, if one is waiting for review.
  const chaserMeta = chaserAction?.metadata as {
    draftSubject?: string;
    draftBody?: string;
  } | null;
  const chaserDraft =
    chaserAction && chaserMeta?.draftSubject && chaserMeta?.draftBody
      ? {
          actionId: chaserAction.id,
          subject: chaserMeta.draftSubject,
          body: chaserMeta.draftBody,
        }
      : null;

  const inConveyancing =
    deal.status === 'under_offer' || deal.status === 'exchanged';
  const showWorks =
    deal.status === 'completed' || deal.acquisitionPricePence !== null;

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
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Golden window calculation
  const goldenWindowDays = deal.goldenWindowExpiresAt
    ? Math.ceil(
        (new Date(deal.goldenWindowExpiresAt).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    : null;
  const mortgageDays = deal.mortgageExpiryDate
    ? Math.ceil(
        (new Date(deal.mortgageExpiryDate).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  // Parse suggested next action
  let suggestedAction: {
    action: string;
    reasoning: string;
    agent: string;
  } | null = null;
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
            <h1 className="font-bold text-xl">{deal.address}</h1>
            <p className="text-muted-foreground text-sm">
              {deal.postcode} &middot; {deal.propertyType}
              {deal.bedrooms ? ` · ${deal.bedrooms} bed` : ''}
            </p>
            {deal.convertedFromLeadId && (
              <a
                href={`/leads/${deal.convertedFromLeadId}`}
                className="mt-1 inline-block font-medium text-primary text-xs hover:underline"
              >
                ← From scout lead (score, comps &amp; risk detail)
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DealStatusControl dealId={deal.id} status={deal.status} />
            <span className="rounded-full bg-muted px-3 py-1 text-xs capitalize">
              {deal.sellerType.replace('_', ' ')}
            </span>
            {deal.verdict && (
              <span
                className={`rounded-full px-3 py-1 font-medium text-xs ${
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
            <h2 className="font-medium text-amber-800 text-sm uppercase tracking-wide dark:text-amber-400">
              Golden Window
            </h2>
            <div className="mt-2 flex flex-col gap-1 text-sm">
              {goldenWindowDays !== null && (
                <p>
                  <strong
                    className={goldenWindowDays <= 14 ? 'text-red-600' : ''}
                  >
                    {goldenWindowDays}d remaining
                  </strong>{' '}
                  — golden window expires{' '}
                  {new Date(deal.goldenWindowExpiresAt!).toLocaleDateString(
                    'en-GB'
                  )}
                </p>
              )}
              {mortgageDays !== null && (
                <p>
                  Vendor mortgage expires in <strong>{mortgageDays}d</strong> (
                  {new Date(deal.mortgageExpiryDate!).toLocaleDateString(
                    'en-GB'
                  )}
                  )
                </p>
              )}
            </div>
          </div>
        )}

        {/* Suggested Next Action */}
        {suggestedAction && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
            <h2 className="font-medium text-blue-800 text-sm uppercase tracking-wide dark:text-blue-400">
              Suggested Next Action
            </h2>
            <p className="mt-1 font-medium text-sm">{suggestedAction.action}</p>
            <p className="mt-1 text-muted-foreground text-xs">
              {suggestedAction.reasoning}
            </p>
            <p className="mt-1 text-muted-foreground text-xs capitalize">
              Agent: {suggestedAction.agent}
            </p>
          </div>
        )}

        {/* Pass & release to investor feed (Horizon 2 guardrail) */}
        <ReleaseControl
          dealId={deal.id}
          released={deal.releasedForResale}
          reason={deal.resaleReason}
        />

        {/* Investor interest + updates (only once released) */}
        {deal.releasedForResale && (
          <>
            <InvestorPanel
              dealId={deal.id}
              interests={deal.investorInterests}
            />
            <SourcingFeePanel
              dealId={deal.id}
              fee={{
                sourcingFeePence: deal.sourcingFeePence,
                sourcingFeeStatus: deal.sourcingFeeStatus,
                sourcedToName: deal.sourcedToName,
                sourcedToEmail: deal.sourcedToEmail,
              }}
              interests={deal.investorInterests.map((i) => ({
                investorName: i.investorName,
                investorEmail: i.investorEmail,
              }))}
            />
          </>
        )}

        {/* Financials */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
              Financials
            </h2>
            <div className="flex items-center gap-3">
              <a
                href="/deals/offer-config"
                className="text-muted-foreground text-xs hover:text-foreground hover:underline"
              >
                Tune offer policy
              </a>
              <GenerateOfferButton
                dealId={deal.id}
                hasOffer={deal.ourOfferPence !== null}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-muted-foreground text-sm">Asking Price</p>
              <p className="font-bold text-xl">
                {deal.askingPricePence ? formatGBP(deal.askingPricePence) : '—'}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-muted-foreground text-sm">Our Offer</p>
              <p className="font-bold text-xl">
                {deal.ourOfferPence ? formatGBP(deal.ourOfferPence) : '—'}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-muted-foreground text-sm">EMV</p>
              <p className="font-bold text-xl">
                {deal.estimatedMarketValuePence
                  ? formatGBP(deal.estimatedMarketValuePence)
                  : '—'}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-muted-foreground text-sm">Margin</p>
              <p className="font-bold text-xl">
                {deal.marginPercent ? `${deal.marginPercent.toFixed(1)}%` : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Line 1 — trade economics / realised P&L */}
        <DealEconomicsPanel
          dealId={deal.id}
          economics={{
            acquisitionPricePence: deal.acquisitionPricePence,
            acquiredAt: deal.acquiredAt,
            refurbCostPence: deal.refurbCostPence,
            legalFeesPence: deal.legalFeesPence,
            otherCostsPence: deal.otherCostsPence,
            exitPricePence: deal.exitPricePence,
            exitedAt: deal.exitedAt,
            realisedProfitPence: deal.realisedProfitPence,
          }}
          estimatedMarketValuePence={deal.estimatedMarketValuePence}
          ourOfferPence={deal.ourOfferPence}
        />

        {/* Calendly booking status */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
            Initial Call
          </h2>
          {deal.calendlyEventAt ? (
            <p className="text-sm">
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                Call booked
              </span>{' '}
              for{' '}
              <strong>
                {new Date(deal.calendlyEventAt).toLocaleString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </strong>
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">No call yet.</p>
              <a
                href={getBookingLink(deal.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block font-medium text-primary text-xs hover:underline"
              >
                Open booking link
              </a>
            </div>
          )}
        </div>

        {/* Seller contact */}
        {(deal.sellerName || deal.sellerEmail || deal.sellerPhone) && (
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
              Seller Contact
            </h2>
            <div className="space-y-1 text-sm">
              {deal.sellerName && (
                <p className="font-medium">{deal.sellerName}</p>
              )}
              {deal.sellerEmail && <p>{deal.sellerEmail}</p>}
              {deal.sellerPhone && <p>{deal.sellerPhone}</p>}
            </div>
          </div>
        )}

        {/* AVM Result + Feedback */}
        {latestAvm && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <h2 className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
                Latest Valuation
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span>
                  Risk Score: <strong>{latestAvm.riskScore}/100</strong>
                </span>
                {latestAvm.evalConfigVersion && (
                  <span className="text-muted-foreground">
                    Eval v{latestAvm.evalConfigVersion}
                  </span>
                )}
                <span className="text-muted-foreground">
                  Run{' '}
                  {new Date(latestAvm.createdAt).toLocaleDateString('en-GB')}
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
                      overrides: existingAvmFeedback.overrides as Record<
                        string,
                        unknown
                      > | null,
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
                  overrides: existingDealFeedback.overrides as Record<
                    string,
                    unknown
                  > | null,
                }
              : null
          }
        />

        {/* Viewings — the field-partner network's eyes on the property */}
        <ViewingsPanel
          dealId={deal.id}
          dealOutwardCode={deal.postcode.split(' ')[0].toUpperCase()}
          partners={fieldPartners}
          viewings={deal.viewings.map((v) => ({
            id: v.id,
            status: v.status,
            link: `${webUrl}/viewing/${v.token}`,
            partnerName: v.partner?.name ?? null,
            scheduledAt: v.scheduledAt?.toISOString() ?? null,
            submittedAt: v.submittedAt?.toISOString() ?? null,
            conditionScores:
              (v.conditionScores as Record<string, number> | null) ?? null,
            refurbEstimatePence: v.refurbEstimatePence,
            photos: v.photos,
            vendorMotivation: v.vendorMotivation,
            summary: v.summary,
            redFlags: v.redFlags,
          }))}
        />

        {/* Legal steps — interactive checklist + panel firm + chaser drafts */}
        <LegalPanel
          dealId={deal.id}
          inConveyancing={inConveyancing}
          steps={deal.legalSteps.map((s) => ({
            id: s.id,
            stepKey: s.stepKey,
            completed: s.completed,
            completedAt: s.completedAt?.toISOString() ?? null,
            notes: s.notes,
          }))}
          solicitor={{
            solicitorFirm: deal.solicitorFirm,
            solicitorName: deal.solicitorName,
            solicitorEmail: deal.solicitorEmail,
            solicitorPhone: deal.solicitorPhone,
            solicitorRef: deal.solicitorRef,
          }}
          chaserDraft={chaserDraft}
        />

        {/* Works / refurb — only once the property is actually ours */}
        {showWorks && (
          <WorksPanel
            dealId={deal.id}
            partners={fieldPartners.map((p) => ({ id: p.id, name: p.name }))}
            project={
              deal.worksProject
                ? {
                    id: deal.worksProject.id,
                    status: deal.worksProject.status,
                    budgetPence: deal.worksProject.budgetPence,
                    targetEndAt:
                      deal.worksProject.targetEndAt?.toISOString() ?? null,
                    orders: deal.worksProject.workOrders.map((o) => ({
                      id: o.id,
                      title: o.title,
                      trade: o.trade,
                      partnerName: o.partner?.name ?? null,
                      contractorName: o.contractorName,
                      quotedPence: o.quotedPence,
                      actualPence: o.actualPence,
                      status: o.status,
                      dueAt: o.dueAt?.toISOString() ?? null,
                    })),
                  }
                : null
            }
          />
        )}

        {/* Notes */}
        {deal.notes && (
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
              Notes
            </h2>
            <p className="whitespace-pre-wrap text-sm">{deal.notes}</p>
          </div>
        )}

        {/* Unified Timeline (human + agent) */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
            Activity Timeline
          </h2>
          {timeline.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No activity recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {timeline.map((item) => (
                <div key={item.id} className="flex gap-3 text-sm">
                  <span className="w-16 shrink-0 text-muted-foreground text-xs">
                    {new Date(item.createdAt).toLocaleDateString('en-GB')}
                  </span>
                  {item.type === 'agent' && (
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-xs capitalize dark:bg-slate-800">
                      {item.agent}
                    </span>
                  )}
                  <div className="min-w-0">
                    <span className="font-medium capitalize">
                      {item.action.replace(/_/g, ' ')}
                    </span>
                    {item.detail && (
                      <p className="truncate text-muted-foreground">
                        {item.detail}
                      </p>
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

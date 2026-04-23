import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { FeedbackPanel } from '../../components/feedback-panel';
import { Header } from '../../components/header';
import { StatusButtons } from '../components/status-buttons';

export const metadata: Metadata = {
  title: 'Campaign Detail — Bellwood Ventures',
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  completed: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
  archived: 'bg-muted text-muted-foreground',
};

function formatGBP(pence?: number | null): string {
  if (!pence) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

const CampaignDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { id } = await params;

  const campaign = await database.campaign.findUnique({
    where: { id },
    include: {
      scoutLeads: {
        orderBy: { createdAt: 'desc' },
        take: 25,
      },
      outreachCampaigns: {
        include: {
          recipients: {
            include: {
              contact: { select: { name: true, type: true, email: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 20,
          },
        },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });

  if (!campaign) notFound();

  const existingFeedback = await database.founderFeedback.findFirst({
    where: { targetType: 'campaign', targetId: id },
    orderBy: { createdAt: 'desc' },
  });

  // Funnel computation — prefer live counts, fall back to stored metrics
  const sourced = campaign.scoutLeads.length || campaign.leadsFound;
  const qualified =
    campaign.scoutLeads.filter((l) => l.leadScore >= campaign.minLeadScore).length ||
    campaign.leadsQualified;
  const allRecipients = campaign.outreachCampaigns.flatMap((oc) => oc.recipients);
  const contacted =
    allRecipients.filter((r) => r.status !== 'pending').length || campaign.outreachSent;
  const replied =
    allRecipients.filter((r) => r.status === 'replied').length || campaign.replies;
  const offer = campaign.dealsCreated; // placeholder — until offer stage linked
  const dealCount = campaign.dealsCreated;

  const funnel = [
    { label: 'Sourced', value: sourced, color: 'bg-sky-500' },
    { label: 'Qualified', value: qualified, color: 'bg-indigo-500' },
    { label: 'Contacted', value: contacted, color: 'bg-violet-500' },
    { label: 'Replied', value: replied, color: 'bg-fuchsia-500' },
    { label: 'Offer', value: offer, color: 'bg-amber-500' },
    { label: 'Deal', value: dealCount, color: 'bg-emerald-500' },
  ];
  const maxValue = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <>
      <Header
        pages={[{ title: 'Campaigns', url: '/campaigns' }]}
        page={campaign.name}
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Header card */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{campaign.name}</h1>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[campaign.status] ?? STATUS_STYLES.draft}`}
                >
                  {campaign.status}
                </span>
              </div>
              <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 md:grid-cols-3">
                <p>
                  <span className="text-muted-foreground">Area: </span>
                  {campaign.postcodeArea} ({campaign.radiusMiles} mi)
                </p>
                <p>
                  <span className="text-muted-foreground">Min lead score: </span>
                  {campaign.minLeadScore}
                </p>
                <p>
                  <span className="text-muted-foreground">Daily cap: </span>
                  {campaign.dailyCap}
                </p>
                <p>
                  <span className="text-muted-foreground">Price: </span>
                  {formatGBP(campaign.minPricePence)} – {formatGBP(campaign.maxPricePence)}
                </p>
                <p>
                  <span className="text-muted-foreground">Budget: </span>
                  {formatGBP(campaign.budgetPence)}
                </p>
                <p>
                  <span className="text-muted-foreground">Target end: </span>
                  {campaign.targetEndDate
                    ? new Date(campaign.targetEndDate).toLocaleDateString('en-GB')
                    : '—'}
                </p>
                <p className="sm:col-span-2 md:col-span-3">
                  <span className="text-muted-foreground">Property types: </span>
                  {campaign.propertyTypes.join(', ') || '—'}
                </p>
                <p className="sm:col-span-2 md:col-span-3">
                  <span className="text-muted-foreground">Seller types: </span>
                  {campaign.sellerTypes.join(', ') || '—'}
                </p>
                <p className="sm:col-span-2 md:col-span-3">
                  <span className="text-muted-foreground">Outreach channels: </span>
                  {campaign.outreachChannels.join(', ') || '—'}
                </p>
              </div>
            </div>
            <StatusButtons campaignId={campaign.id} status={campaign.status} />
          </div>
        </div>

        {/* Funnel */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Funnel
          </h2>
          <div className="space-y-3">
            {funnel.map((stage) => (
              <div key={stage.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{stage.label}</span>
                  <span className="text-muted-foreground">{stage.value}</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${stage.color}`}
                    style={{
                      width: `${Math.max(2, (stage.value / maxValue) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Leads + Outreach side by side */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Live lead feed */}
          <section className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Live Lead Feed ({campaign.scoutLeads.length})
            </h2>
            {campaign.scoutLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No leads yet. Scout will populate this feed once the campaign is active.
              </p>
            ) : (
              <div className="space-y-2">
                {campaign.scoutLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-start justify-between rounded-md border bg-background p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{lead.address}</p>
                      <p className="text-xs text-muted-foreground">
                        {lead.postcode} &middot; {lead.leadType} &middot;{' '}
                        {new Date(lead.createdAt).toLocaleString('en-GB')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{lead.leadScore}</p>
                      <p className="text-xs text-muted-foreground">{lead.verdict}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Outreach activity */}
          <section className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Outreach Activity
            </h2>
            {campaign.outreachCampaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No outreach yet. Marketer will draft + queue messages once leads qualify.
              </p>
            ) : (
              <div className="space-y-4">
                {campaign.outreachCampaigns.map((oc) => (
                  <div key={oc.id} className="rounded-md border bg-background p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{oc.name}</p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                        {oc.status}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {oc.recipients.slice(0, 5).map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span>
                            {r.contact.name}{' '}
                            <span className="text-muted-foreground">
                              ({r.contact.type})
                            </span>
                          </span>
                          <span className="text-muted-foreground capitalize">
                            {r.status}
                          </span>
                        </div>
                      ))}
                      {oc.recipients.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          + {oc.recipients.length - 5} more
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Feedback */}
        <FeedbackPanel
          targetType="campaign"
          targetId={campaign.id}
          title="Rate this campaign"
          existingFeedback={
            existingFeedback
              ? {
                  rating: existingFeedback.rating,
                  notes: existingFeedback.notes,
                  overrides: existingFeedback.overrides as Record<string, unknown> | null,
                }
              : null
          }
        />
      </div>
    </>
  );
};

export default CampaignDetailPage;

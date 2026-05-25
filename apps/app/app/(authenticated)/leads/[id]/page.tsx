import { auth } from '@repo/auth/server';
import { getBookingLink } from '@repo/calendly';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Header } from '../../components/header';
import { FeedbackPanel } from '../../components/feedback-panel';
import { CalendlyButton } from './calendly-button';
import { ConvertButton } from './convert-button';

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
  STRONG: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  VIABLE: 'bg-blue-100 text-blue-800 border-blue-200',
  THIN: 'bg-amber-100 text-amber-800 border-amber-200',
  PASS: 'bg-red-100 text-red-800 border-red-200',
  INSUFFICIENT_DATA: 'bg-gray-100 text-gray-700 border-gray-200',
};

const LISTING_TYPE_LABELS: Record<string, string> = {
  'repossessed-properties': 'Repossessed',
  'quick-sale-properties': 'Quick sale',
  'reduced-properties': 'Price reduced',
  'slow-to-sell-properties': 'Stale listing',
  'derelict-properties': 'Derelict',
  'unmodernised-properties': 'Unmodernised',
  'back-on-market': 'Back on market',
  'properties-with-no-chain': 'No chain',
  'cash-buyers-only-properties': 'Cash only',
  'auction-properties': 'Auction',
  'short-lease-properties': 'Short lease',
  'poor-epc-score': 'Poor EPC',
};

const LeadDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { id } = await params;

  const [lead, existingFeedback] = await Promise.all([
    database.scoutLead.findUnique({ where: { id } }),
    database.founderFeedback.findFirst({
      where: { targetType: 'scout_lead', targetId: id },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!lead) notFound();

  // Unpack rich data from rawPayload
  const raw = (lead.rawPayload ?? {}) as Record<string, unknown>;
  const pd = raw.propertyData as Record<string, unknown> | undefined;
  const planning = raw.planning as Record<string, unknown> | undefined;
  const hmo = raw.hmo as Record<string, unknown> | undefined;

  const isPropertyData = lead.source.startsWith('propertydata_');
  const isPlanning = lead.source.startsWith('planning_');
  const isHmo = lead.source.startsWith('hmo_');

  const imageUrl = (pd?.imageUrl as string | undefined) ?? null;
  const summary = (pd?.summary as string | undefined) ?? null;
  const pricePence = (pd?.pricePence as number | undefined) ?? null;
  const originalPricePence =
    (pd?.originalPricePence as number | undefined) ?? null;
  const discountPercent =
    (pd?.discountPercent as number | undefined) ?? null;
  const bedrooms = (pd?.bedrooms as number | undefined) ?? null;
  const propertyType = (pd?.propertyType as string | undefined) ?? null;
  const daysOnMarket = (pd?.daysOnMarket as number | undefined) ?? null;
  const daysSincePriceChange =
    (pd?.daysSincePriceChange as number | undefined) ?? null;
  const preciseAddress =
    (pd?.preciseAddress as string | undefined) ?? null;
  const listingType = (pd?.listingType as string | undefined) ?? null;
  const listingUrl = (pd?.listingUrl as string | undefined) ?? null;

  const planningProposal =
    (planning?.proposal as string | undefined) ?? null;
  const planningAuthority =
    (planning?.authority as string | undefined) ?? null;
  const planningStatus = (planning?.status as string | undefined) ?? null;
  const planningDecision = (planning?.decision as string | undefined) ?? null;
  const planningRating =
    (planning?.decisionRating as string | undefined) ?? null;
  const planningReceivedAt =
    (planning?.receivedAt as string | undefined) ?? null;
  const planningDecidedAt =
    (planning?.decidedAt as string | undefined) ?? null;
  const planningUrl = (planning?.url as string | undefined) ?? null;
  const planningReference =
    (planning?.reference as string | undefined) ?? null;

  const hmoCouncil = (hmo?.council as string | undefined) ?? null;
  const hmoLicenceType = (hmo?.licenceType as string | undefined) ?? null;
  const hmoLicenceExpiry =
    (hmo?.licenceExpiry as string | undefined) ?? null;
  const hmoLicenceExpiringSoon =
    (hmo?.licenceExpiringSoon as boolean | undefined) ?? false;

  const externalUrl = listingUrl ?? planningUrl ?? null;
  const externalLabel = listingUrl
    ? listingUrl.includes('rightmove')
      ? 'View on Rightmove'
      : listingUrl.includes('zoopla')
        ? 'View on Zoopla'
        : 'View listing'
    : planningUrl
      ? 'View planning record'
      : null;

  const sourceLabel = isPropertyData
    ? listingType
      ? LISTING_TYPE_LABELS[listingType] ?? listingType
      : 'Distressed listing'
    : isPlanning
      ? `Planning · ${planningRating ?? 'pending'}`
      : isHmo
        ? hmoLicenceExpiringSoon
          ? 'HMO · licence expiring'
          : 'HMO register'
        : lead.source;

  return (
    <>
      <Header
        pages={[{ title: 'Leads', url: '/leads' }]}
        page={lead.address}
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Hero — image + price + key facts */}
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="grid gap-0 md:grid-cols-[2fr_3fr]">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={lead.address}
                className="h-64 w-full object-cover md:h-full"
              />
            ) : (
              <div className="flex h-64 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 md:h-full">
                <span className="text-sm">No image available</span>
              </div>
            )}

            <div className="p-6">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    verdictColors[lead.verdict] || ''
                  }`}
                >
                  {lead.verdict}
                </span>
                <span className="inline-flex rounded-full border border-purple-200 bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                  {sourceLabel}
                </span>
                {discountPercent && discountPercent > 0 && (
                  <span className="inline-flex rounded-full border border-orange-200 bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                    ↓ {discountPercent}% from original
                  </span>
                )}
                {typeof daysOnMarket === 'number' && daysOnMarket >= 60 && (
                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                    Stale — {daysOnMarket} days on market
                  </span>
                )}
                {hmoLicenceExpiringSoon && (
                  <span className="inline-flex rounded-full border border-rose-200 bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800">
                    HMO licence expiring soon
                  </span>
                )}
              </div>

              <h1 className="mt-3 font-semibold text-xl leading-tight">
                {preciseAddress ?? lead.address}
              </h1>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                {lead.postcode}
              </p>

              {/* Price prominent */}
              {pricePence ? (
                <div className="mt-4">
                  <p className="font-semibold text-3xl tabular-nums leading-none">
                    {formatGBP(pricePence)}
                  </p>
                  {originalPricePence && originalPricePence > pricePence && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Was{' '}
                      <span className="line-through">
                        {formatGBP(originalPricePence)}
                      </span>
                      {daysSincePriceChange !== null && (
                        <span> · reduced {daysSincePriceChange}d ago</span>
                      )}
                    </p>
                  )}
                </div>
              ) : null}

              {/* Property facts */}
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {propertyType && (
                  <div>
                    <span className="text-muted-foreground">Type: </span>
                    <span className="font-medium">{propertyType}</span>
                  </div>
                )}
                {typeof bedrooms === 'number' && (
                  <div>
                    <span className="text-muted-foreground">Bedrooms: </span>
                    <span className="font-medium">{bedrooms}</span>
                  </div>
                )}
                {typeof daysOnMarket === 'number' && (
                  <div>
                    <span className="text-muted-foreground">On market: </span>
                    <span className="font-medium">{daysOnMarket}d</span>
                  </div>
                )}
              </div>

              {/* Score + verdict block */}
              <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Lead score
                  </p>
                  <p className="font-mono font-bold text-2xl tabular-nums">
                    {lead.leadScore}
                    <span className="text-base text-muted-foreground">
                      /100
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Market trend
                  </p>
                  <p className="font-semibold text-lg capitalize">
                    {lead.marketTrend ?? '—'}
                  </p>
                </div>
              </div>

              {/* External actions */}
              <div className="mt-5 flex flex-wrap gap-2">
                {externalUrl && externalLabel && (
                  <a
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    {externalLabel}
                    <span aria-hidden>↗</span>
                  </a>
                )}
                {lead.status === 'new' && <ConvertButton leadId={lead.id} />}
              </div>
            </div>
          </div>
        </div>

        {/* Why this is a lead — the summary */}
        {(summary || planningProposal) && (
          <div className="rounded-xl border bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Why this is a lead
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {summary ?? planningProposal}
            </p>
          </div>
        )}

        {/* Planning details */}
        {isPlanning && (
          <div className="rounded-xl border bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Planning application
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {planningReference && (
                <div>
                  <p className="text-xs text-muted-foreground">Reference</p>
                  <p className="font-mono text-sm">{planningReference}</p>
                </div>
              )}
              {planningAuthority && (
                <div>
                  <p className="text-xs text-muted-foreground">Authority</p>
                  <p className="text-sm">{planningAuthority}</p>
                </div>
              )}
              {planningStatus && (
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm">{planningStatus}</p>
                </div>
              )}
              {planningDecision && (
                <div>
                  <p className="text-xs text-muted-foreground">Decision</p>
                  <p className="text-sm">
                    {planningDecision}
                    {planningRating && (
                      <span
                        className={`ml-2 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          planningRating === 'negative'
                            ? 'bg-rose-100 text-rose-800'
                            : planningRating === 'positive'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {planningRating}
                      </span>
                    )}
                  </p>
                </div>
              )}
              {planningReceivedAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Received</p>
                  <p className="text-sm">
                    {new Date(planningReceivedAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
              )}
              {planningDecidedAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Decided</p>
                  <p className="text-sm">
                    {new Date(planningDecidedAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* HMO details */}
        {isHmo && (
          <div className="rounded-xl border bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              HMO licence
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {hmoCouncil && (
                <div>
                  <p className="text-xs text-muted-foreground">Council</p>
                  <p className="text-sm">{hmoCouncil}</p>
                </div>
              )}
              {hmoLicenceType && (
                <div>
                  <p className="text-xs text-muted-foreground">Licence type</p>
                  <p className="text-sm">{hmoLicenceType}</p>
                </div>
              )}
              {hmoLicenceExpiry && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    Licence expires
                  </p>
                  <p className="text-sm">
                    {hmoLicenceExpiry}
                    {hmoLicenceExpiringSoon && (
                      <span className="ml-2 inline-flex rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-800">
                        within 12 months
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contact (if known — rare for scouted leads, common for quick-form) */}
        {(lead.contactName || lead.contactEmail || lead.contactPhone) && (
          <div className="rounded-xl border bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Contact
            </p>
            <div className="mt-2 space-y-1 text-sm">
              {lead.contactName && (
                <p className="font-medium">{lead.contactName}</p>
              )}
              {lead.contactEmail && <p>{lead.contactEmail}</p>}
              {lead.contactPhone && <p>{lead.contactPhone}</p>}
            </div>
          </div>
        )}

        {/* Founder feedback */}
        <FeedbackPanel
          targetType="scout_lead"
          targetId={lead.id}
          overrideFields={[
            {
              key: 'leadScore',
              label: 'Lead Score',
              type: 'number',
              currentValue: lead.leadScore,
              suffix: '/ 100',
            },
            {
              key: 'verdict',
              label: 'Verdict',
              type: 'select',
              currentValue: lead.verdict,
              options: [
                { label: 'STRONG', value: 'STRONG' },
                { label: 'VIABLE', value: 'VIABLE' },
                { label: 'THIN', value: 'THIN' },
                { label: 'PASS', value: 'PASS' },
              ],
            },
          ]}
          existingFeedback={
            existingFeedback
              ? {
                  rating: existingFeedback.rating,
                  notes: existingFeedback.notes,
                  overrides:
                    existingFeedback.overrides as Record<string, unknown> | null,
                }
              : null
          }
        />

        {/* Calendly */}
        <div className="rounded-xl border bg-card p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Book initial call
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Send this link to the vendor or agent. Bookings update the deal
            timeline automatically.
          </p>
          <div className="mt-3">
            <CalendlyButton bookingLink={getBookingLink(lead.id)} />
          </div>
        </div>

        {/* Metadata (compact, low-priority info) */}
        <details className="rounded-xl border bg-card p-5">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Metadata
          </summary>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Source: </span>
              <span className="font-mono text-xs">{lead.source}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Lead type: </span>
              <span className="capitalize">
                {lead.leadType.replace('_', ' ')}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Run date: </span>
              <span>{new Date(lead.runDate).toLocaleDateString('en-GB')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created: </span>
              <span>{new Date(lead.createdAt).toLocaleDateString('en-GB')}</span>
            </div>
            {lead.sourceTrail && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Source trail: </span>
                <span className="text-xs">{lead.sourceTrail}</span>
              </div>
            )}
            {lead.convertedDealId && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Converted to: </span>
                <a
                  href={`/deals/${lead.convertedDealId}`}
                  className="font-medium hover:underline"
                >
                  View deal →
                </a>
              </div>
            )}
          </div>
        </details>
      </div>
    </>
  );
};

export default LeadDetailPage;

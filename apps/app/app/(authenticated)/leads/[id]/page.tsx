import { auth } from '@repo/auth/server';
import { getBookingLink } from '@repo/calendly';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Header } from '../../components/header';
import { FeedbackPanel } from '../../components/feedback-panel';
import { CalendlyButton } from './calendly-button';
import { ConvertButton } from './convert-button';
import { DealModelPanel } from './deal-model-panel';
import { EnrichLeadButton } from './enrich-button';
import { PropertyImage } from './property-image';

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
  const lease = raw.leaseSignal as Record<string, unknown> | undefined;
  const riskFlags = (raw.riskFlags as string[] | undefined) ?? [];
  const scoreBreakdown = raw.scoreBreakdown as
    | Record<string, number>
    | undefined;
  const rationale = (raw.rationale as string | undefined) ?? null;
  type ScoreFactor = {
    label: string;
    points: number;
    dimension: string;
    tone?: 'positive' | 'negative' | 'neutral';
  };
  const scoreFactors =
    (raw.scoreFactors as ScoreFactor[] | undefined) ?? [];
  const positiveFactors = scoreFactors
    .filter((f) => f.points > 0)
    .sort((a, b) => b.points - a.points);
  const negativeFactors = scoreFactors
    .filter((f) => f.points < 0)
    .sort((a, b) => a.points - b.points);
  const neutralFactors = scoreFactors.filter(
    (f) => f.points === 0 && f.tone === 'neutral',
  );
  const DIMENSION_LABELS: Record<string, string> = {
    motivation: 'Motivation',
    equity: 'Equity',
    marketTrend: 'Market',
    contactQuality: 'Contact',
    risk: 'Risk',
  };

  const isPropertyData = lead.source.startsWith('propertydata_');
  const isPlanning = lead.source.startsWith('planning_');
  const isHmo = lead.source.startsWith('hmo_');
  const isShortLease = lead.source.startsWith('short_lease');
  const leaseRemainingYears =
    (lease?.remainingLeaseYears as number | undefined) ?? null;

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

  // Always-on research links — constructed from address + postcode so we can
  // jump to Rightmove / Zoopla / Google / Land Registry even when the lead
  // has no stored URL.
  const researchAddress = encodeURIComponent(
    `${preciseAddress ?? lead.address}, ${lead.postcode}`,
  );
  const postcodeForSearch = encodeURIComponent(lead.postcode);
  const researchLinks = [
    {
      label: 'Rightmove',
      url: `https://www.rightmove.co.uk/property-for-sale/search.html?searchLocation=${postcodeForSearch}`,
    },
    {
      label: 'Zoopla',
      url: `https://www.zoopla.co.uk/for-sale/property/${postcodeForSearch}/`,
    },
    {
      label: 'OnTheMarket',
      url: `https://www.onthemarket.com/for-sale/property/${postcodeForSearch}/`,
    },
    {
      label: 'Google',
      url: `https://www.google.com/search?q=${researchAddress}`,
    },
    {
      label: 'Land Registry',
      url: `https://search-property-information.service.gov.uk/?q=${researchAddress}`,
    },
  ];

  // Source attribution — derive from the source slug directly when listingType
  // is missing. e.g. 'propertydata_unmodernised-properties' → 'Unmodernised property'
  const inferredListingFromSource = lead.source.startsWith('propertydata_')
    ? lead.source.replace('propertydata_', '')
    : null;
  const effectiveListingType = listingType ?? inferredListingFromSource;
  const sourceLabel = isPropertyData
    ? effectiveListingType
      ? LISTING_TYPE_LABELS[effectiveListingType] ?? effectiveListingType
      : 'Distressed listing'
    : isPlanning
      ? `Planning · ${planningRating ?? 'pending'}`
      : isHmo
        ? hmoLicenceExpiringSoon
          ? 'HMO · licence expiring'
          : 'HMO register'
        : isShortLease
          ? leaseRemainingYears
            ? `Short lease · ${leaseRemainingYears}y left`
            : 'Short lease'
          : lead.source;
  const sourceTechnical = isPropertyData
    ? 'PropertyData /sourced-properties'
    : isPlanning
      ? 'PropertyData /planning-applications'
      : isHmo
        ? 'PropertyData /national-hmo-register'
        : isShortLease
          ? 'PropertyData /freeholds (lease term)'
          : lead.source.startsWith('companies_house')
            ? 'Companies House dissolved companies'
            : lead.source;

  // True when this lead lacks the rich PropertyData enrichment (likely
  // scouted before the schema upgrade). Used to surface a clear refresh CTA.
  const isSparseData =
    !pd && !planning && !hmo && scoreFactors.length === 0;

  // ── Property snapshot (Tier 1 + 2 enrichment, may be missing) ──────
  type SoldTxn = {
    address: string;
    pricePence: number;
    date: string;
    propertyType: string | null;
  };
  type Snapshot = {
    avm: {
      estimatePence: number | null;
      lowPence: number | null;
      highPence: number | null;
      confidence: string | null;
    } | null;
    sold: {
      averagePricePence: number | null;
      medianPricePence: number | null;
      transactions: SoldTxn[];
    } | null;
    yields: { averageYieldPct: number | null } | null;
    pricesPerSqf: { averagePerSqft: number | null } | null;
    demandScore: number | null;
    daysOnMarketAvg: number | null;
    growth: {
      annualGrowthPct: number | null;
      fiveYearGrowthPct: number | null;
      forecastGrowthPct: number | null;
    } | null;
    councilTax: {
      averageAnnualBill: number | null;
      band: string | null;
      bandsByLetter: Record<string, number>;
    } | null;
    flood: { riversAndSea: string | null; surfaceWater: string | null } | null;
    epc: { rating: string | null; matchedAddress: string | null } | null;
    tenure: {
      tenure: 'freehold' | 'leasehold' | 'unknown';
      remainingLeaseYears: number | null;
    } | null;
    agents: Array<{
      name: string;
      phone: string | null;
      listings: number | null;
      url: string | null;
    }>;
    fetchedAt: string;
  };
  const snapshot = (raw.snapshot as Snapshot | undefined) ?? null;

  // AVM discount calculation
  const avmEstimate = snapshot?.avm?.estimatePence ?? null;
  const askingPrice = pricePence;
  const discountVsMarket =
    avmEstimate && askingPrice && avmEstimate > 0
      ? Math.round(((avmEstimate - askingPrice) / avmEstimate) * 100)
      : null;

  // ── Strong in-house AVM (runAVM), written by the appraise action. This is
  // the buy-vs-share decision core: a defensible market value, our risk-
  // adjusted offer, the discount that offer represents, and a confidence read.
  type AvmFull = {
    pointEstimatePence: number | null;
    lowPence: number | null;
    highPence: number | null;
    finalOfferPence: number | null;
    offerDiscountPct: number | null;
    confidenceLevel: string | null;
    comparableCount: number | null;
    requiresReview: boolean;
    riskScore: number | null;
    assumedPropertyType: string | null;
    fetchedAt: string;
    /** Photo-inferred condition (deal-model level) + the vision read. */
    inferredCondition?: string | null;
    conditionVisual?: string | null;
    conditionRationale?: string | null;
    conditionConfidence?: number | null;
  };
  const avmFull = (raw.avmFull as AvmFull | undefined) ?? null;
  // Asking sits this far below our modelled market value (the "is this BMV?"
  // headline), computed from the stronger runAVM estimate when present.
  const askingVsAvm =
    avmFull?.pointEstimatePence && askingPrice && avmFull.pointEstimatePence > 0
      ? Math.round(
          ((avmFull.pointEstimatePence - askingPrice) /
            avmFull.pointEstimatePence) *
            100,
        )
      : null;
  // Plain-English go/no-go read, driven by asking-vs-market and AVM confidence.
  // Deliberately avoids invented "BMV tier" thresholds (those were unverifiable);
  // it just describes the headroom and how much to trust it.
  let verdictLabel = 'Review';
  let verdictReason = '';
  let verdictTone = 'border-slate-200 bg-slate-50 text-slate-700';
  if (avmFull?.pointEstimatePence) {
    const lowConf = avmFull.confidenceLevel !== 'high';
    if (askingVsAvm === null) {
      verdictReason = 'No asking price to compare against market value.';
    } else if (askingVsAvm >= 15) {
      verdictLabel = lowConf ? 'Promising — verify' : 'Strong opportunity';
      verdictReason = lowConf
        ? `Asking is ${askingVsAvm}% below modelled market value, but AVM confidence is ${avmFull.confidenceLevel} — sense-check the sold comps before acting.`
        : `Asking is ${askingVsAvm}% below modelled market value, on ${avmFull.comparableCount ?? 'several'} comparables.`;
      verdictTone = lowConf
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-emerald-200 bg-emerald-50 text-emerald-900';
    } else if (askingVsAvm >= 5) {
      verdictLabel = 'Worth a look';
      verdictReason = `Asking is ${askingVsAvm}% below market — moderate headroom; hinges on condition and the offer the seller accepts.`;
      verdictTone = 'border-amber-200 bg-amber-50 text-amber-900';
    } else if (askingVsAvm >= 0) {
      verdictLabel = 'Thin';
      verdictReason = `Asking is only ${askingVsAvm}% below market — little headroom unless the seller will move on price.`;
    } else {
      verdictLabel = 'Above market';
      verdictReason = `Asking is ${Math.abs(askingVsAvm)}% above modelled market value — unlikely to work without a large reduction.`;
      verdictTone = 'border-rose-200 bg-rose-50 text-rose-900';
    }
  }

  // Property lat/lng from PropertyData rawPayload (saved when sourced-properties returned it)
  const lat = (pd?.lat as string | number | undefined) ?? null;
  const lng = (pd?.lng as string | number | undefined) ?? null;
  const hasCoords = lat !== null && lng !== null;

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
            <PropertyImage src={imageUrl} alt={lead.address} />

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

              {/* External actions — primary listing link (when we have one) */}
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
              </div>

              {/* Source attribution — always shown, makes the data lineage transparent */}
              <p className="mt-4 text-[11px] text-muted-foreground">
                Source: <span className="font-mono">{sourceTechnical}</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── DEAL DECISION — strong in-house AVM, the buy-vs-share call ── */}
        {avmFull?.pointEstimatePence ? (
          <section className="rounded-2xl border-2 border-slate-900/10 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Deal decision
              </p>
              <EnrichLeadButton leadId={lead.id} label="↻ Re-appraise" />
            </div>

            <div className="mt-3 grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-[11px] text-muted-foreground">Asking</p>
                <p className="font-mono font-bold text-2xl tabular-nums leading-none">
                  {askingPrice ? formatGBP(askingPrice) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">
                  Market value (AVM)
                </p>
                <p className="font-mono font-bold text-2xl tabular-nums leading-none">
                  {formatGBP(avmFull.pointEstimatePence)}
                </p>
                {avmFull.lowPence && avmFull.highPence && (
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {formatGBP(avmFull.lowPence)} – {formatGBP(avmFull.highPence)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Our offer</p>
                <p className="font-mono font-bold text-2xl tabular-nums leading-none">
                  {avmFull.finalOfferPence
                    ? formatGBP(avmFull.finalOfferPence)
                    : '—'}
                </p>
                {avmFull.offerDiscountPct !== null && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {avmFull.offerDiscountPct.toFixed(0)}% below market
                  </p>
                )}
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Confidence</p>
                <p className="font-semibold text-lg capitalize leading-none">
                  {avmFull.confidenceLevel ?? '—'}
                </p>
                {avmFull.comparableCount !== null && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {avmFull.comparableCount} sold comps
                  </p>
                )}
              </div>
            </div>

            {/* Asking vs market headline + plain-English read */}
            <div className={`mt-4 rounded-lg border p-3 text-sm ${verdictTone}`}>
              <span className="font-semibold">{verdictLabel}</span> —{' '}
              {verdictReason}
            </div>

            {avmFull.assumedPropertyType && (
              <p className="mt-2 text-[11px] text-amber-700">
                ⚠ Property type was missing — assumed{' '}
                {avmFull.assumedPropertyType}. Confirm before acting.
              </p>
            )}
            {avmFull.requiresReview && (
              <p className="mt-1 text-[11px] text-amber-700">
                ⚠ Flagged for manual review (offer capped / escalation).
              </p>
            )}
          </section>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5">
            <div>
              <h2 className="font-semibold">Appraise this deal</h2>
              <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
                Run the valuation to see market value, our offer, the discount,
                confidence, sold comps, yield, EPC, tenure, council tax &amp;
                flood band — the full read on whether this is worth acting on
                (~25s, ~22 credits).
              </p>
            </div>
            <EnrichLeadButton leadId={lead.id} label="Appraise deal" />
          </div>
        )}

        {/* ── DEAL MODEL — bottom-up ROI, GDV auto-derived from the AVM ── */}
        {avmFull?.pointEstimatePence ? (
          <DealModelPanel
            avmPointEstimatePence={avmFull.pointEstimatePence}
            askingPricePence={askingPrice}
            inferredCondition={avmFull.inferredCondition ?? null}
            conditionRationale={avmFull.conditionRationale ?? null}
            conditionConfidence={avmFull.conditionConfidence ?? null}
          />
        ) : null}

        {/* ── NEXT STEP: MAKE CONTACT ────────────────────────────────────
            The whole point of a lead is to reach the vendor. Scouted leads
            rarely carry direct contact details, so we give the founder the
            concrete routes: call the listing agent, find the registered
            owner (Land Registry), or write to the property. */}
        {lead.status === 'new' && (
          <section className="rounded-2xl border-2 border-slate-900/10 bg-slate-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
                  Next step
                </p>
                <h2 className="mt-1 font-semibold text-lg">Make contact</h2>
              </div>
              <ConvertButton leadId={lead.id} />
            </div>

            {/* Direct vendor contact — best case, rarely present on scouted leads */}
            {(lead.contactName || lead.contactPhone || lead.contactEmail) && (
              <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-700">
                  Direct contact on file
                </p>
                {lead.contactName && (
                  <p className="mt-1 font-medium">{lead.contactName}</p>
                )}
                <div className="mt-1 flex flex-wrap gap-x-4 text-sm">
                  {lead.contactPhone && (
                    <a
                      href={`tel:${lead.contactPhone}`}
                      className="font-medium text-emerald-800 hover:underline"
                    >
                      📞 {lead.contactPhone}
                    </a>
                  )}
                  {lead.contactEmail && (
                    <a
                      href={`mailto:${lead.contactEmail}`}
                      className="font-medium text-emerald-800 hover:underline"
                    >
                      ✉ {lead.contactEmail}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Contact routes — always available */}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {/* 1. Call the listing agent */}
              <div className="rounded-xl border bg-white p-4">
                <p className="font-medium text-sm">1 · Call the listing agent</p>
                {snapshot?.agents && snapshot.agents.length > 0 ? (
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="font-medium">{snapshot.agents[0].name}</p>
                    {snapshot.agents[0].phone ? (
                      <a
                        href={`tel:${snapshot.agents[0].phone}`}
                        className="text-blue-700 hover:underline"
                      >
                        📞 {snapshot.agents[0].phone}
                      </a>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        Phone not listed — open the listing below.
                      </p>
                    )}
                  </div>
                ) : listingUrl ? (
                  <a
                    href={listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm text-blue-700 hover:underline"
                  >
                    Open the listing to find the agent ↗
                  </a>
                ) : (
                  <p className="mt-2 text-muted-foreground text-xs">
                    No agent found yet. Enrich this lead or use the research
                    links below.
                  </p>
                )}
              </div>

              {/* 2. Find the registered owner */}
              <div className="rounded-xl border bg-white p-4">
                <p className="font-medium text-sm">2 · Find the owner</p>
                <p className="mt-1 text-muted-foreground text-xs">
                  Buy the title from Land Registry (~£3) to get the registered
                  owner&apos;s name.
                </p>
                <a
                  href={`https://search-property-information.service.gov.uk/?q=${researchAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm text-blue-700 hover:underline"
                >
                  Search Land Registry ↗
                </a>
              </div>

              {/* 3. Write to the property */}
              <div className="rounded-xl border bg-white p-4">
                <p className="font-medium text-sm">3 · Write to the property</p>
                <p className="mt-1 text-sm">{preciseAddress ?? lead.address}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {lead.postcode}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── THE VERDICT — decision info first, before the deep data ─────
            The founder's question is "should I chase this, and why?".
            Answer it up top: plain rationale + what this lead is + score.
            The full factor breakdown stays lower as supporting detail. */}
        {(rationale || summary || planningProposal) && (
          <section className="rounded-2xl border-2 border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  The verdict
                </p>
                {rationale && (
                  <p className="mt-1 text-[15px] font-medium leading-relaxed text-slate-900">
                    {rationale}
                  </p>
                )}
                {(summary || planningProposal) && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {summary ?? planningProposal}
                  </p>
                )}
                {(positiveFactors.length > 0 || negativeFactors.length > 0) && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Full score breakdown below ↓
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono font-bold text-3xl tabular-nums leading-none">
                  {lead.leadScore}
                  <span className="text-base text-muted-foreground">/100</span>
                </p>
                <span
                  className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${verdictColors[lead.verdict] || ''}`}
                >
                  {lead.verdict}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* ── PROPERTY SNAPSHOT — Tier 1 + Tier 2 enrichment ─────────────── */}

        {snapshot && (
          <>
            {/* AVM + discount strip — fallback only. When the strong in-house
                AVM (avmFull) is present, the Deal Decision panel above is the
                single source of asking-vs-market, so we don't show a second,
                divergent number from the weaker snapshot valuation. */}
            {snapshot.avm?.estimatePence && !avmFull?.pointEstimatePence && (
              <div className="rounded-xl border bg-card p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Asking vs market
                </p>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-2">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Asking</p>
                    <p className="font-mono font-bold text-2xl tabular-nums leading-none">
                      {askingPrice ? formatGBP(askingPrice) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">
                      Market value (AVM)
                    </p>
                    <p className="font-mono font-bold text-2xl tabular-nums leading-none">
                      {formatGBP(snapshot.avm.estimatePence)}
                    </p>
                    {snapshot.avm.lowPence && snapshot.avm.highPence && (
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        Range {formatGBP(snapshot.avm.lowPence)} –{' '}
                        {formatGBP(snapshot.avm.highPence)}
                      </p>
                    )}
                  </div>
                  {discountVsMarket !== null && (
                    <div>
                      <p className="text-[11px] text-muted-foreground">
                        vs market
                      </p>
                      <p
                        className={`font-mono font-bold text-2xl tabular-nums leading-none ${
                          discountVsMarket >= 15
                            ? 'text-emerald-700'
                            : discountVsMarket >= 5
                              ? 'text-amber-700'
                              : discountVsMarket >= 0
                                ? 'text-slate-700'
                                : 'text-rose-700'
                        }`}
                      >
                        {discountVsMarket > 0 ? '−' : '+'}
                        {Math.abs(discountVsMarket)}%
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {discountVsMarket >= 15
                          ? 'Below market'
                          : discountVsMarket >= 0
                            ? 'Roughly at market'
                            : 'Above market'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Property facts chips */}
            <div className="rounded-xl border bg-card p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Property facts
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-[11px] text-muted-foreground">Tenure</p>
                  <p className="font-medium text-sm">
                    {snapshot.tenure?.tenure
                      ? snapshot.tenure.tenure.charAt(0).toUpperCase() +
                        snapshot.tenure.tenure.slice(1)
                      : '—'}
                  </p>
                  {snapshot.tenure?.remainingLeaseYears && (
                    <p
                      className={`mt-0.5 text-[11px] ${
                        snapshot.tenure.remainingLeaseYears < 80
                          ? 'text-rose-700'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {snapshot.tenure.remainingLeaseYears}y remaining
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">EPC</p>
                  <p className="font-medium text-sm">
                    {snapshot.epc?.rating ?? '—'}
                  </p>
                  {snapshot.epc?.matchedAddress && (
                    <p
                      className="mt-0.5 truncate text-[11px] text-muted-foreground"
                      title={snapshot.epc.matchedAddress}
                    >
                      matched
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Council tax
                  </p>
                  <p className="font-medium text-sm">
                    {snapshot.councilTax?.band
                      ? `Band ${snapshot.councilTax.band}`
                      : snapshot.councilTax?.averageAnnualBill
                        ? `~£${Math.round(snapshot.councilTax.averageAnnualBill)}/yr`
                        : '—'}
                  </p>
                  {snapshot.councilTax?.averageAnnualBill && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      avg £
                      {Math.round(snapshot.councilTax.averageAnnualBill)}/yr
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Flood</p>
                  <p className="font-medium text-sm capitalize">
                    {snapshot.flood?.riversAndSea ?? '—'}
                  </p>
                  {snapshot.flood?.surfaceWater && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground capitalize">
                      surface: {snapshot.flood.surfaceWater}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Investment row */}
            <div className="rounded-xl border bg-card p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Investment lens
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Rental yield
                  </p>
                  <p className="font-mono font-semibold text-xl tabular-nums">
                    {snapshot.yields?.averageYieldPct
                      ? `${snapshot.yields.averageYieldPct.toFixed(1)}%`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Sales demand
                  </p>
                  <p className="font-mono font-semibold text-xl tabular-nums">
                    {typeof snapshot.demandScore === 'number'
                      ? `${snapshot.demandScore}/100`
                      : '—'}
                  </p>
                  {typeof snapshot.daysOnMarketAvg === 'number' && (
                    <p className="text-[11px] text-muted-foreground">
                      avg {Math.round(snapshot.daysOnMarketAvg)}d to sell
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Growth forecast
                  </p>
                  <p className="font-mono font-semibold text-xl tabular-nums">
                    {snapshot.growth?.forecastGrowthPct !== null &&
                    snapshot.growth?.forecastGrowthPct !== undefined
                      ? `${snapshot.growth.forecastGrowthPct > 0 ? '+' : ''}${snapshot.growth.forecastGrowthPct.toFixed(1)}%`
                      : '—'}
                  </p>
                  {snapshot.growth?.fiveYearGrowthPct !== null &&
                    snapshot.growth?.fiveYearGrowthPct !== undefined && (
                      <p className="text-[11px] text-muted-foreground">
                        5yr:{' '}
                        {snapshot.growth.fiveYearGrowthPct > 0 ? '+' : ''}
                        {snapshot.growth.fiveYearGrowthPct.toFixed(1)}%
                      </p>
                    )}
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">£/sqft</p>
                  <p className="font-mono font-semibold text-xl tabular-nums">
                    {snapshot.pricesPerSqf?.averagePerSqft
                      ? `£${Math.round(snapshot.pricesPerSqf.averagePerSqft)}`
                      : '—'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    area avg asking
                  </p>
                </div>
              </div>
            </div>

            {/* Sold comparables */}
            {snapshot.sold?.transactions &&
              snapshot.sold.transactions.length > 0 && (
                <div className="rounded-xl border bg-card p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Recent sold comparables
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last {snapshot.sold.transactions.length} transactions in
                    this postcode.
                    {snapshot.sold.averagePricePence && (
                      <>
                        {' '}
                        Average{' '}
                        {formatGBP(snapshot.sold.averagePricePence)}.
                      </>
                    )}
                  </p>
                  <table className="mt-3 w-full text-sm">
                    <thead className="border-b">
                      <tr className="text-left text-[11px] uppercase text-muted-foreground">
                        <th className="py-2 font-medium">Address</th>
                        <th className="py-2 text-right font-medium">Price</th>
                        <th className="py-2 text-right font-medium">Date</th>
                        <th className="py-2 text-right font-medium">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {snapshot.sold.transactions
                        .slice(0, 8)
                        .map((t, i) => (
                          <tr key={`${t.address}-${i}`}>
                            <td className="py-2 pr-3 text-slate-700">
                              {t.address}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">
                              {formatGBP(t.pricePence)}
                            </td>
                            <td className="py-2 pr-3 text-right text-muted-foreground">
                              {new Date(t.date).toLocaleDateString('en-GB', {
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="py-2 text-right text-xs text-muted-foreground">
                              {t.propertyType ?? ''}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

            {/* Top agents */}
            {snapshot.agents && snapshot.agents.length > 0 && (
              <div className="rounded-xl border bg-card p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Top agents in this postcode
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Who's selling the comparable stock — useful for Marketer
                  outreach.
                </p>
                <ul className="mt-3 divide-y">
                  {snapshot.agents.map((a, i) => (
                    <li
                      key={`${a.name}-${i}`}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">{a.name}</span>
                        {typeof a.listings === 'number' && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {a.listings} listing
                            {a.listings === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3 text-xs">
                        {a.phone && (
                          <a
                            href={`tel:${a.phone}`}
                            className="text-primary hover:underline"
                          >
                            {a.phone}
                          </a>
                        )}
                        {a.url && (
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            Site ↗
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Google Maps embed — visual reality check */}
            {hasCoords && (
              <div className="overflow-hidden rounded-xl border bg-card">
                <div className="border-b p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Location
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Visual check — drag the map to look around.
                  </p>
                </div>
                <iframe
                  title={`Map of ${lead.address}`}
                  src={`https://www.google.com/maps?q=${lat},${lng}&z=17&output=embed`}
                  className="h-[400px] w-full border-0"
                  loading="lazy"
                />
              </div>
            )}

            {/* Snapshot timestamp */}
            <p className="text-center text-[11px] text-muted-foreground">
              Snapshot fetched{' '}
              {new Date(snapshot.fetchedAt).toLocaleString('en-GB')}
            </p>
          </>
        )}

        {/* Research links — ALWAYS visible, even when we have a primary listing URL.
            Founders need fast deep-links to verify the property in 1 click. */}
        <div className="rounded-xl border bg-card p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Research this property
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Quick deep-links to check this address on every major UK source.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {researchLinks.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {link.label}
                <span aria-hidden className="text-slate-400">↗</span>
              </a>
            ))}
          </div>
        </div>

        {/* Sparse-data CTA — shown when this lead pre-dates the rich-payload upgrade */}
        {isSparseData && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-800">
              Limited data on this lead
            </p>
            <p className="mt-2 text-sm text-amber-900">
              This lead was scouted before the PropertyData enrichment was
              wired through. We have its address, postcode, and score — but
              no image, price, summary or score breakdown.
            </p>
            <p className="mt-2 text-sm text-amber-900">
              <strong>To refresh:</strong> hit{' '}
              <a
                href="/settings/scouting"
                className="underline underline-offset-2"
              >
                /settings/scouting → Run scout now
              </a>
              . PropertyData will re-fetch and any matching active listings
              come back with the full enrichment. Old leads that no longer
              match active listings will stay sparse.
            </p>
            <p className="mt-2 text-xs text-amber-800">
              In the meantime, use the research links above to check
              Rightmove / Zoopla / Land Registry directly.
            </p>
          </div>
        )}

        {/* Score breakdown — supporting detail for the verdict card above */}
        {scoreFactors.length > 0 && (
          <div className="rounded-xl border bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Score breakdown
            </p>

            {/* Positive contributors */}
            {positiveFactors.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-700">
                  What pushed it up
                </p>
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {positiveFactors.map((f, idx) => (
                    <li
                      key={`${f.label}-${idx}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate text-slate-900">
                        {f.label}
                      </span>
                      <span className="font-mono text-emerald-800 font-semibold tabular-nums">
                        +{f.points}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Negative contributors */}
            {negativeFactors.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-rose-700">
                  What pulled it down
                </p>
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {negativeFactors.map((f, idx) => (
                    <li
                      key={`${f.label}-${idx}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate text-slate-900">
                        ⚠ {f.label}
                      </span>
                      <span className="font-mono text-rose-800 font-semibold tabular-nums">
                        {f.points}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Per-dimension breakdown row */}
            {scoreBreakdown && (
              <div className="mt-4 grid grid-cols-5 gap-2 border-t pt-3 text-center text-[11px]">
                <div>
                  <p className="text-muted-foreground">Motivation</p>
                  <p className="font-mono text-sm font-semibold">
                    {scoreBreakdown.motivation}
                    <span className="text-muted-foreground">/40</span>
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Equity</p>
                  <p className="font-mono text-sm font-semibold">
                    {scoreBreakdown.equity}
                    <span className="text-muted-foreground">/25</span>
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Market</p>
                  <p className="font-mono text-sm font-semibold">
                    {scoreBreakdown.marketTrend}
                    <span className="text-muted-foreground">/15</span>
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contact</p>
                  <p className="font-mono text-sm font-semibold">
                    {scoreBreakdown.contactQuality}
                    <span className="text-muted-foreground">/10</span>
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Risk</p>
                  <p
                    className={`font-mono text-sm font-semibold ${
                      scoreBreakdown.risk < 0
                        ? 'text-rose-700'
                        : scoreBreakdown.risk > 0
                          ? 'text-emerald-700'
                          : ''
                    }`}
                  >
                    {scoreBreakdown.risk > 0 ? '+' : ''}
                    {scoreBreakdown.risk}
                  </p>
                </div>
              </div>
            )}

            {neutralFactors.length > 0 && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Missing inputs:{' '}
                {neutralFactors.map((f) => f.label).join(' · ')}
              </p>
            )}
          </div>
        )}

        {/* Back-compat: surface riskFlags inline for older leads without factors[] */}
        {riskFlags.length > 0 && scoreFactors.length === 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-rose-700">
              Risk flags
            </p>
            <ul className="mt-3 space-y-1 text-sm text-rose-900">
              {riskFlags.map((flag) => (
                <li key={flag} className="flex items-center gap-2">
                  <span aria-hidden>⚠</span>
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
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

        {/* Contact (if known). For 'new' leads this is shown in the
            "Make contact" block above, so only render here once converted. */}
        {lead.status !== 'new' &&
          (lead.contactName || lead.contactEmail || lead.contactPhone) && (
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

        {/* Founder feedback — captures context so the calibration page
            can analyse which factors are mis-weighted. */}
        <FeedbackPanel
          targetType="scout_lead"
          targetId={lead.id}
          context={{
            scorerScore: lead.leadScore,
            scorerVerdict: lead.verdict,
            source: lead.source,
            listingType: (pd?.listingType as string | undefined) ?? null,
            scoreFactors: scoreFactors,
            scoreBreakdown: scoreBreakdown ?? null,
            postcode: lead.postcode,
            scoredAt: new Date().toISOString(),
          }}
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

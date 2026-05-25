'use client';

import { useState } from 'react';
import { StarRatingInline } from '../components/star-rating-inline';

type Lead = {
  id: string;
  address: string;
  postcode: string;
  leadType: string;
  leadScore: number;
  verdict: string;
  estimatedEquityPence: number | null;
  marketTrend: string | null;
  status: string;
  source: string;
  existingRating: number;
  // PropertyData-rich fields
  listingType: string | null;
  listingUrl: string | null;
  imageUrl: string | null;
  summary: string | null;
  pricePence: number | null;
  originalPricePence: number | null;
  discountPercent: number | null;
  reductionCount: number;
  velocityScore: number;
  bedrooms: number | null;
  propertyType: string | null;
  daysOnMarket: number | null;
  // Planning + HMO
  planningDecision: string | null;
  planningRating: string | null;
  planningProposal: string | null;
  planningUrl: string | null;
  hmoExpiringSoon: boolean;
  hmoLicenceExpiry: string | null;
  dissolvedCompanyName: string | null;
  dissolvedAt: string | null;
  riskFlags: string[];
};

type Props = {
  leads: Lead[];
  unratedCount: number;
  initialFilter: string;
};

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

function formatGBP(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

type FilterKey =
  | 'all'
  | 'unrated'
  | 'rated'
  | 'STRONG'
  | 'VIABLE'
  | 'THIN'
  | 'propertydata'
  | 'planning'
  | 'hmo'
  | 'dissolved';

export function LeadsTable({ leads, unratedCount, initialFilter }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>(
    (initialFilter as FilterKey) ?? 'all',
  );
  const [localRatings, setLocalRatings] = useState<Record<string, number>>({});

  const handleRated = (leadId: string, rating: number) => {
    setLocalRatings((prev) => ({ ...prev, [leadId]: rating }));
  };

  const getRating = (lead: Lead) =>
    localRatings[lead.id] ?? lead.existingRating;

  const filteredLeads = leads.filter((lead) => {
    const rating = getRating(lead);
    switch (activeFilter) {
      case 'unrated':
        return lead.status === 'new' && !rating;
      case 'rated':
        return rating > 0;
      case 'STRONG':
      case 'VIABLE':
      case 'THIN':
        return lead.verdict === activeFilter;
      case 'propertydata':
        return lead.source.startsWith('propertydata_');
      case 'planning':
        return lead.source.startsWith('planning_');
      case 'hmo':
        return lead.source.startsWith('hmo_');
      case 'dissolved':
        return lead.source === 'companies_house_dissolved';
      default:
        return true;
    }
  });

  const currentUnratedCount =
    unratedCount -
    Object.keys(localRatings).filter((id) => {
      const lead = leads.find((l) => l.id === id);
      return lead?.status === 'new' && !lead.existingRating;
    }).length;

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: leads.length },
    {
      key: 'STRONG',
      label: 'Strong',
      count: leads.filter((l) => l.verdict === 'STRONG').length,
    },
    {
      key: 'VIABLE',
      label: 'Viable',
      count: leads.filter((l) => l.verdict === 'VIABLE').length,
    },
    {
      key: 'unrated',
      label: 'Unrated',
      count: Math.max(0, currentUnratedCount),
    },
    {
      key: 'propertydata',
      label: 'Distressed',
      count: leads.filter((l) => l.source.startsWith('propertydata_')).length,
    },
    {
      key: 'planning',
      label: 'Planning',
      count: leads.filter((l) => l.source.startsWith('planning_')).length,
    },
    {
      key: 'hmo',
      label: 'HMO',
      count: leads.filter((l) => l.source.startsWith('hmo_')).length,
    },
    {
      key: 'dissolved',
      label: 'Dissolved Co.',
      count: leads.filter((l) => l.source === 'companies_house_dissolved')
        .length,
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-1">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setActiveFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeFilter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f.label}
            <span className="ml-1 opacity-70">{f.count}</span>
          </button>
        ))}
      </div>

      <p className="text-muted-foreground text-sm">
        {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
      </p>

      {filteredLeads.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            {activeFilter === 'unrated'
              ? 'All leads have been rated.'
              : 'No leads match this filter.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              rating={getRating(lead)}
              onRate={(r) => handleRated(lead.id, r)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function LeadCard({
  lead,
  rating,
  onRate,
}: {
  lead: Lead;
  rating: number;
  onRate: (rating: number) => void;
}) {
  const isPropertyData = lead.source.startsWith('propertydata_');
  const isPlanning = lead.source.startsWith('planning_');
  const isHmo = lead.source.startsWith('hmo_');
  const isDissolved = lead.source === 'companies_house_dissolved';

  const sourceBadge = isPropertyData
    ? (lead.listingType
        ? LISTING_TYPE_LABELS[lead.listingType] ?? lead.listingType
        : 'Distressed')
    : isPlanning
      ? `Planning · ${lead.planningRating ?? 'pending'}`
      : isHmo
        ? lead.hmoExpiringSoon
          ? 'HMO · licence expiring'
          : 'HMO register'
        : isDissolved
          ? 'Dissolved company'
          : lead.source;

  const sourceBadgeColor = isPropertyData
    ? 'bg-purple-100 text-purple-800 border-purple-200'
    : isPlanning
      ? lead.planningRating === 'negative'
        ? 'bg-rose-100 text-rose-800 border-rose-200'
        : 'bg-sky-100 text-sky-800 border-sky-200'
      : isHmo
        ? 'bg-teal-100 text-teal-800 border-teal-200'
        : isDissolved
          ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
          : 'bg-slate-100 text-slate-700 border-slate-200';

  const externalUrl = lead.listingUrl ?? lead.planningUrl ?? null;

  return (
    <div className="overflow-hidden rounded-xl border bg-card transition hover:shadow-md">
      <div className="flex">
        {/* Image (if PropertyData) */}
        {lead.imageUrl && (
          <a
            href={`/leads/${lead.id}`}
            className="hidden h-32 w-44 shrink-0 sm:block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lead.imageUrl}
              alt={lead.address}
              className="h-full w-full object-cover"
            />
          </a>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/leads/${lead.id}`}
                  className="font-semibold hover:underline"
                >
                  {lead.address}
                </a>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {lead.postcode}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    verdictColors[lead.verdict] || ''
                  }`}
                >
                  {lead.verdict}
                </span>
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${sourceBadgeColor}`}
                >
                  {sourceBadge}
                </span>
                {lead.discountPercent && lead.discountPercent > 0 && (
                  <span className="inline-flex rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-800">
                    ↓ {lead.discountPercent}% reduced
                    {lead.reductionCount > 1 && ` ×${lead.reductionCount}`}
                  </span>
                )}
                {lead.velocityScore >= 0.5 && (
                  <span
                    className="inline-flex rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800"
                    title={`Velocity score ${lead.velocityScore.toFixed(2)} — accelerating distress`}
                  >
                    ⚡ Accelerating
                  </span>
                )}
                {typeof lead.daysOnMarket === 'number' &&
                  lead.daysOnMarket >= 60 && (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      {lead.daysOnMarket}d on market
                    </span>
                  )}
                {lead.hmoExpiringSoon && (
                  <span className="inline-flex rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-800">
                    Licence: {lead.hmoLicenceExpiry}
                  </span>
                )}
                {lead.riskFlags.slice(0, 3).map((flag) => (
                  <span
                    key={flag}
                    className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700"
                    title="Risk penalty applied to score"
                  >
                    ⚠ {flag}
                  </span>
                ))}
              </div>

              {/* Key facts row */}
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                {lead.pricePence && (
                  <span className="font-semibold text-foreground">
                    {formatGBP(lead.pricePence)}
                  </span>
                )}
                {lead.propertyType && (
                  <span className="text-muted-foreground">
                    {lead.propertyType}
                  </span>
                )}
                {typeof lead.bedrooms === 'number' && (
                  <span className="text-muted-foreground">
                    {lead.bedrooms} bed
                  </span>
                )}
                {typeof lead.daysOnMarket === 'number' &&
                  lead.daysOnMarket < 60 && (
                    <span className="text-muted-foreground">
                      {lead.daysOnMarket}d on market
                    </span>
                  )}
              </div>

              {/* Summary or proposal */}
              {(lead.summary || lead.planningProposal) && (
                <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-slate-600">
                  {lead.summary ?? lead.planningProposal}
                </p>
              )}
            </div>

            {/* Right side — score + actions */}
            <div className="flex flex-col items-end gap-2">
              <div className="text-right">
                <div className="font-mono text-2xl font-bold tabular-nums leading-none">
                  {lead.leadScore}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Score
                </div>
              </div>
              <StarRatingInline
                targetType="scout_lead"
                targetId={lead.id}
                existingRating={rating}
                compact
                onRated={onRate}
              />
            </div>
          </div>

          {/* Footer actions */}
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-2 text-xs">
            <a
              href={`/leads/${lead.id}`}
              className="font-medium text-primary hover:underline"
            >
              View detail →
            </a>
            {externalUrl && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                {isPlanning
                  ? 'View planning record ↗'
                  : externalUrl.includes('rightmove')
                    ? 'View on Rightmove ↗'
                    : externalUrl.includes('zoopla')
                      ? 'View on Zoopla ↗'
                      : 'View listing ↗'}
              </a>
            )}
            {lead.estimatedEquityPence && !lead.pricePence && (
              <span className="text-muted-foreground">
                Est. equity: {formatGBP(lead.estimatedEquityPence)}
              </span>
            )}
            <span className="ml-auto capitalize text-muted-foreground">
              {lead.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

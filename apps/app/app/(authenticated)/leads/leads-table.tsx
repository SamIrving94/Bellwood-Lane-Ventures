'use client';

import { ExternalLinkIcon } from 'lucide-react';
import { useState } from 'react';
import { StarRatingInline } from '../components/star-rating-inline';
import {
  type LeadFlag,
  type LeadView,
  formatGBPCompact,
  formatGBPFromPence,
  formatHeadroomPct,
} from './lead-payload';

type Props = {
  leads: LeadView[];
  unratedCount: number;
  initialFilter: string;
};

const verdictColors: Record<string, string> = {
  STRONG:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  VIABLE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  THIN: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  PASS: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  INSUFFICIENT_DATA:
    'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const flagToneClasses: Record<LeadFlag['tone'], string> = {
  danger: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  warn: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  info: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

type FilterKey = 'all' | 'unrated' | 'rated' | 'STRONG' | 'VIABLE' | 'THIN';

function headroomTone(pence: number | null): string {
  if (pence == null) {
    return 'text-muted-foreground';
  }
  if (pence > 0) {
    return 'text-emerald-700 dark:text-emerald-400';
  }
  if (pence < 0) {
    return 'text-rose-700 dark:text-rose-400';
  }
  return 'text-muted-foreground';
}

function PropertyMeta({ lead }: { lead: LeadView }) {
  const parts = [
    lead.propertyType?.replace(/_/g, ' '),
    lead.bedrooms != null ? `${lead.bedrooms} bed` : null,
    lead.tenureLabel,
  ].filter(Boolean) as string[];
  if (parts.length === 0) {
    return null;
  }
  return (
    <p className="mt-0.5 text-muted-foreground text-xs capitalize">
      {parts.join(' · ')}
    </p>
  );
}

function NumberCell({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: string;
  sub?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className={`font-mono font-semibold text-sm ${tone ?? ''}`}>{value}</p>
      {sub && (
        <p className={`text-xs ${tone ?? 'text-muted-foreground'}`}>{sub}</p>
      )}
    </div>
  );
}

function LeadRow({
  lead,
  rating,
  onRated,
}: {
  lead: LeadView;
  rating: number;
  onRated: (r: number) => void;
}) {
  const pending = lead.enrichmentState === 'pending';
  return (
    <div className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40">
      {/* Header: address + basics on the left, score/verdict on the right */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={`/leads/${lead.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {lead.address}
          </a>
          <p className="text-muted-foreground text-xs">{lead.postcode}</p>
          <PropertyMeta lead={lead} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 font-medium text-xs ${
              verdictColors[lead.verdict] ?? ''
            }`}
          >
            {lead.verdict}
          </span>
          <div
            className="text-right"
            title={
              pending
                ? 'Score is pre-enrichment — contact details not yet appended, so it will likely rise after Tier-2 enrichment.'
                : 'Lead score (0–100)'
            }
          >
            <span className="font-mono font-semibold text-base">
              {lead.leadScore}
            </span>
            <span className="text-muted-foreground text-xs">/100</span>
            <p
              className={`text-[10px] uppercase tracking-wide ${
                pending
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {pending ? 'pending enrich' : 'enriched'}
            </p>
          </div>
        </div>
      </div>

      {/* The numbers: asking / estimate / headroom */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberCell label="Type" value={lead.leadTypeLabel} />
        <NumberCell
          label="Asking"
          value={formatGBPFromPence(lead.askingPricePence)}
        />
        <NumberCell
          label="Prelim est."
          value={formatGBPFromPence(lead.estimatePence)}
        />
        <NumberCell
          label="Headroom"
          value={
            lead.headroomPence == null
              ? '—'
              : formatGBPCompact(lead.headroomPence)
          }
          sub={
            lead.headroomPct == null
              ? undefined
              : formatHeadroomPct(lead.headroomPct)
          }
          tone={headroomTone(lead.headroomPence)}
        />
      </div>

      {/* Why it matters */}
      <p className="mt-3 line-clamp-2 text-foreground/80 text-sm">
        {lead.relevanceSummary}
      </p>

      {/* Flags */}
      {lead.flags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lead.flags.map((flag) => (
            <span
              key={`${flag.kind}-${flag.label}`}
              className={`inline-flex rounded-full px-2 py-0.5 font-medium text-xs ${flagToneClasses[flag.tone]}`}
            >
              {flag.label}
            </span>
          ))}
        </div>
      )}

      {/* Footer: source link + rating */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        {lead.sourceUrl ? (
          <a
            href={lead.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-primary text-sm hover:underline"
            aria-label={`Open original listing on ${lead.sourceLabel} (opens in a new tab)`}
          >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            View on {lead.sourceLabel}
          </a>
        ) : (
          <span className="text-muted-foreground text-xs">
            Source: {lead.sourceName} (no listing link)
          </span>
        )}
        <div className="relative">
          <StarRatingInline
            targetType="scout_lead"
            targetId={lead.id}
            existingRating={rating}
            compact
            onRated={onRated}
          />
        </div>
      </div>
    </div>
  );
}

export function LeadsTable({ leads, unratedCount, initialFilter }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>(
    (initialFilter as FilterKey) ?? 'all'
  );
  // Track inline ratings to update the unrated count optimistically.
  const [localRatings, setLocalRatings] = useState<Record<string, number>>({});

  const handleRated = (leadId: string, rating: number) => {
    setLocalRatings((prev) => ({ ...prev, [leadId]: rating }));
  };

  const getRating = (lead: LeadView) =>
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

  const filters: { key: FilterKey; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: leads.length },
    {
      key: 'unrated',
      label: 'Unrated',
      count: Math.max(0, currentUnratedCount),
    },
    {
      key: 'rated',
      label: 'Rated',
      count: leads.filter((l) => getRating(l) > 0).length,
    },
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
      key: 'THIN',
      label: 'Thin',
      count: leads.filter((l) => l.verdict === 'THIN').length,
    },
  ];

  return (
    <>
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-1">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setActiveFilter(f.key)}
            className={`rounded-full px-3 py-1 font-medium text-xs transition-colors ${
              activeFilter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f.label}
            {f.count !== undefined && (
              <span className="ml-1 opacity-70">{f.count}</span>
            )}
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
        <div className="grid gap-3 lg:grid-cols-2">
          {filteredLeads.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              rating={getRating(lead)}
              onRated={(r) => handleRated(lead.id, r)}
            />
          ))}
        </div>
      )}
    </>
  );
}

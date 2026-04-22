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
  existingRating: number;
};

type Props = {
  leads: Lead[];
  unratedCount: number;
  initialFilter: string;
};

const verdictColors: Record<string, string> = {
  STRONG: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  VIABLE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  THIN: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  PASS: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  INSUFFICIENT_DATA: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

function formatGBP(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

type FilterKey = 'all' | 'unrated' | 'rated' | 'STRONG' | 'VIABLE' | 'THIN';

export function LeadsTable({ leads, unratedCount, initialFilter }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>(
    (initialFilter as FilterKey) ?? 'all'
  );
  // Track which leads have been rated inline (to update unrated count optimistically)
  const [localRatings, setLocalRatings] = useState<Record<string, number>>({});

  const handleRated = (leadId: string, rating: number) => {
    setLocalRatings((prev) => ({ ...prev, [leadId]: rating }));
  };

  const getRating = (lead: Lead) => localRatings[lead.id] ?? lead.existingRating;

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
    unratedCount - Object.keys(localRatings).filter((id) => {
      const lead = leads.find((l) => l.id === id);
      return lead?.status === 'new' && !lead.existingRating;
    }).length;

  const filters: { key: FilterKey; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: leads.length },
    { key: 'unrated', label: 'Unrated', count: Math.max(0, currentUnratedCount) },
    { key: 'rated', label: 'Rated', count: leads.filter((l) => getRating(l) > 0).length },
    { key: 'STRONG', label: 'Strong', count: leads.filter((l) => l.verdict === 'STRONG').length },
    { key: 'VIABLE', label: 'Viable', count: leads.filter((l) => l.verdict === 'VIABLE').length },
    { key: 'THIN', label: 'Thin', count: leads.filter((l) => l.verdict === 'THIN').length },
  ];

  return (
    <>
      {/* Filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
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
            {f.count !== undefined && (
              <span className="ml-1 opacity-70">{f.count}</span>
            )}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
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
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Address</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Score</th>
                <th className="px-4 py-3 text-left font-medium">Verdict</th>
                <th className="px-4 py-3 text-left font-medium">Equity</th>
                <th className="px-4 py-3 text-left font-medium">Trend</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className="transition-colors hover:bg-accent"
                >
                  <td className="px-4 py-3">
                    <a
                      href={`/leads/${lead.id}`}
                      className="font-medium hover:underline"
                    >
                      {lead.address}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {lead.postcode}
                    </p>
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {lead.leadType.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold">
                      {lead.leadScore}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        verdictColors[lead.verdict] || ''
                      }`}
                    >
                      {lead.verdict}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {lead.estimatedEquityPence
                      ? formatGBP(lead.estimatedEquityPence)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {lead.marketTrend || '—'}
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {lead.status}
                  </td>
                  <td className="px-4 py-3 relative">
                    <StarRatingInline
                      targetType="scout_lead"
                      targetId={lead.id}
                      existingRating={getRating(lead)}
                      compact
                      onRated={(r) => handleRated(lead.id, r)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

'use client';

import { useState, useTransition } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@repo/design-system/components/ui/alert-dialog';
import { TriageButtons } from '../components/triage-buttons';
import type { TriageStatus } from '../../actions/leads/triage';
import { clearNewLeadsInbox } from '../../actions/leads/clear-inbox';

type Lead = {
  id: string;
  address: string;
  postcode: string;
  leadType: string;
  track: string;
  leadScore: number;
  verdict: string;
  estimatedEquityPence: number | null;
  marketTrend: string | null;
  status: string;
  source: string;
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
  // Short-lease signal
  leaseRemainingYears: number | null;
  leaseMarriageValue: boolean;
  // Appraisal status
  appraised: boolean;
  avmValuePence: number | null;
  avmConfidence: string | null;
  riskFlags: string[];
  rationale: string | null;
  topPositiveFactors: string[];
};

type Props = {
  leads: Lead[];
  initialFilter: string;
  /**
   * Total ScoutLead rows in the database. The page fetches a bounded slice
   * (highest-scoring first), so when this exceeds `leads.length` there are
   * leads the founder simply cannot see from here — say so rather than
   * quietly presenting a truncated list as the whole picture.
   */
  totalCount?: number;
};

/** Cards rendered per page. Keeps the DOM small on a multi-hundred-lead list. */
const PAGE_SIZE = 50;

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

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  shortlisted: 'Shortlisted',
  watching: 'Watching',
  passed: 'Passed',
  converted: 'Converted',
};

function formatGBP(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

type FilterKey =
  | 'new'
  | 'shortlist'
  | 'triage'
  | 'watching'
  | 'passed'
  | 'all'
  | 'STRONG'
  | 'VIABLE'
  | 'THIN'
  | 'propertydata'
  | 'planning'
  | 'hmo'
  | 'dissolved'
  | 'shortlease'
  | 'appraised'
  | 'unappraised'
  | 'primeblock';

// Source-type filters are analyst tools, not part of the daily "what do I
// act on" job — they live behind a "More filters" disclosure.
const SECONDARY_FILTERS: FilterKey[] = [
  'passed',
  'appraised',
  'unappraised',
  'propertydata',
  'planning',
  'hmo',
  'dissolved',
  'shortlease',
];

export function LeadsTable({ leads, initialFilter, totalCount }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>(
    (initialFilter as FilterKey) ?? 'new',
  );
  const [page, setPage] = useState(1);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Switching filter must reset paging — landing on page 4 of a list you have
  // just replaced looks like an empty tab.
  const selectFilter = (key: FilterKey) => {
    setActiveFilter(key);
    setPage(1);
  };
  // Optimistic triage state so cards re-filter instantly on Shortlist/Pass.
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});

  const getStatus = (lead: Lead) => localStatus[lead.id] ?? lead.status;

  const handleTriaged = (leadId: string, status: TriageStatus) => {
    setLocalStatus((prev) => ({ ...prev, [leadId]: status }));
  };

  const filteredLeads = leads.filter((lead) => {
    const status = getStatus(lead);
    switch (activeFilter) {
      case 'new':
        // Everything freshly sourced and not yet triaged — every verdict,
        // not just STRONG/VIABLE. This is the overnight-scout inbox: a place
        // to see all of it without passed/watching/shortlisted mixed in.
        return status === 'new';
      case 'shortlist':
        // OUR shortlist — leads a founder explicitly shortlisted.
        return status === 'shortlisted';
      case 'triage':
        // The daily queue: new, worth pursuing, no decision made yet.
        return (
          status === 'new' &&
          (lead.verdict === 'STRONG' || lead.verdict === 'VIABLE')
        );
      case 'watching':
        return status === 'watching';
      case 'passed':
        return status === 'passed';
      case 'STRONG':
      case 'VIABLE':
      case 'THIN':
        return lead.verdict === activeFilter && status !== 'passed';
      case 'propertydata':
        return lead.source.startsWith('propertydata_');
      case 'planning':
        return lead.source.startsWith('planning_');
      case 'hmo':
        return lead.source.startsWith('hmo_');
      case 'dissolved':
        return lead.source === 'companies_house_dissolved';
      case 'shortlease':
        return lead.source.startsWith('short_lease');
      case 'appraised':
        return lead.appraised;
      case 'unappraised':
        return !lead.appraised;
      case 'primeblock':
        return lead.track !== 'volume';
      default:
        return true;
    }
  });

  // Page the FILTERED list, so counts and filters keep working over the whole
  // fetched set while the DOM only ever holds one page of cards.
  const pageCount = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedLeads = filteredLeads.slice(pageStart, pageStart + PAGE_SIZE);
  // True when the server had to cut the fetch — there are leads not loaded.
  const truncated =
    typeof totalCount === 'number' && totalCount > leads.length;

  const countByStatus = (s: string) =>
    leads.filter((l) => getStatus(l) === s).length;

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: 'new', label: 'New', count: countByStatus('new') },
    { key: 'shortlist', label: 'Shortlist', count: countByStatus('shortlisted') },
    {
      key: 'triage',
      label: 'Needs triage',
      count: leads.filter(
        (l) =>
          getStatus(l) === 'new' &&
          (l.verdict === 'STRONG' || l.verdict === 'VIABLE'),
      ).length,
    },
    { key: 'watching', label: 'Watching', count: countByStatus('watching') },
    {
      key: 'STRONG',
      label: 'Strong',
      count: leads.filter(
        (l) => l.verdict === 'STRONG' && getStatus(l) !== 'passed',
      ).length,
    },
    {
      key: 'VIABLE',
      label: 'Viable',
      count: leads.filter(
        (l) => l.verdict === 'VIABLE' && getStatus(l) !== 'passed',
      ).length,
    },
    {
      key: 'primeblock',
      label: 'Prime / Block',
      count: leads.filter((l) => l.track !== 'volume').length,
    },
    { key: 'all', label: 'All', count: leads.length },
    { key: 'passed', label: 'Passed', count: countByStatus('passed') },
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
    {
      key: 'shortlease',
      label: 'Short lease',
      count: leads.filter((l) => l.source.startsWith('short_lease')).length,
    },
    {
      key: 'appraised',
      label: 'Appraised',
      count: leads.filter((l) => l.appraised).length,
    },
    {
      key: 'unappraised',
      label: 'Not appraised',
      count: leads.filter((l) => !l.appraised).length,
    },
  ];

  const primaryFilters = filters.filter(
    (f) => !SECONDARY_FILTERS.includes(f.key),
  );
  const secondaryFilters = filters.filter((f) =>
    SECONDARY_FILTERS.includes(f.key),
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-1" data-tour="leads-filters">
        {primaryFilters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => selectFilter(f.key)}
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
        <button
          type="button"
          onClick={() => setShowMoreFilters((v) => !v)}
          className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80"
        >
          {showMoreFilters ? 'Fewer filters' : 'More filters'}
          <span aria-hidden className="ml-1">
            {showMoreFilters ? '▾' : '▸'}
          </span>
        </button>
      </div>

      {showMoreFilters && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            More
          </span>
          {secondaryFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => selectFilter(f.key)}
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
      )}

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {filteredLeads.length === 0
            ? '0 leads'
            : `Showing ${pageStart + 1}–${pageStart + pagedLeads.length} of ${filteredLeads.length} lead${filteredLeads.length !== 1 ? 's' : ''}`}
          {truncated && (
            <>
              {' '}
              <span className="text-amber-700">
                · loaded the top {leads.length} of {totalCount} by score;
                older lower-scoring leads are not shown
              </span>
            </>
          )}
        </p>
        {activeFilter === 'new' && filteredLeads.length > 0 && (
          <ClearInboxButton count={filteredLeads.length} />
        )}
      </div>

      {filteredLeads.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          {activeFilter === 'new' ? (
            <>
              <p className="font-medium text-foreground">
                No new leads waiting.
              </p>
              {/* The scout is a 7am cron — there is no run-now control, so
                  don't send the founder looking for a button that isn't
                  there. Point at the one thing they CAN change instead. */}
              <p className="mt-1 text-muted-foreground text-sm">
                Everything sourced so far has already been triaged. The scout
                runs each morning — widen your target areas in{' '}
                <a
                  href="/settings/scouting"
                  className="font-medium text-primary hover:underline"
                >
                  Settings → Scouting
                </a>{' '}
                to bring in more.
              </p>
            </>
          ) : activeFilter === 'shortlist' ? (
            <>
              <p className="font-medium text-foreground">
                Your shortlist is empty.
              </p>
              <p className="mt-1 text-muted-foreground text-sm">
                Hit <span className="font-medium text-emerald-700">Shortlist</span> on
                any lead to save it here.{' '}
                <button
                  type="button"
                  onClick={() => setActiveFilter('triage')}
                  className="font-medium text-primary hover:underline"
                >
                  Triage new leads →
                </button>
              </p>
            </>
          ) : activeFilter === 'triage' ? (
            <>
              <p className="font-medium text-foreground">
                Nothing needs you right now.
              </p>
              <p className="mt-1 text-muted-foreground text-sm">
                No new STRONG or VIABLE leads to triage. Browse{' '}
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className="font-medium text-primary hover:underline"
                >
                  all leads
                </button>{' '}
                or run a fresh scout from{' '}
                <a
                  href="/settings/scouting"
                  className="font-medium text-primary hover:underline"
                >
                  Settings → Scouting
                </a>
                .
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">No leads match this filter.</p>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            {pagedLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                status={getStatus(lead)}
                onTriaged={(s) => handleTriaged(lead.id, s)}
              />
            ))}
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-full border px-3 py-1 font-medium text-xs transition-colors enabled:hover:bg-muted disabled:opacity-40"
              >
                ← Previous
              </button>
              <span className="text-muted-foreground text-xs">
                Page {safePage} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={safePage >= pageCount}
                className="rounded-full border px-3 py-1 font-medium text-xs transition-colors enabled:hover:bg-muted disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function ClearInboxButton({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      try {
        await clearNewLeadsInbox();
        setOpen(false);
      } catch {
        setError('Failed to clear — try again');
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80"
        >
          Clear inbox
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Clear {count} new lead{count === 1 ? '' : 's'}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This removes every untriaged lead from your inbox. None of them
            get marked passed, so it doesn't count against them — if a scout
            run finds the same property again and it still looks solid, it
            comes back as a fresh lead. Anything already shortlisted,
            watched, passed, or converted is untouched.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isPending}
          >
            {isPending ? 'Clearing…' : 'Clear inbox'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function LeadCard({
  lead,
  status,
  onTriaged,
}: {
  lead: Lead;
  status: string;
  onTriaged: (status: TriageStatus) => void;
}) {
  const isPropertyData = lead.source.startsWith('propertydata_');
  const isPlanning = lead.source.startsWith('planning_');
  const isHmo = lead.source.startsWith('hmo_');
  const isDissolved = lead.source === 'companies_house_dissolved';
  const isShortLease = lead.source.startsWith('short_lease');

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
          : isShortLease
            ? 'Short lease'
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
          : isShortLease
            ? 'bg-amber-100 text-amber-800 border-amber-200'
            : 'bg-slate-100 text-slate-700 border-slate-200';

  const externalUrl = lead.listingUrl ?? lead.planningUrl ?? null;

  // Cap the card to the 2 strongest "why act" signals (plain English) plus a
  // single collapsed risk pill — scanning 200 cards with 7+ pills each is
  // impossible. Priority: track > price cut > falling fast > stale > HMO expiry.
  const highlights: { label: string; cls: string; title?: string }[] = [];
  if (lead.track === 'prime') {
    highlights.push({
      label: '★ Prime — own book',
      cls: 'border-emerald-300 bg-emerald-100 text-emerald-900',
      title:
        '£700k+ value: a principal-track candidate for the Kept book (architect refurb), not the investor feed.',
    });
  }
  if (lead.track === 'block') {
    highlights.push({
      label: '▦ Block / portfolio',
      cls: 'border-emerald-300 bg-emerald-100 text-emerald-900',
      title:
        'Multi-unit language in the listing — whole block or portfolio. Principal-track candidate; the house AVM does not apply.',
    });
  }
  if (lead.discountPercent && lead.discountPercent > 0) {
    highlights.push({
      label: `↓ ${lead.discountPercent}% price cut${lead.reductionCount > 1 ? ` ×${lead.reductionCount}` : ''}`,
      cls: 'border-orange-200 bg-orange-100 text-orange-800',
    });
  }
  if (lead.velocityScore >= 0.5) {
    highlights.push({
      label: 'Price falling fast',
      cls: 'border-red-200 bg-red-100 text-red-800',
      title:
        'Repeated, accelerating price cuts — a strong sign of a motivated seller.',
    });
  }
  if (typeof lead.daysOnMarket === 'number' && lead.daysOnMarket >= 60) {
    highlights.push({
      label: `${lead.daysOnMarket} days unsold`,
      cls: 'border-amber-200 bg-amber-50 text-amber-800',
    });
  }
  if (lead.hmoExpiringSoon) {
    highlights.push({
      label: 'HMO licence expiring',
      cls: 'border-rose-200 bg-rose-100 text-rose-800',
      title: lead.hmoLicenceExpiry ? `Expires ${lead.hmoLicenceExpiry}` : undefined,
    });
  }
  if (typeof lead.leaseRemainingYears === 'number') {
    highlights.push({
      label: `${lead.leaseRemainingYears}y lease left`,
      cls: 'border-amber-200 bg-amber-100 text-amber-800',
      title: lead.leaseMarriageValue
        ? 'Under the 80-year marriage-value line — hard to mortgage, so the owner is often motivated to sell fast.'
        : 'Lease approaching the 80-year marriage-value line.',
    });
  }
  const topHighlights = highlights.slice(0, 2);
  const riskCount = lead.riskFlags.length;

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
                {lead.appraised ? (
                  <span
                    className="inline-flex rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
                    title={
                      lead.avmConfidence
                        ? `AVM run · ${lead.avmConfidence} confidence`
                        : 'AVM appraisal run'
                    }
                  >
                    ✓ Appraised
                    {lead.avmValuePence
                      ? ` · ${formatGBP(lead.avmValuePence)}`
                      : ''}
                  </span>
                ) : (
                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    Not appraised
                  </span>
                )}
                {topHighlights.map((h) => (
                  <span
                    key={h.label}
                    title={h.title}
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${h.cls}`}
                  >
                    {h.label}
                  </span>
                ))}
                {riskCount > 0 && (
                  <span
                    className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700"
                    title={lead.riskFlags.join(' · ')}
                  >
                    ⚠ {riskCount} risk{riskCount === 1 ? '' : 's'}
                  </span>
                )}
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

            {/* Right side — score */}
            <div
              className="flex flex-col items-end gap-2 text-right"
              data-tour="leads-score"
            >
              <div>
                <div
                  className="font-mono text-2xl font-bold tabular-nums leading-none"
                  title={lead.rationale ?? undefined}
                >
                  {lead.leadScore}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Score
                </div>
              </div>
              {lead.topPositiveFactors.length > 0 && (
                <ul className="max-w-[180px] space-y-0.5 text-right text-[11px] leading-tight text-emerald-700">
                  {lead.topPositiveFactors.map((f, i) => (
                    <li key={`${f}-${i}`}>+ {f}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Footer: triage decision + links */}
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-2 text-xs">
            <span data-tour="leads-triage">
              {status === 'converted' ? (
                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                  ✓ Converted to deal
                </span>
              ) : (
                <TriageButtons
                  leadId={lead.id}
                  status={status}
                  onChanged={onTriaged}
                />
              )}
            </span>
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
            <span className="ml-auto text-muted-foreground">
              {STATUS_LABELS[status] ?? status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

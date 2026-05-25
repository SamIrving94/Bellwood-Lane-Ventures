import { auth } from '@repo/auth/server';
import { getBookingLink } from '@repo/calendly';
import { database } from '@repo/database';
import { ExternalLinkIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { FeedbackPanel } from '../../components/feedback-panel';
import { Header } from '../../components/header';
import {
  type LeadFlag,
  formatGBPCompact,
  formatGBPFromPence,
  formatHeadroomPct,
  presentLead,
} from '../lead-payload';
import { CalendlyButton } from './calendly-button';
import { ConvertButton } from './convert-button';

export const metadata: Metadata = {
  title: 'Lead Detail — Bellwood Ventures',
};

const verdictColors: Record<string, string> = {
  STRONG:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400',
  VIABLE: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400',
  THIN: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400',
  PASS: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400',
  INSUFFICIENT_DATA:
    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
};

const flagToneClasses: Record<LeadFlag['tone'], string> = {
  danger: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  warn: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  info: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

function Stat({
  label,
  value,
  tone,
}: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={`font-bold text-2xl ${tone ?? ''}`}>{value}</p>
    </div>
  );
}

function renderRawValue(value: unknown): string {
  if (value == null) {
    return '—';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const LeadDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  const { id } = await params;

  const [lead, existingFeedback] = await Promise.all([
    database.scoutLead.findUnique({ where: { id } }),
    database.founderFeedback.findFirst({
      where: { targetType: 'scout_lead', targetId: id },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!lead) {
    notFound();
  }

  const view = presentLead({
    id: lead.id,
    address: lead.address,
    postcode: lead.postcode,
    leadType: lead.leadType,
    leadScore: lead.leadScore,
    verdict: lead.verdict,
    status: lead.status,
    source: lead.source,
    sourceTrail: lead.sourceTrail,
    marketTrend: lead.marketTrend,
    estimatedEquityPence: lead.estimatedEquityPence,
    contactName: lead.contactName,
    contactPhone: lead.contactPhone,
    contactEmail: lead.contactEmail,
    rawPayload: lead.rawPayload,
  });

  const pending = view.enrichmentState === 'pending';
  const rawEntries =
    lead.rawPayload &&
    typeof lead.rawPayload === 'object' &&
    !Array.isArray(lead.rawPayload)
      ? Object.entries(lead.rawPayload as Record<string, unknown>)
      : [];

  const propertyBasics = [
    { label: 'Postcode', value: lead.postcode },
    { label: 'Type', value: view.propertyType?.replace(/_/g, ' ') ?? '—' },
    {
      label: 'Bedrooms',
      value: view.bedrooms != null ? String(view.bedrooms) : '—',
    },
    { label: 'Tenure', value: view.tenureLabel ?? '—' },
  ];

  // Headroom display (avoids nested ternaries in JSX).
  let headroomValue = '—';
  let headroomTone: string | undefined;
  if (view.headroomPence != null) {
    const pct =
      view.headroomPct == null
        ? ''
        : ` · ${formatHeadroomPct(view.headroomPct)}`;
    headroomValue = `${formatGBPCompact(view.headroomPence)}${pct}`;
    headroomTone =
      view.headroomPence >= 0
        ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-rose-700 dark:text-rose-400';
  }

  return (
    <>
      <Header
        pages={[{ title: 'Leads', url: '/pipeline?tab=leads' }]}
        page={lead.address}
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-bold text-xl">{lead.address}</h1>
            <p className="text-muted-foreground text-sm capitalize">
              {[
                lead.postcode,
                view.propertyType?.replace(/_/g, ' '),
                view.tenureLabel,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 font-medium text-xs ${
                verdictColors[lead.verdict] || ''
              }`}
            >
              {lead.verdict}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs">
              {view.leadTypeLabel}
            </span>
            {view.sourceUrl && (
              <a
                href={view.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground text-xs hover:opacity-90"
                aria-label={`Open original listing on ${view.sourceLabel} (opens in a new tab)`}
              >
                <ExternalLinkIcon className="h-3.5 w-3.5" />
                View on {view.sourceLabel}
              </a>
            )}
          </div>
        </div>

        {/* Why this is a lead */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
            Why this is a lead
          </h2>
          <p className="text-sm">{view.relevanceSummary}</p>
          {view.flags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {view.flags.map((flag) => (
                <span
                  key={`${flag.kind}-${flag.label}`}
                  className={`inline-flex rounded-full px-2 py-0.5 font-medium text-xs ${flagToneClasses[flag.tone]}`}
                >
                  {flag.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* The numbers */}
        <div>
          <h2 className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
            The numbers
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Asking price"
              value={formatGBPFromPence(view.askingPricePence)}
            />
            <Stat
              label="Prelim estimate"
              value={formatGBPFromPence(view.estimatePence)}
            />
            <Stat label="Headroom" value={headroomValue} tone={headroomTone} />
          </div>
          <p className="mt-2 text-muted-foreground text-xs">
            Prelim estimate is a conservative Scout figure pending Appraiser AVM
            — not a formal valuation. Headroom = estimate − asking.
          </p>
        </div>

        {/* Scoring */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-muted-foreground text-sm">Lead Score</p>
            <p className="font-bold text-2xl">{lead.leadScore}/100</p>
            <p
              className={`text-xs ${
                pending
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {pending ? 'Pre-enrichment — likely to rise' : 'Enriched'}
            </p>
          </div>
          <Stat label="Market Trend" value={lead.marketTrend ?? '—'} />
          <Stat
            label="Enrichment"
            value={pending ? 'Pending' : 'Enriched'}
            tone={pending ? 'text-amber-600 dark:text-amber-400' : undefined}
          />
          <Stat label="Status" value={lead.status} />
        </div>

        {/* Property basics */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
            Property basics
          </h2>
          <div className="grid gap-3 text-sm sm:grid-cols-4">
            {propertyBasics.map((b) => (
              <div key={b.label}>
                <p className="text-muted-foreground text-xs">{b.label}</p>
                <p className="font-medium capitalize">{b.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        {(lead.contactName || lead.contactEmail || lead.contactPhone) && (
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
              Contact Info
            </h2>
            <div className="space-y-1 text-sm">
              {lead.contactName && (
                <p className="font-medium">{lead.contactName}</p>
              )}
              {lead.contactEmail && <p>{lead.contactEmail}</p>}
              {lead.contactPhone && <p>{lead.contactPhone}</p>}
            </div>
          </div>
        )}

        {/* Source trail */}
        {lead.sourceTrail && (
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
              Source Trail
            </h2>
            <p className="text-sm">{lead.sourceTrail}</p>
          </div>
        )}

        {/* Raw source data — every field Scout pushed, so nothing is hidden even
            if the structured view above does not recognise a key. */}
        {rawEntries.length > 0 && (
          <details className="rounded-lg border bg-card p-4">
            <summary className="cursor-pointer font-medium text-muted-foreground text-sm uppercase tracking-wide">
              Source data ({rawEntries.length} fields)
            </summary>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {rawEntries.map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <dt className="text-muted-foreground text-xs">{key}</dt>
                  <dd className="break-words font-mono text-xs">
                    {renderRawValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        )}

        {/* Founder Feedback — Rate this lead */}
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
                  overrides: existingFeedback.overrides as Record<
                    string,
                    unknown
                  > | null,
                }
              : null
          }
        />

        {/* Metadata */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
            Metadata
          </h2>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Source: </span>
              <span>{lead.source}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Run Date: </span>
              <span>{new Date(lead.runDate).toLocaleDateString('en-GB')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created: </span>
              <span>
                {new Date(lead.createdAt).toLocaleDateString('en-GB')}
              </span>
            </div>
            {lead.evalConfigVersion && (
              <div>
                <span className="text-muted-foreground">Eval Version: </span>
                <span>v{lead.evalConfigVersion}</span>
              </div>
            )}
            {lead.convertedDealId && (
              <div>
                <span className="text-muted-foreground">Converted to: </span>
                <a
                  href={`/deals/${lead.convertedDealId}`}
                  className="font-medium hover:underline"
                >
                  View Deal
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Calendly booking link */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
            Book Initial Call
          </h2>
          <p className="mb-3 text-muted-foreground text-xs">
            Copy and send this link to the vendor. When they book, the deal
            timeline will update automatically.
          </p>
          <CalendlyButton bookingLink={getBookingLink(lead.id)} />
        </div>

        {/* Convert to deal button */}
        {lead.status === 'new' && (
          <div className="flex justify-end">
            <ConvertButton leadId={lead.id} />
          </div>
        )}
      </div>
    </>
  );
};

export default LeadDetailPage;

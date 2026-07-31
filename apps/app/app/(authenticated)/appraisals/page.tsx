import { database } from '@repo/database';
import { AppraisalCard } from './components/appraisal-card';
import type { DeepAppraisalLite } from './components/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * /appraisals — the structured deep-appraisal queue.
 *
 * Surfaces every `review_appraisal` FounderAction created by /cron/deep-appraisal.
 * Each card renders the full 9-section appraisal: property, comparables (with
 * cleanest match), ARV with confidence intervals, condition flags, six
 * environmental risks, bid cap (auctions), recommendation, pre-action checklist,
 * confidence, and escalations.
 *
 * This is the platform-internal equivalent of what Paperclip's Appraiser was
 * producing — same level of decision-grade detail, but persisted, queryable,
 * and observable per LlmCallLog.
 */
export default async function AppraisalsPage() {
  const actions = await database.founderAction.findMany({
    where: {
      type: 'review_appraisal',
      status: { in: ['pending', 'in_progress'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      priority: true,
      title: true,
      description: true,
      metadata: true,
      status: true,
    },
  });

  // Custom priority sort (critical → high → medium → low) then most-recent
  const sorted = [...actions].sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority] ?? 9;
    const pb = PRIORITY_RANK[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  // Count by verdict for the headline.
  const verdictCounts: Record<string, number> = {};
  for (const a of sorted) {
    const verdict =
      (a.metadata as { appraisal?: DeepAppraisalLite } | null)?.appraisal?.recommendation
        ?.verdict ?? 'unknown';
    verdictCounts[verdict] = (verdictCounts[verdict] ?? 0) + 1;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Deep appraisals (AI)</h1>
        <p className="text-sm text-slate-500">
          Decision-grade AI appraisals — distinct from the quick AVM on each
          lead. Each item is a single bid/walk/offer call backed by HMLR
          comparables, environmental risk, and a discount-stacked cap. Produced
          daily by <code>/cron/deep-appraisal</code> for strong leads &amp;
          upcoming auction lots.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Pending"
          value={String(sorted.length)}
        />
        <Stat label="BID" value={String(verdictCounts.bid ?? 0)} tone="green" />
        <Stat label="WALK" value={String(verdictCounts.walk ?? 0)} tone="rose" />
        <Stat
          label="Caveats"
          value={String(
            (verdictCounts.bid_with_caveats ?? 0) +
              (verdictCounts.further_investigation ?? 0),
          )}
          tone="amber"
        />
      </section>

      <section className="space-y-4">
        {sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No pending appraisals. The next run is scheduled for 08:30 daily.
          </div>
        ) : (
          sorted.map((action) => (
            <AppraisalCard
              key={action.id}
              actionId={action.id}
              createdAt={action.createdAt}
              priority={action.priority}
              title={action.title}
              metadata={action.metadata}
            />
          ))
        )}
      </section>

      <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500">
        Source: <code>FounderAction(type=&quot;review_appraisal&quot;)</code>.
        Each appraisal is also linked from <code>/leads/[id]</code> when the
        underlying entity is a STRONG ScoutLead. Run telemetry in{' '}
        <code>/admin/llm-usage</code> under <code>feature=deep_appraisal</code>.
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'green' | 'amber' | 'rose';
}) {
  const accent =
    tone === 'green'
      ? 'border-emerald-200 bg-emerald-50/50'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50/50'
        : tone === 'rose'
          ? 'border-rose-200 bg-rose-50/50'
          : 'border-slate-200';
  return (
    <div className={`rounded-lg border p-4 ${accent}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

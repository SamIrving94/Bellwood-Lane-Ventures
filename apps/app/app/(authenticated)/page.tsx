import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { formatDistanceToNow } from 'date-fns';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from './components/header';

export const metadata: Metadata = {
  title: 'Today — Bellwoods Lane',
  description: 'Your decisions for today.',
};

export const dynamic = 'force-dynamic';

function formatGBP(pence?: number | null): string {
  if (pence == null) return '—';
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

function slaCountdown(submittedAt: Date, slaHours = 24): {
  label: string;
  tone: 'fresh' | 'warning' | 'breach';
} {
  const deadline = submittedAt.getTime() + slaHours * 60 * 60 * 1000;
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    const overMin = Math.round(-remaining / 60000);
    return {
      label: overMin < 60 ? `${overMin}m late` : `${Math.round(overMin / 60)}h late`,
      tone: 'breach',
    };
  }
  const remainingMin = Math.round(remaining / 60000);
  if (remainingMin < 60) return { label: `${remainingMin}m left`, tone: 'warning' };
  const h = Math.floor(remainingMin / 60);
  return {
    label: `${h}h ${remainingMin % 60}m left`,
    tone: h < 1 ? 'warning' : 'fresh',
  };
}

const TONE_CLASSES: Record<'fresh' | 'warning' | 'breach', string> = {
  fresh: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-100 text-amber-800 ring-amber-200',
  breach: 'bg-rose-100 text-rose-800 ring-rose-200',
};

const PRIORITY_CLASSES: Record<string, string> = {
  critical: 'bg-rose-50 border-rose-300',
  high: 'bg-amber-50 border-amber-300',
  medium: 'bg-slate-50 border-slate-300',
  low: 'bg-slate-50 border-slate-200',
};

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-rose-500',
  high: 'bg-amber-500',
  medium: 'bg-slate-500',
  low: 'bg-slate-300',
};

const VERDICT_BADGE: Record<string, string> = {
  STRONG: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  VIABLE: 'bg-blue-100 text-blue-800 ring-blue-200',
};

export default async function TodayPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const last48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const [
    pendingActions,
    agentInbox,
    activeDeals,
    quotesLast24h,
    leadsLast24h,
    repliesLast24h,
    overnightLeads,
    shortlistedLeads,
  ] = await Promise.all([
    database.founderAction.findMany({
      where: { status: { in: ['pending', 'in_progress'] } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 20,
    }),
    database.quoteRequest.findMany({
      where: {
        source: 'agent_quick_form',
        createdAt: { gte: last48h },
        status: { in: ['quoted', 'processing'] },
      },
      include: { offer: true },
      orderBy: { createdAt: 'asc' },
      take: 5,
    }),
    database.deal.findMany({
      where: {
        status: {
          in: ['new_lead', 'contacted', 'valuation', 'offer_made', 'under_offer'],
        },
      },
      select: { status: true, askingPricePence: true, ourOfferPence: true },
    }),
    database.quoteRequest.count({ where: { createdAt: { gte: last24h } } }),
    database.scoutLead.count({ where: { createdAt: { gte: last24h } } }),
    database.outreachRecipient.count({
      where: {
        status: { in: ['replied'] },
        updatedAt: { gte: last24h },
      },
    }).catch(() => 0),
    // Overnight harvest: the best new leads the scout found, surfaced where
    // the founder actually lands each morning. STRONG/VIABLE only, top 5.
    database.scoutLead.findMany({
      where: {
        createdAt: { gte: last24h },
        verdict: { in: ['STRONG', 'VIABLE'] },
        status: 'new',
      },
      orderBy: [{ leadScore: 'desc' }, { createdAt: 'desc' }],
      take: 5,
      select: {
        id: true,
        address: true,
        postcode: true,
        leadType: true,
        leadScore: true,
        verdict: true,
        rawPayload: true,
      },
    }),
    // Our shortlist: leads a founder explicitly shortlisted and hasn't yet
    // converted or passed — the standing "decide on these" queue.
    database.scoutLead.findMany({
      where: { status: 'shortlisted' },
      orderBy: [{ leadScore: 'desc' }, { createdAt: 'desc' }],
      take: 6,
      select: {
        id: true,
        address: true,
        postcode: true,
        leadType: true,
        leadScore: true,
        verdict: true,
        rawPayload: true,
      },
    }),
  ]);

  // Sort actions by manual priority order (Prisma enum sort is alphabetical)
  const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const actionsSorted = pendingActions.sort(
    (a, b) =>
      (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4) ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const pipelineValue = activeDeals.reduce(
    (sum, d) => sum + (d.ourOfferPence ?? d.askingPricePence ?? 0),
    0,
  );

  const stageCounts = activeDeals.reduce(
    (acc, d) => {
      acc[d.status] = (acc[d.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const stages: Array<{ key: string; label: string; color: string }> = [
    { key: 'new_lead', label: 'New', color: 'bg-slate-400' },
    { key: 'contacted', label: 'Contacted', color: 'bg-blue-500' },
    { key: 'valuation', label: 'Valuation', color: 'bg-amber-500' },
    { key: 'offer_made', label: 'Offer made', color: 'bg-purple-500' },
    { key: 'under_offer', label: 'Under offer', color: 'bg-emerald-500' },
  ];

  const totalActiveDeals = activeDeals.length;
  const decisionCount = actionsSorted.length + agentInbox.length;

  return (
    <>
      <Header pages={[]} page="Today" />
      <main className="mx-auto w-full max-w-5xl space-y-10 p-6">
        {/* ─── Header ─────────────────────────────────────── */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <h1 className="mt-1 font-semibold text-3xl tracking-tight">
            Good morning.
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {decisionCount === 0
              ? "You're clear. Nothing waiting on you."
              : `${decisionCount} decision${decisionCount === 1 ? '' : 's'} waiting on you.`}
          </p>
        </div>

        {/* ─── Needs your decision ──────────────────────────── */}
        <section data-tour="action-list">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-semibold text-lg">Needs your decision</h2>
            {decisionCount > 0 && (
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {decisionCount} item{decisionCount === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {decisionCount === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
              <p className="font-serif text-2xl text-slate-700">All clear.</p>
              <p className="mt-2 text-muted-foreground text-sm">
                Paperclip will surface new items here as they need you.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Agent SLA inbox first — these have hard deadlines */}
              {agentInbox.map((q) => {
                const sla = slaCountdown(q.createdAt);
                return (
                  <Link
                    key={q.id}
                    href={`/quotes/${q.id}`}
                    className="block rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-5 transition hover:border-amber-400 hover:bg-amber-50"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-700">
                          Agent SLA · 24-hour signed PDF
                        </p>
                        <p className="mt-2 font-medium">
                          {q.address}, {q.postcode}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {q.firmName ?? 'Unknown firm'} · {q.contactName} ·{' '}
                          {q.sellerSituation?.replace(/_/g, ' ') ?? 'situation unknown'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {q.offer && (
                          <p className="font-medium text-sm">
                            {formatGBP(q.offer.offerPence)}
                          </p>
                        )}
                        <span
                          className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest ring-1 ${TONE_CLASSES[sla.tone]}`}
                        >
                          {sla.label}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}

              {/* Founder Actions */}
              {actionsSorted.slice(0, 12).map((a) => {
                const meta = (a.metadata ?? {}) as Record<string, unknown>;
                const link = (meta.link as string | undefined) ?? '/actions';
                return (
                  <Link
                    key={a.id}
                    href={link}
                    className={`block rounded-2xl border-2 p-5 transition hover:bg-white ${PRIORITY_CLASSES[a.priority] ?? PRIORITY_CLASSES.medium}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${PRIORITY_DOT[a.priority] ?? PRIORITY_DOT.medium}`}
                          />
                          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                            {a.type.replace(/_/g, ' ')} ·{' '}
                            {formatDistanceToNow(a.createdAt, { addSuffix: true })}
                          </span>
                        </div>
                        <p className="mt-2 font-medium">{a.title}</p>
                        {a.description && (
                          <p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
                            {a.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}

              {actionsSorted.length > 12 && (
                <Link
                  href="/actions"
                  className="block rounded-xl border border-dashed border-slate-200 px-4 py-3 text-center text-muted-foreground text-xs hover:bg-accent"
                >
                  View all {actionsSorted.length} actions →
                </Link>
              )}
            </div>
          )}
        </section>

        {/* ─── New leads overnight ──────────────────────────── */}
        {overnightLeads.length > 0 && (
          <section>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-semibold text-lg">New leads overnight</h2>
              <Link
                href="/leads?filter=STRONG"
                className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary hover:underline"
              >
                Review all leads →
              </Link>
            </div>
            <div className="space-y-3">
              {overnightLeads.map((lead) => {
                const raw = (lead.rawPayload ?? {}) as Record<string, unknown>;
                const rationale =
                  (raw.rationale as string | undefined) ?? null;
                return (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="block rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-5 transition hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-700">
                          {lead.leadType.replace(/_/g, ' ')}
                        </p>
                        <p className="mt-2 truncate font-medium">
                          {lead.address}, {lead.postcode}
                        </p>
                        {rationale && (
                          <p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
                            {rationale}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest ring-1 ${VERDICT_BADGE[lead.verdict] ?? 'bg-slate-100 text-slate-700 ring-slate-200'}`}
                        >
                          {lead.verdict}
                        </span>
                        <p className="font-serif text-2xl font-semibold tabular-nums">
                          {lead.leadScore}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── Shortlist ────────────────────────────────────── */}
        {shortlistedLeads.length > 0 && (
          <section>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-semibold text-lg">
                Shortlist — awaiting a decision
              </h2>
              <Link
                href="/leads?filter=shortlist"
                className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary hover:underline"
              >
                Open shortlist →
              </Link>
            </div>
            <div className="space-y-3">
              {shortlistedLeads.map((lead) => {
                const raw = (lead.rawPayload ?? {}) as Record<string, unknown>;
                const rationale =
                  (raw.rationale as string | undefined) ?? null;
                return (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="block rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-5 transition hover:border-amber-300 hover:bg-amber-50"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-700">
                          {lead.leadType.replace(/_/g, ' ')}
                        </p>
                        <p className="mt-2 truncate font-medium">
                          {lead.address}, {lead.postcode}
                        </p>
                        {rationale && (
                          <p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
                            {rationale}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest ring-1 ${VERDICT_BADGE[lead.verdict] ?? 'bg-slate-100 text-slate-700 ring-slate-200'}`}
                        >
                          {lead.verdict}
                        </span>
                        <p className="font-serif text-2xl font-semibold tabular-nums">
                          {lead.leadScore}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── Pipeline pulse ───────────────────────────────── */}
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-semibold text-lg">Pipeline pulse</h2>
            <Link
              href="/pipeline"
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary hover:underline"
            >
              Open pipeline →
            </Link>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <p className="font-serif text-3xl font-semibold tracking-[-0.025em]">
                {pipelineValue > 0 ? formatGBP(pipelineValue) : '—'}
              </p>
              <p className="text-muted-foreground text-sm">
                across {totalActiveDeals} active deal{totalActiveDeals === 1 ? '' : 's'}
              </p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {stages.map((s) => (
                <div
                  key={s.key}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${s.color}`} />
                    <p className="text-muted-foreground text-[11px]">{s.label}</p>
                  </div>
                  <p className="mt-1 font-semibold text-xl">
                    {stageCounts[s.key] ?? 0}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Last 24 hours ────────────────────────────────── */}
        <section>
          <h2 className="mb-4 font-semibold text-lg">In the last 24 hours</h2>
          <div className="grid grid-cols-3 gap-4">
            <div data-tour="stat-pending" className="rounded-2xl border bg-card p-5">
              <p className="text-muted-foreground text-xs">Quote submissions</p>
              <p className="mt-1 font-serif text-3xl font-semibold">{quotesLast24h}</p>
            </div>
            <div data-tour="stat-overdue" className="rounded-2xl border bg-card p-5">
              <p className="text-muted-foreground text-xs">New leads</p>
              <p className="mt-1 font-serif text-3xl font-semibold">{leadsLast24h}</p>
            </div>
            <div data-tour="stat-revenue" className="rounded-2xl border bg-card p-5">
              <p className="text-muted-foreground text-xs">Outreach replies</p>
              <p className="mt-1 font-serif text-3xl font-semibold">{repliesLast24h}</p>
            </div>
          </div>
        </section>

        {/* ─── Concierge tip ────────────────────────────────── */}
        <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center">
          <p className="text-muted-foreground text-sm">
            Need to research a postcode, agent, or deal? Press{' '}
            <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[11px]">
              ⌘K
            </kbd>{' '}
            anywhere to open the Concierge.
          </p>
        </section>
      </main>
    </>
  );
}

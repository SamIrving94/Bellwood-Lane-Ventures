import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
import { presentLead } from '../leads/lead-payload';
import { LeadsTable } from '../leads/leads-table';
import { AddDealDialog } from './components/add-deal-dialog';
import { PipelineBoard } from './components/pipeline-board';

export const metadata: Metadata = {
  title: 'Pipeline — Bellwoods Lane',
  description: 'Deals, leads and archive in one workspace.',
};

export const dynamic = 'force-dynamic';

type Tab = 'deals' | 'leads' | 'archive';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'deals', label: 'Deals' },
  { id: 'leads', label: 'Leads' },
  { id: 'archive', label: 'Archive' },
];

function formatGBP(pence?: number | null): string {
  if (pence == null) {
    return '—';
  }
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

const PipelinePage = async ({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; filter?: string }>;
}) => {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  const { tab: rawTab, filter } = await searchParams;
  const tab: Tab = (
    TABS.some((t) => t.id === rawTab) ? rawTab : 'deals'
  ) as Tab;

  const [activeDealCount, newLeadCount, archivedDealCount] = await Promise.all([
    database.deal.count({
      where: { status: { notIn: ['completed', 'rejected', 'withdrawn'] } },
    }),
    database.scoutLead.count({ where: { status: 'new' } }),
    database.deal.count({
      where: { status: { in: ['completed', 'rejected', 'withdrawn'] } },
    }),
  ]);

  return (
    <>
      <Header pages={[]} page="Pipeline">
        {tab === 'deals' && (
          <div className="pr-4">
            <AddDealDialog />
          </div>
        )}
      </Header>

      <div className="flex flex-1 flex-col gap-4 p-6">
        {/* Tabs */}
        <nav className="flex items-center gap-1 border-b">
          {TABS.map((t) => {
            const isActive = t.id === tab;
            const count =
              t.id === 'deals'
                ? activeDealCount
                : t.id === 'leads'
                  ? newLeadCount
                  : archivedDealCount;
            return (
              <Link
                key={t.id}
                href={`/pipeline?tab=${t.id}`}
                className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm transition ${
                  isActive
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                    isActive
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {count}
                </span>
                {isActive && (
                  <span className="absolute right-0 bottom-[-1px] left-0 h-[2px] bg-foreground" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Tab content */}
        {tab === 'deals' && <DealsTabContent />}
        {tab === 'leads' && <LeadsTabContent filter={filter} />}
        {tab === 'archive' && <ArchiveTabContent />}
      </div>
    </>
  );
};

async function DealsTabContent() {
  const deals = await database.deal.findMany({
    where: { status: { notIn: ['completed', 'rejected', 'withdrawn'] } },
    orderBy: { stageEnteredAt: 'asc' },
  });
  return <PipelineBoard initialDeals={deals} />;
}

async function LeadsTabContent({ filter }: { filter?: string }) {
  const leads = await database.scoutLead.findMany({
    orderBy: [{ leadScore: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  });
  const feedbackRecords = await database.founderFeedback.findMany({
    where: {
      targetType: 'scout_lead',
      targetId: { in: leads.map((l) => l.id) },
    },
    select: { targetId: true, rating: true },
  });
  const feedbackByLeadId = Object.fromEntries(
    feedbackRecords.map((f) => [f.targetId, f.rating])
  );
  const unratedCount = leads.filter(
    (l) => l.status === 'new' && !feedbackByLeadId[l.id]
  ).length;
  // Normalise each lead (typed columns + free-form rawPayload) into a flat,
  // serialisable view the client table renders directly. See lead-payload.ts.
  const views = leads.map((l) =>
    presentLead({
      id: l.id,
      address: l.address,
      postcode: l.postcode,
      leadType: l.leadType,
      leadScore: l.leadScore,
      verdict: l.verdict,
      status: l.status,
      source: l.source,
      sourceTrail: l.sourceTrail,
      marketTrend: l.marketTrend,
      estimatedEquityPence: l.estimatedEquityPence,
      contactName: l.contactName,
      contactPhone: l.contactPhone,
      contactEmail: l.contactEmail,
      rawPayload: l.rawPayload,
      existingRating: feedbackByLeadId[l.id] ?? 0,
    })
  );
  return (
    <LeadsTable
      leads={views}
      unratedCount={unratedCount}
      initialFilter={filter ?? 'all'}
    />
  );
}

async function ArchiveTabContent() {
  const archived = await database.deal.findMany({
    where: { status: { in: ['completed', 'rejected', 'withdrawn'] } },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  if (archived.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 border-dashed bg-slate-50/50 p-12 text-center">
        <p className="font-serif text-2xl text-slate-700">
          Nothing archived yet.
        </p>
        <p className="mt-2 text-muted-foreground text-sm">
          Completed, rejected and withdrawn deals appear here for retros.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <table className="min-w-full divide-y text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-widest">
          <tr>
            <th className="px-5 py-3 text-left">Property</th>
            <th className="px-5 py-3 text-left">Outcome</th>
            <th className="px-5 py-3 text-right">Offer</th>
            <th className="px-5 py-3 text-right">Closed</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {archived.map((d) => {
            const tone =
              d.status === 'completed'
                ? 'text-emerald-700'
                : d.status === 'rejected'
                  ? 'text-rose-700'
                  : 'text-slate-500';
            return (
              <tr key={d.id} className="hover:bg-muted/30">
                <td className="px-5 py-3">
                  <Link
                    href={`/deals/${d.id}`}
                    className="font-medium hover:underline"
                  >
                    {d.address}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    {d.postcode}
                    {d.bedrooms ? ` · ${d.bedrooms} bed` : ''}
                  </p>
                </td>
                <td className={`px-5 py-3 text-xs uppercase ${tone}`}>
                  {d.status}
                </td>
                <td className="px-5 py-3 text-right">
                  {formatGBP(d.ourOfferPence ?? d.askingPricePence)}
                </td>
                <td className="px-5 py-3 text-right text-muted-foreground text-xs">
                  {d.updatedAt.toLocaleDateString('en-GB')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default PipelinePage;

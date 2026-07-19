import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
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
  if (pence == null) return '—';
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

const PipelinePage = async ({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; filter?: string }>;
}) => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { tab: rawTab, filter } = await searchParams;
  const tab: Tab = (TABS.some((t) => t.id === rawTab) ? rawTab : 'deals') as Tab;

  const [activeDealCount, newLeadCount, archivedDealCount] = await Promise.all([
    database.deal.count({
      where: { status: { notIn: ['completed', 'rejected', 'withdrawn'] } },
    }),
    database.scoutLead.count({
      where: { status: { in: ['new', 'shortlisted', 'watching'] } },
    }),
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
                  <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-foreground" />
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
  return (
    <LeadsTable
      leads={leads.map((l) => {
        const raw = (l.rawPayload ?? {}) as Record<string, unknown>;
        const pd = raw.propertyData as Record<string, unknown> | undefined;
        const planning = raw.planning as Record<string, unknown> | undefined;
        const hmo = raw.hmo as Record<string, unknown> | undefined;
        const dissolved = raw.dissolvedCompany as
          | Record<string, unknown>
          | undefined;
        const lease = raw.leaseSignal as
          | Record<string, unknown>
          | undefined;
        const avm = raw.avmFull as Record<string, unknown> | undefined;
        return {
          id: l.id,
          address: l.address,
          postcode: l.postcode,
          leadType: l.leadType,
          leadScore: l.leadScore,
          verdict: l.verdict,
          estimatedEquityPence: l.estimatedEquityPence,
          marketTrend: l.marketTrend,
          status: l.status,
          source: l.source,
          listingType:
            (pd?.listingType as string | undefined) ?? null,
          listingUrl: (pd?.listingUrl as string | undefined) ?? null,
          imageUrl: (pd?.imageUrl as string | undefined) ?? null,
          summary: (pd?.summary as string | undefined) ?? null,
          pricePence: (pd?.pricePence as number | undefined) ?? null,
          originalPricePence:
            (pd?.originalPricePence as number | undefined) ?? null,
          discountPercent:
            (pd?.discountPercent as number | undefined) ?? null,
          reductionCount:
            (pd?.reductionCount as number | undefined) ?? 0,
          velocityScore:
            (pd?.velocityScore as number | undefined) ?? 0,
          bedrooms: (pd?.bedrooms as number | undefined) ?? null,
          propertyType:
            (pd?.propertyType as string | undefined) ?? null,
          daysOnMarket:
            (pd?.daysOnMarket as number | undefined) ?? null,
          planningDecision:
            (planning?.decision as string | undefined) ?? null,
          planningRating:
            (planning?.decisionRating as string | undefined) ?? null,
          planningProposal:
            (planning?.proposal as string | undefined) ?? null,
          planningUrl:
            (planning?.url as string | undefined) ?? null,
          hmoExpiringSoon:
            (hmo?.licenceExpiringSoon as boolean | undefined) ?? false,
          hmoLicenceExpiry:
            (hmo?.licenceExpiry as string | undefined) ?? null,
          dissolvedCompanyName:
            (dissolved?.companyName as string | undefined) ?? null,
          dissolvedAt:
            (dissolved?.dissolvedAt as string | undefined) ?? null,
          leaseRemainingYears:
            (lease?.remainingLeaseYears as number | undefined) ?? null,
          leaseMarriageValue:
            (lease?.marriageValue as boolean | undefined) ?? false,
          appraised: typeof avm?.pointEstimatePence === 'number',
          avmValuePence:
            (avm?.pointEstimatePence as number | undefined) ?? null,
          avmConfidence:
            (avm?.confidenceLevel as string | undefined) ?? null,
          riskFlags:
            (raw.riskFlags as string[] | undefined) ?? [],
          rationale:
            (raw.rationale as string | undefined) ?? null,
          topPositiveFactors: (
            (raw.scoreFactors as Array<{
              label: string;
              points: number;
            }> | undefined) ?? []
          )
            .filter((f) => f.points > 0)
            .sort((a, b) => b.points - a.points)
            .slice(0, 3)
            .map((f) => f.label),
        };
      })}
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
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
        <p className="font-serif text-2xl text-slate-700">Nothing archived yet.</p>
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

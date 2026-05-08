import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { formatDistanceToNow } from 'date-fns';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
import { AddContactDialog } from '../contacts/add-contact-dialog';

export const metadata: Metadata = {
  title: 'Outreach — Bellwoods Lane',
  description: 'People, campaigns, inbox and templates in one place.',
};

export const dynamic = 'force-dynamic';

type Tab = 'people' | 'campaigns' | 'inbox' | 'templates';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'people', label: 'People' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'templates', label: 'Templates' },
];

const TYPE_LABELS: Record<string, string> = {
  estate_agent: 'Estate agent',
  solicitor: 'Solicitor',
  vendor: 'Vendor',
  investor: 'Investor',
  sourcer: 'Sourcer',
};

const OutreachPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string }>;
}) => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { tab: rawTab, type } = await searchParams;
  const tab: Tab = (TABS.some((t) => t.id === rawTab) ? rawTab : 'people') as Tab;

  // Counts for tab badges
  const [peopleCount, campaignCount, inboxCount, templateCount] =
    await Promise.all([
      database.contact.count(),
      database.outreachCampaign.count({
        where: { status: { in: ['draft', 'active'] } },
      }),
      database.whatsAppIntake.count({
        where: { parseStatus: { in: ['pending', 'manual_review'] } },
      }),
      database.outreachTemplate.count(),
    ]);

  return (
    <>
      <Header pages={[]} page="Outreach">
        {tab === 'people' && (
          <div className="pr-4">
            <AddContactDialog />
          </div>
        )}
      </Header>

      <div className="flex flex-1 flex-col gap-4 p-6">
        {/* Tabs */}
        <nav className="flex items-center gap-1 border-b">
          {TABS.map((t) => {
            const isActive = t.id === tab;
            const count =
              t.id === 'people'
                ? peopleCount
                : t.id === 'campaigns'
                  ? campaignCount
                  : t.id === 'inbox'
                    ? inboxCount
                    : templateCount;
            return (
              <Link
                key={t.id}
                href={`/outreach?tab=${t.id}`}
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
        {tab === 'people' && <PeopleTab type={type} />}
        {tab === 'campaigns' && <CampaignsTab />}
        {tab === 'inbox' && <InboxTab />}
        {tab === 'templates' && <TemplatesTab />}
      </div>
    </>
  );
};

async function PeopleTab({ type }: { type?: string }) {
  const types = ['estate_agent', 'solicitor', 'vendor', 'investor', 'sourcer'];
  const filterType = type && types.includes(type) ? type : undefined;

  const contacts = await database.contact.findMany({
    where: filterType ? { type: filterType } : undefined,
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });

  // Counts for filter chips
  const counts = await Promise.all(
    types.map(async (t) => ({ type: t, count: await database.contact.count({ where: { type: t } }) })),
  );

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/outreach?tab=people"
          className={`rounded-full px-3 py-1 text-xs transition ${
            !filterType
              ? 'bg-foreground text-background'
              : 'border border-slate-300 text-slate-600 hover:border-slate-400'
          }`}
        >
          All <span className="opacity-60">({contacts.length})</span>
        </Link>
        {counts.map((c) => (
          <Link
            key={c.type}
            href={`/outreach?tab=people&type=${c.type}`}
            className={`rounded-full px-3 py-1 text-xs transition ${
              filterType === c.type
                ? 'bg-foreground text-background'
                : 'border border-slate-300 text-slate-600 hover:border-slate-400'
            }`}
          >
            {TYPE_LABELS[c.type] ?? c.type} <span className="opacity-60">({c.count})</span>
          </Link>
        ))}
      </div>

      {/* Cards */}
      {contacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
          <p className="font-serif text-2xl text-slate-700">No contacts yet.</p>
          <p className="mt-2 text-muted-foreground text-sm">
            Add estate agents, solicitors, vendors, and investors here. The
            Monday prospecting cron also pushes new agents in automatically.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((c) => {
            const notContacted = c.tags.includes('status:not_yet_contacted');
            return (
              <div
                key={c.id}
                className={`rounded-2xl border bg-card p-4 ${
                  notContacted ? 'border-amber-300 bg-amber-50/30' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    {c.company && (
                      <p className="text-muted-foreground text-sm">{c.company}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {TYPE_LABELS[c.type] ?? c.type}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-muted-foreground text-sm">
                  {c.email && <p className="truncate">{c.email}</p>}
                  {c.phone && <p>{c.phone}</p>}
                  {c.location && <p className="truncate">{c.location}</p>}
                </div>
                {c.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {c.tags.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          t === 'status:not_yet_contacted'
                            ? 'bg-amber-200 text-amber-900'
                            : 'bg-muted'
                        }`}
                      >
                        {t.replace(/^status:|^source:|^postcode:|^listings:/, '')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

async function CampaignsTab() {
  const campaigns = await database.outreachCampaign.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { recipients: { select: { status: true } } },
  });

  if (campaigns.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
        <p className="font-serif text-2xl text-slate-700">No campaigns yet.</p>
        <p className="mt-2 text-muted-foreground text-sm">
          Create a campaign by selecting templates and assigning contacts.
        </p>
      </div>
    );
  }

  const STATUS_TONE: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    active: 'bg-emerald-100 text-emerald-700',
    paused: 'bg-amber-100 text-amber-700',
    completed: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-3">
      {campaigns.map((c) => {
        const sent = c.recipients.filter((r) => r.status !== 'pending').length;
        const total = c.recipients.length;
        const replied = c.recipients.filter((r) => r.status === 'replied').length;
        return (
          <Link
            key={c.id}
            href={`/campaigns/${c.id}`}
            className="flex items-center justify-between rounded-2xl border bg-card p-5 transition hover:bg-accent"
          >
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-muted-foreground text-sm">
                {sent}/{total} sent · {replied} replies · updated{' '}
                {formatDistanceToNow(c.updatedAt, { addSuffix: true })}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest ${
                STATUS_TONE[c.status] ?? 'bg-muted'
              }`}
            >
              {c.status}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

async function InboxTab() {
  const intakes = await database.whatsAppIntake.findMany({
    orderBy: { receivedAt: 'desc' },
    take: 30,
  });

  if (intakes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
        <p className="font-serif text-2xl text-slate-700">Inbox empty.</p>
        <p className="mt-2 text-muted-foreground text-sm">
          Inbound vendor messages, WhatsApp intakes and held drafts will appear here.
        </p>
      </div>
    );
  }

  const STATUS_TONE: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-700',
    parsed: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-rose-100 text-rose-700',
    manual_review: 'bg-amber-100 text-amber-800',
  };

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <ul className="divide-y">
        {intakes.map((i) => (
          <li key={i.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${STATUS_TONE[i.parseStatus] ?? 'bg-muted'}`}
                  >
                    {i.parseStatus.replace(/_/g, ' ')}
                  </span>
                  {i.senderName && (
                    <span className="text-muted-foreground">
                      from {i.senderName}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(i.receivedAt, { addSuffix: true })}
                  </span>
                </div>
                <p className="truncate text-sm">
                  {i.rawText.slice(0, 140)}
                  {i.rawText.length > 140 ? '…' : ''}
                </p>
                {i.scoutLeadId && (
                  <Link
                    href={`/pipeline?tab=leads`}
                    className="mt-2 inline-block text-primary text-xs hover:underline"
                  >
                    View lead →
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function TemplatesTab() {
  const templates = await database.outreachTemplate.findMany({
    orderBy: [{ type: 'asc' }, { sequence: 'asc' }],
  });

  if (templates.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
        <p className="font-serif text-2xl text-slate-700">No templates yet.</p>
        <p className="mt-2 text-muted-foreground text-sm">
          Create email sequences for estate agents, probate solicitors and vendor outreach.
        </p>
      </div>
    );
  }

  const grouped = templates.reduce(
    (acc, t) => {
      acc[t.type] = acc[t.type] || [];
      acc[t.type].push(t);
      return acc;
    },
    {} as Record<string, typeof templates>,
  );

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([type, ts]) => (
        <section key={type}>
          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {type.replace(/_/g, ' ')} · {ts.length} templates
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ts.map((t) => (
              <div key={t.id} className="rounded-2xl border bg-card p-4">
                <p className="font-medium">{t.name}</p>
                <p className="text-muted-foreground text-xs">
                  Step {t.sequence}
                  {t.delayDays > 0 ? ` · +${t.delayDays}d delay` : ''}
                </p>
                <p className="mt-3 line-clamp-2 text-sm">{t.subject}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default OutreachPage;

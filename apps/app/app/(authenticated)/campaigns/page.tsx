import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { Button } from '@repo/design-system/components/ui/button';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';

export const metadata: Metadata = {
  title: 'Campaigns — Bellwood Ventures',
  description: 'Targeted sourcing + outreach campaigns',
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  completed: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
  archived: 'bg-muted text-muted-foreground',
};

const CampaignsPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const campaigns = await database.campaign.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <Header pages={[]} page="Campaigns" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Targeted Campaigns</h1>
            <p className="text-sm text-muted-foreground">
              Define a geography + filters, dispatch Scout / Appraiser / Marketer on autopilot.
            </p>
          </div>
          <Button asChild>
            <Link href="/campaigns/new">New Campaign</Link>
          </Button>
        </div>

        {campaigns.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <p className="text-lg font-medium">No campaigns yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first campaign to tell Paperclip agents where to source and who to contact.
            </p>
            <div className="mt-4">
              <Button asChild>
                <Link href="/campaigns/new">Create Campaign</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Area</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Leads</th>
                  <th className="px-4 py-3">Qualified</th>
                  <th className="px-4 py-3">Outreach</th>
                  <th className="px-4 py-3">Replies</th>
                  <th className="px-4 py-3">Deals</th>
                  <th className="px-4 py-3">Launched</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {c.postcodeArea}{' '}
                      <span className="text-xs text-muted-foreground">
                        ({c.radiusMiles}mi)
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[c.status] ?? STATUS_STYLES.draft}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{c.leadsFound}</td>
                    <td className="px-4 py-3">{c.leadsQualified}</td>
                    <td className="px-4 py-3">{c.outreachSent}</td>
                    <td className="px-4 py-3">{c.replies}</td>
                    <td className="px-4 py-3">{c.dealsCreated}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {c.launchedAt
                        ? new Date(c.launchedAt).toLocaleDateString('en-GB')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default CampaignsPage;

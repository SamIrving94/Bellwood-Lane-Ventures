import { auth } from '@repo/auth/server';
import { brand } from '@repo/brand';
import { database } from '@repo/database';
import { format } from 'date-fns';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GuideRowActions } from './guide-row-actions';

export const metadata: Metadata = {
  title: 'Guides — Marketing — Kept',
  description: 'Evergreen guides: drafted weekly, published by hand.',
};

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  approved: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  published:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  archived: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

/**
 * /marketing/guides — every guide the research cron has drafted, with its
 * state and the buttons that move it. The queue card is where a draft is
 * read; this is where the founder sees what is live and pulls one back.
 */
const GuidesPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const guides = await database.guidePost.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      slug: true,
      title: true,
      segment: true,
      questionKey: true,
      status: true,
      hook: true,
      createdAt: true,
      publishedAt: true,
      compliance: true,
    },
  });

  const published = guides.filter((g) => g.status === 'published').length;
  const waiting = guides.filter((g) => g.status === 'draft').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-6 rounded-lg border bg-card px-4 py-3 text-sm">
        <span>
          <span className="font-mono font-semibold">{published}</span> live
        </span>
        <span>
          <span className="font-mono font-semibold">{waiting}</span> waiting for
          review
        </span>
        <span className="text-muted-foreground">
          One guide is drafted every Saturday from the evergreen question list.
          Publishing puts it at {brand.url}/guides within five minutes.
        </span>
      </div>

      {guides.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="font-medium text-lg">No guides yet.</p>
          <p className="mt-1 text-muted-foreground text-sm">
            The first draft arrives after the Saturday research run.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2">Guide</th>
                <th className="px-4 py-2">Segment</th>
                <th className="px-4 py-2">Counsel</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {guides.map((g) => {
                const verdict =
                  (g.compliance as { overallVerdict?: string } | null)
                    ?.overallVerdict ?? '—';
                const liveHref = `${brand.url}/guides/${g.slug}`;
                return (
                  <tr key={g.id} className="border-b last:border-0">
                    <td className="max-w-md px-4 py-3">
                      <p className="font-medium">{g.title}</p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                        {g.questionKey} · /guides/{g.slug}
                      </p>
                      {g.hook && (
                        <p className="mt-1 line-clamp-2 text-muted-foreground text-xs italic">
                          {g.hook}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {g.segment.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{verdict}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_STYLE[g.status] ?? ''}`}
                      >
                        {g.status}
                      </span>
                      {g.status === 'published' && (
                        <a
                          href={liveHref}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 text-xs underline"
                        >
                          open
                        </a>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground text-xs">
                      {format(g.publishedAt ?? g.createdAt, 'd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <GuideRowActions id={g.id} status={g.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default GuidesPage;

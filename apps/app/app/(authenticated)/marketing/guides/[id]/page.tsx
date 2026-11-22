import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { format } from 'date-fns';
import { ArrowLeftIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { GuideRowActions } from '../guide-row-actions';
import { PreviewFrame } from './preview-frame';

export const metadata: Metadata = {
  title: 'Guide preview — Marketing — Kept',
};

export const dynamic = 'force-dynamic';

type ComplianceIssue = {
  ruleSet?: string;
  severity?: string;
  excerpt?: string;
  problem?: string;
  suggestedFix?: string;
};

type Compliance = {
  overallVerdict?: string;
  issues?: ComplianceIssue[];
  substantiationNeeded?: string[];
  missingSignposts?: string[];
};

const VERDICT_STYLE: Record<string, string> = {
  publish_ready:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  edit_required:
    'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  do_not_publish: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};

const SEVERITY_STYLE: Record<string, string> = {
  blocker: 'text-red-700 dark:text-red-400',
  high: 'text-red-700 dark:text-red-400',
  medium: 'text-amber-700 dark:text-amber-400',
  low: 'text-muted-foreground',
};

/**
 * /marketing/guides/[id] — read a guide exactly as a reader will see it,
 * then approve, publish or archive it from the same screen.
 *
 * The page itself is rendered by the public site (/guides/preview/[id]) and
 * framed here, so what the founder reads is the real thing, not a copy
 * styled to look like it. Around it: how it shows in a Google result, and
 * Counsel's compliance report.
 */
const GuidePreviewPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { id } = await params;
  const guide = await database.guidePost.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      metaDescription: true,
      segment: true,
      status: true,
      compliance: true,
      createdAt: true,
      publishedAt: true,
    },
  });
  if (!guide) notFound();

  const webUrl = (
    process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001'
  ).replace(/\/$/, '');
  // Published guides are shown at their live address; everything else
  // through the preview route, which only serves drafts.
  const src =
    guide.status === 'published'
      ? `${webUrl}/guides/${guide.slug}`
      : `${webUrl}/guides/preview/${guide.id}`;
  const host = webUrl.replace(/^https?:\/\//, '');

  const compliance = (guide.compliance ?? {}) as Compliance;
  const verdict = compliance.overallVerdict;
  const issues = compliance.issues ?? [];
  const toSource = [
    ...(compliance.substantiationNeeded ?? []),
    ...(compliance.missingSignposts ?? []),
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/marketing/guides"
        className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        All guides
      </Link>

      {/* Header + the buttons that move it */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border bg-card p-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-wide">
            {guide.status} · {guide.segment.replace(/_/g, ' ')} ·{' '}
            {format(guide.publishedAt ?? guide.createdAt, 'd MMM yyyy')}
          </p>
          <h1 className="mt-1 font-semibold text-xl">{guide.title}</h1>
        </div>
        <GuideRowActions id={guide.id} status={guide.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <PreviewFrame src={src} />

        <aside className="space-y-4">
          {/* How it reads in a search result — the first thing most
              readers will see of it. */}
          <section className="rounded-lg border bg-card p-4">
            <p className="font-medium text-sm">In Google</p>
            <div className="mt-3 space-y-0.5">
              <p className="truncate text-muted-foreground text-xs">
                {host} › guides › {guide.slug}
              </p>
              <p className="text-[17px] text-blue-700 leading-snug dark:text-blue-400">
                {guide.title}
              </p>
              <p className="text-muted-foreground text-sm leading-snug">
                {guide.metaDescription}
              </p>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm">Counsel</p>
              {verdict && (
                <span
                  className={`rounded-full px-2 py-0.5 font-medium text-xs ${VERDICT_STYLE[verdict] ?? ''}`}
                >
                  {verdict.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            {!verdict && (
              <p className="mt-2 text-muted-foreground text-sm">
                No compliance report on this guide.
              </p>
            )}
            {issues.length > 0 && (
              <ul className="mt-3 space-y-3">
                {issues.map((issue, i) => (
                  <li key={`${issue.ruleSet}-${i}`} className="text-sm">
                    <p
                      className={`font-mono text-[11px] uppercase ${SEVERITY_STYLE[issue.severity ?? ''] ?? ''}`}
                    >
                      {issue.severity} · {issue.ruleSet}
                    </p>
                    {issue.excerpt && (
                      <p className="mt-1 text-muted-foreground text-xs italic">
                        “{issue.excerpt}”
                      </p>
                    )}
                    <p className="mt-1">{issue.problem}</p>
                    {issue.suggestedFix && (
                      <p className="mt-1 text-muted-foreground text-xs">
                        Fix: {issue.suggestedFix}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {toSource.length > 0 && (
              <div className="mt-3 border-t pt-3">
                <p className="text-muted-foreground text-xs">Needs a source</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                  {toSource.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
};

export default GuidePreviewPage;

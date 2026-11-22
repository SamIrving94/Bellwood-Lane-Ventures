import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { format } from 'date-fns';
import { ArrowLeftIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { GuideRowActions } from '../guide-row-actions';
import { type Compliance, GuideEditor, GuideReader } from './guide-editor';

export const metadata: Metadata = {
  title: 'Guide review — Marketing — Kept',
};

export const dynamic = 'force-dynamic';

/**
 * /marketing/guides/[id] — read a guide in full, fold Counsel's fixes into
 * the text, then approve or publish it from the same screen.
 *
 * Rendered here in the dashboard, not framed from the public site: the
 * framed version (Nov 2026) was refused by the browser in production, and
 * the founders need the full text and Counsel side by side more than they
 * need the site's exact styling. The public preview route
 * (/guides/preview/[id]) still exists for "see it on the site".
 */
const GuideReviewPage = async ({
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
      h1: true,
      metaDescription: true,
      hook: true,
      bodyMarkdown: true,
      ctaLine: true,
      segment: true,
      status: true,
      compliance: true,
      createdAt: true,
      publishedAt: true,
    },
  });
  if (!guide) notFound();

  const text = {
    title: guide.title,
    h1: guide.h1,
    metaDescription: guide.metaDescription,
    hook: guide.hook ?? '',
    bodyMarkdown: guide.bodyMarkdown,
    ctaLine: guide.ctaLine,
  };
  const editable = guide.status === 'draft' || guide.status === 'approved';

  return (
    <div className="space-y-4">
      <Link
        href="/marketing/guides"
        className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        All guides
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-wide">
            {guide.status} · {guide.segment.replace(/_/g, ' ')} ·{' '}
            {format(guide.publishedAt ?? guide.createdAt, 'd MMM yyyy')}
          </p>
          <h1 className="mt-1 font-semibold text-xl">{guide.title}</h1>
        </div>
        {!editable && <GuideRowActions id={guide.id} status={guide.status} />}
      </div>

      {editable ? (
        <GuideEditor
          // Remount on status change so saved state starts from the DB.
          key={guide.status}
          id={guide.id}
          status={guide.status as 'draft' | 'approved'}
          initial={text}
          compliance={(guide.compliance ?? {}) as Compliance}
          slug={guide.slug}
        />
      ) : (
        <div className="rounded-lg border bg-card p-6">
          {guide.status === 'published' && (
            <p className="mb-4 text-muted-foreground text-sm">
              Live. To change the words, Unpublish it first, edit, then publish
              again.
            </p>
          )}
          <GuideReader text={text} />
        </div>
      )}
    </div>
  );
};

export default GuideReviewPage;

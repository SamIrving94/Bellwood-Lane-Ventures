import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GuideArticle } from '../../guide-article';

/**
 * /guides/preview/[id] — a guide that is not live yet, shown exactly as a
 * reader would see it, so the founders can read the real page before they
 * approve or publish it. The dashboard frames this page at
 * /marketing/guides/[id].
 *
 * Access: the GuidePost id is the key. It is a random cuid that never
 * appears on the public site (live guides are addressed by slug), and the
 * content is a draft that is meant to go public anyway. Kept out of search
 * (noindex here, disallowed in robots.ts) and out of analytics
 * (PRIVATE_PATHS in components/cookie-consent.tsx). The middleware lets
 * only the dashboard frame this path.
 *
 * Published guides render here too (with a "live" strip), so the dashboard
 * can frame them: the live /guides/[slug] page refuses to be framed.
 * Archived guides 404.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Guide preview · Kept',
  robots: { index: false, follow: false },
};

export default async function GuidePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guide = await database.guidePost
    .findUnique({
      where: { id },
      select: {
        slug: true,
        status: true,
        h1: true,
        bodyMarkdown: true,
        ctaLine: true,
        ctaHref: true,
        hook: true,
        sources: true,
      },
    })
    .catch(() => null);

  if (!guide || guide.status === 'archived') notFound();

  return (
    <>
      {guide.status === 'published' ? (
        <div className="bg-emerald-100 px-5 py-2 text-center font-mono text-[11px] text-emerald-900 uppercase tracking-[0.14em]">
          Live · /guides/{guide.slug}
        </div>
      ) : (
        <div className="bg-amber-100 px-5 py-2 text-center font-mono text-[11px] text-amber-900 uppercase tracking-[0.14em]">
          Preview · not live · /guides/{guide.slug}
        </div>
      )}
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-5 pb-24 md:px-10">
        <GuideArticle guide={guide} date={new Date()} />
      </main>
      <SiteFooter />
    </>
  );
}

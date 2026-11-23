import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { brand } from '@repo/brand';
import { database } from '@repo/database';
import { type Article, JsonLd, type WithContext } from '@repo/seo/json-ld';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GuideArticle } from '../guide-article';

export const revalidate = 300;

async function loadGuide(slug: string) {
  return database.guidePost
    .findFirst({
      where: { slug, status: 'published' },
      select: {
        slug: true,
        title: true,
        h1: true,
        metaDescription: true,
        bodyMarkdown: true,
        ctaLine: true,
        ctaHref: true,
        hook: true,
        sources: true,
        segment: true,
        publishedAt: true,
        updatedAt: true,
      },
    })
    .catch(() => null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = await loadGuide(slug);
  if (!guide)
    return { title: 'Guide not found · Kept', robots: { index: false } };
  return {
    title: `${guide.title} · Kept`,
    description: guide.metaDescription,
    alternates: { canonical: `${brand.url}/guides/${guide.slug}` },
    openGraph: {
      type: 'article',
      title: guide.title,
      description: guide.metaDescription,
      url: `${brand.url}/guides/${guide.slug}`,
      publishedTime: guide.publishedAt?.toISOString(),
      modifiedTime: guide.updatedAt.toISOString(),
    },
  };
}

/**
 * /guides/[slug] — one published guide. The article itself lives in
 * ../guide-article.tsx, shared with the founder preview.
 */
export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = await loadGuide(slug);
  if (!guide) notFound();

  const jsonLd: WithContext<Article> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.metaDescription,
    datePublished: guide.publishedAt?.toISOString(),
    dateModified: guide.updatedAt.toISOString(),
    author: { '@type': 'Organization', name: brand.name, url: brand.url },
    publisher: { '@type': 'Organization', name: brand.name, url: brand.url },
    mainEntityOfPage: `${brand.url}/guides/${guide.slug}`,
  };

  return (
    <>
      <JsonLd code={jsonLd} />
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-5 pb-24 md:px-10">
        <GuideArticle
          guide={guide}
          date={guide.publishedAt ?? guide.updatedAt}
        />
      </main>
      <SiteFooter />
    </>
  );
}

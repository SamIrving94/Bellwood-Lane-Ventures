import { brand } from '@repo/brand';
import { database } from '@repo/database';
import { notFound } from 'next/navigation';

export const revalidate = 300;

/**
 * /guides/[slug]/md: the same published guide as plain markdown, for
 * assistants that would rather read text than HTML. Only published guides:
 * drafts stay behind the founder preview. The body is what the live page
 * renders, with the sources and the hand-off line the page carries.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const guide = await database.guidePost
    .findFirst({
      where: { slug, status: 'published' },
      select: {
        slug: true,
        h1: true,
        bodyMarkdown: true,
        ctaLine: true,
        ctaHref: true,
        sources: true,
        updatedAt: true,
      },
    })
    .catch(() => null);
  if (!guide) {
    notFound();
  }

  const sources = (Array.isArray(guide.sources) ? guide.sources : []) as Array<{
    title?: string;
    url?: string;
  }>;
  const cta = guide.ctaHref.startsWith('http')
    ? guide.ctaHref
    : `${brand.url}${guide.ctaHref}`;
  const out = [
    `# ${guide.h1}`,
    '',
    `_${brand.name}. Last updated ${guide.updatedAt.toISOString().slice(0, 10)}. Canonical page: ${brand.url}/guides/${guide.slug}_`,
    '',
    guide.bodyMarkdown.trim(),
    '',
    ...(sources.length
      ? [
          '## Sources',
          '',
          ...sources
            .filter((s) => s.url)
            .map((s) => `- [${s.title ?? s.url}](${s.url})`),
          '',
        ]
      : []),
    `[${guide.ctaLine}](${cta})`,
    '',
  ].join('\n');

  return new Response(out, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}

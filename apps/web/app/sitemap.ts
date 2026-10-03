import { SITE_MAP } from '@/lib/site-map';
import { brand } from '@repo/brand';
import { database } from '@repo/database';
import type { MetadataRoute } from 'next';

export const revalidate = 300;

/**
 * Public routes come from the IA (lib/site-map.ts), the same list the
 * footer renders, so a page linked in the footer is always in the sitemap.
 * Anything gated, tokenised or noindex (keyhole, portal, track, viewing,
 * offer documents, api) is never in that list. Guides are appended from
 * the database so a publish reaches the sitemap inside the ISR window.
 */
const PRIORITY: Record<string, number> = {
  '/': 1,
  '/sell': 0.9,
  '/probate': 0.9,
  '/chain-break': 0.9,
  '/separation': 0.8,
  '/relocation': 0.8,
  '/problem-property': 0.8,
  '/agents': 0.8,
  '/guides': 0.8,
  '/your-situation': 0.7,
  '/why-we-wont-buy-any-home': 0.7,
  '/instant-offer/methodology': 0.7,
  '/save-the-sale': 0.7,
  '/about': 0.5,
};

const STATIC_ROUTES = [
  '/',
  ...SITE_MAP.flatMap((group) => group.links)
    .filter((link) => link.sitemap !== false)
    .map((link) => link.href),
].map((path) => ({ path, priority: PRIORITY[path] ?? 0.3 }));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const guides = await database.guidePost
    .findMany({
      where: { status: 'published' },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: 'desc' },
    })
    .catch(() => []);

  return [
    ...STATIC_ROUTES.map((r) => ({
      url: `${brand.url}${r.path}`,
      priority: r.priority,
      changeFrequency: 'weekly' as const,
    })),
    ...guides.map((g) => ({
      url: `${brand.url}/guides/${g.slug}`,
      lastModified: g.updatedAt,
      priority: 0.7,
      changeFrequency: 'monthly' as const,
    })),
  ];
}

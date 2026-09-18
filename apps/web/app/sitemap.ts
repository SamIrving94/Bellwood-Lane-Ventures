import { brand } from '@repo/brand';
import { database } from '@repo/database';
import type { MetadataRoute } from 'next';

export const revalidate = 300;

/**
 * Public routes only. Anything gated, tokenised or noindex (keyhole, portal,
 * track, viewing, offer documents, api) stays out. Guides are appended from
 * the database so a publish reaches the sitemap inside the ISR window.
 */
const STATIC_ROUTES: Array<{ path: string; priority: number }> = [
  { path: '/', priority: 1 },
  { path: '/sell', priority: 0.9 },
  { path: '/probate', priority: 0.9 },
  { path: '/chain-break', priority: 0.9 },
  { path: '/separation', priority: 0.8 },
  { path: '/relocation', priority: 0.8 },
  { path: '/problem-property', priority: 0.8 },
  { path: '/your-situation', priority: 0.7 },
  { path: '/why-we-wont-buy-any-home', priority: 0.7 },
  { path: '/instant-offer/methodology', priority: 0.7 },
  { path: '/agents', priority: 0.8 },
  { path: '/save-the-sale', priority: 0.7 },
  { path: '/about', priority: 0.5 },
  { path: '/guides', priority: 0.8 },
];

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

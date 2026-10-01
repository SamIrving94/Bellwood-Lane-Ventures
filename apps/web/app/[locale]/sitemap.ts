import { env } from '@/env';
import { SITE_MAP } from '@/lib/site-map';
import type { MetadataRoute } from 'next';

const protocol = env.VERCEL_PROJECT_PRODUCTION_URL?.startsWith('https')
  ? 'https'
  : 'http';
const base = new URL(
  `${protocol}://${env.VERCEL_PROJECT_PRODUCTION_URL || 'bellwoodslane.co.uk'}`
);

// Derived from the IA so the footer and the sitemap can't drift apart.
const sitemap = async (): Promise<MetadataRoute.Sitemap> =>
  SITE_MAP.flatMap((group) => group.links)
    .filter((link) => link.sitemap !== false)
    .map((link) => ({
      url: new URL(link.href, base).href,
      lastModified: new Date(),
    }));

export default sitemap;
